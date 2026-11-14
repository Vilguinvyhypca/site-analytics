import test from 'node:test';
import assert from 'node:assert/strict';
import { createImpressions } from '../packages/tracker/src/impressions.js';

test('thumbnail impressions require continuous visibility and reset at privacy, route and consent boundaries', () => {
  class Element { isConnected = true; }
  let callback: (changes: unknown[]) => void = () => {}, tick = () => {}, now = 0, view: string | undefined = 'one';
  let observers = 0, disconnected = 0, publicContent = true;
  const events: string[] = [];
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const globals = {
    HTMLElement: Element, document: doc, performance: { now: () => now },
    IntersectionObserver: class {
      constructor(cb: typeof callback) { callback = cb; observers++; }
      observe() {} unobserve() {} disconnect() { disconnected++; }
    },
    setInterval: (cb: () => void) => { tick = cb; return 1; }, clearInterval: () => { tick = () => {}; }
  };
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{configurable:true,writable:true,value}); }
  const manager = createImpressions({view: () => view, emit: action => { events.push(action.contentId); return true; }});
  const first = new Element() as HTMLElement, duplicate = new Element() as HTMLElement;
  const settings = {contentId:'photo-one',contentType:'photo' as const,isPublic:() => publicContent};
  const visible = (target: HTMLElement, ratio: number) => callback([{target,isIntersecting:ratio > 0,intersectionRatio:ratio}]);
  const advance = (ms: number) => { now += ms; tick(); };
  try {
    const handle = manager.register(first,settings); manager.register(duplicate,settings);
    assert.equal(observers,0); advance(2000); assert.deepEqual(events,[]);
    manager.start(); visible(first,0.49); advance(2000); assert.deepEqual(events,[]);
    visible(first,0.5); advance(750); visible(first,0); visible(first,1); advance(750); assert.deepEqual(events,[]);
    advance(250); assert.deepEqual(events,['photo-one']);
    visible(duplicate,1); advance(2000); assert.equal(events.length,1,'same content deduplicated across elements');
    view='two'; tick(); advance(750); doc.visibilityState='hidden'; doc.dispatchEvent(new Event('visibilitychange')); advance(1000);
    doc.visibilityState='visible'; doc.dispatchEvent(new Event('visibilitychange')); tick(); advance(750); assert.equal(events.length,1);
    advance(250); assert.equal(events.length,2);
    view='three'; tick(); advance(750); publicContent=false; tick(); publicContent=true; tick(); advance(750); assert.equal(events.length,2);
    advance(250); assert.equal(events.length,3);
    view=undefined; tick(); advance(2000); assert.equal(events.length,3);
    view='four'; tick(); advance(750); manager.stop(); advance(2000); assert.equal(events.length,3); assert.equal(disconnected,1);
    manager.start(); advance(2000); assert.equal(events.length,3,'new consent requires fresh observer visibility');
    visible(first,1); advance(1000); assert.equal(events.length,4);
    handle.detach(); handle.detach(); view='five'; tick(); visible(first,1); advance(2000); assert.equal(events.length,4);
    assert.throws(() => manager.register(duplicate,settings));
    assert.throws(() => manager.register(new Element() as HTMLElement,{...settings,contentId:'https://private'}));
  } finally { manager.stop(); for(const [key,value] of originals) { if(value) Object.defineProperty(globalThis,key,value); else Reflect.deleteProperty(globalThis,key); } }
});
