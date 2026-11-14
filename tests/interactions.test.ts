import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnalyticsEvent, ScrollEvent } from '@site-analytics/contracts';
import { createTracker } from '../packages/tracker/src/index.js';
test('explicit interactions enforce consent, privacy, per-view scroll thresholds and dynamic-height rules', async () => {
  class Element extends EventTarget {
    isConnected=true; scrollTop=0; scrollHeight=1000; clientHeight=200; offscreen=false;
    getBoundingClientRect(){return {width:300,height:200,top:this.offscreen?2000:0,left:0,right:300,bottom:this.offscreen?2200:200};}
  }
  const original=new Map<string,PropertyDescriptor|undefined>(), requests:AnalyticsEvent[][]=[];
  let reads=0,publicScope=true,fail=false;
  const docElement=new Element();
  const globals={HTMLElement:Element,document:Object.assign(new EventTarget(),{referrer:'',visibilityState:'visible',scrollingElement:docElement}),
    window:new EventTarget(),innerHeight:800,innerWidth:1000,location:{href:'https://site.example/'},history:{pushState(){},replaceState(){}},
    sessionStorage:{getItem(){reads++;return null;},setItem(){},removeItem(){}},
    fetch:async(_url:string,options:RequestInit)=>{requests.push(JSON.parse(options.body as string).events);return {ok:!fail,status:fail?503:202};}};
  for(const [key,value] of Object.entries(globals)){original.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const tracker=createTracker({projectId:'interactions',collectionUrl:'/api/collect',publicPath:url=>['/','/second'].includes(url.pathname)?url.pathname:null});
  const button=new Element(),container=new Element();
  const fire=(top:number)=>{container.scrollTop=top;container.dispatchEvent(new Event('scroll'));};
  const drain=async()=>{await new Promise(r=>setImmediate(r));await tracker.flush();};
  const scrolls=()=>requests.flat().filter((e):e is ScrollEvent=>e.type==='scroll');
  try {
    const click=tracker.trackClick(button as unknown as HTMLElement,{name:'play-button',isPublic:()=>publicScope});
    const scroll=tracker.trackScroll(container as unknown as HTMLElement,{scopeId:'feed',isPublic:()=>publicScope});
    tracker.trackScroll(globals.document as unknown as Document,{scopeId:'document',isPublic:()=>true});
    assert.equal(reads,0);button.dispatchEvent(new Event('click'));fire(200);assert.equal(tracker.recordEvent({name:'filter-selected',isPublic:()=>true}),false);await drain();assert.equal(requests.length,0);
    container.scrollTop=0;tracker.start();await drain();
    button.dispatchEvent(new Event('click'));tracker.recordEvent({name:'filter-selected',isPublic:()=>true});fire(200);fire(200);await drain();
    assert.deepEqual(scrolls().map(e=>e.milestone),[25]);
    assert.equal(requests.flat().filter(e=>e.type==='click').length,1);assert.equal(requests.flat().filter(e=>e.type==='custom').length,1);
    fire(0);fire(800);await drain();assert.deepEqual(scrolls().map(e=>e.milestone),[25,50,75,100]);
    container.scrollHeight=1800;fire(900);fire(1600);await drain();assert.equal(scrolls().length,4,'growth does not reset thresholds');
    const firstView=scrolls()[0].viewId;globals.location.href='https://site.example/second';tracker.recordRoute();await drain();fire(0);fire(400);await drain();
    assert.equal(scrolls().length,5);assert.notEqual(scrolls()[4].viewId,firstView);assert.equal(scrolls()[4].path,'/second');
    tracker.pageView();fire(800);await drain();assert.equal(scrolls().length,7,'explicit page view creates a new threshold scope');
    publicScope=false;const before=requests.flat().length;button.dispatchEvent(new Event('click'));fire(1600);assert.equal(tracker.recordEvent({name:'secret-action',isPublic:()=>false}),false);await drain();assert.equal(requests.flat().length,before);
    publicScope=true;globals.location.href='https://site.example/admin';tracker.recordRoute();button.dispatchEvent(new Event('click'));fire(0);fire(1600);await drain();assert.equal(requests.flat().length,before);
    globals.location.href='https://site.example/';tracker.recordRoute();await drain();fire(0);
    globals.document.visibilityState='hidden';fire(800);await drain();assert.equal(scrolls().length,7);
    globals.document.visibilityState='visible';container.offscreen=true;fire(1600);await drain();assert.equal(scrolls().length,7);
    container.offscreen=false;fire(0);container.scrollHeight=200;fire(1);await drain();assert.equal(scrolls().length,7,'non-scrollable content is not completion');
    docElement.scrollTop=800;globals.document.dispatchEvent(new Event('scroll'));await drain();assert.deepEqual(scrolls().filter(e=>e.scopeId==='document').map(e=>e.milestone),[25,50,75,100]);
    assert.equal(tracker.recordEvent({name:'https://secret.example',isPublic:()=>true}),false);
    assert.equal(tracker.recordEvent({name:'name',isPublic:()=>{throw Error('unknown visibility');}}),false);
    fail=true;tracker.recordEvent({name:'retry',isPublic:()=>true});await drain();const id=requests.at(-1)![0].eventId;fail=false;await tracker.flush();assert.equal(requests.at(-1)![0].eventId,id);
    click.detach();scroll.detach();const count=requests.flat().length;button.dispatchEvent(new Event('click'));fire(0);fire(1600);await drain();assert.equal(requests.flat().length,count);
    tracker.stop();docElement.scrollTop=0;globals.document.dispatchEvent(new Event('scroll'));docElement.scrollTop=800;globals.document.dispatchEvent(new Event('scroll'));await drain();assert.equal(requests.flat().length,count);
    assert(!JSON.stringify(requests).includes('secret'));
  }finally{tracker.stop();for(const[key,value]of original){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});
