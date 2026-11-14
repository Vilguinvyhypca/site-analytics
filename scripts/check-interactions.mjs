// Isolated browser → tracker → collector → database → owner dashboard check.
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { startDatabase } from './database.mjs';
import { migrate } from './migrate.mjs';
import { setOwner } from './set-owner.mjs';
import { createApp } from '../apps/api/src/app.ts';
import { postgresStore } from '../apps/api/src/collection.ts';
import { postgresAdminStore } from '../apps/api/src/admin-store.ts';
const exec=promisify(execFile);
const browser=async(...args)=>(await exec('node_modules/.bin/agent-browser',['--session','analytics-interactions',...args],{timeout:30000})).stdout;
const evaluate=async code=>JSON.parse(await browser('eval',code));
const waitFor=expression=>evaluate(`(async()=>{for(let i=0;i<100;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,100));}throw Error('Expected '+${JSON.stringify(expression)});})()`);
const directory=await mkdtemp(join(tmpdir(),'analytics-interactions-'));
let database,pool,app;
const rows=async()=>(await pool.query("SELECT payload FROM events WHERE project_id='interactions-browser' ORDER BY received_at,event_id")).rows.map(r=>r.payload);
try{
  database=await startDatabase(directory,55438);const url='postgresql://analytics_dev:local-development-only@127.0.0.1:55438/site_analytics_dev';
  await migrate(url);pool=new pg.Pool({connectionString:url});await setOwner(pool,'synthetic-interactions-password');
  await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('interactions-browser','Interaction fixture',true,ARRAY['http://127.0.0.1:4314'])");
  app=createApp(postgresStore(pool),{store:postgresAdminStore(pool),origin:'http://127.0.0.1:4314',secret:randomBytes(32).toString('hex')});
  app.get('/fixture',async(_request,reply)=>reply.type('text/html').send(`<!doctype html><title>Interaction fixture</title>
    <div id="outer"><button id="tracked">PRIVATE_TEXT_NOT_COLLECTED</button><input value="PRIVATE_INPUT_NOT_COLLECTED"></div>
    <button id="custom">Custom action</button>
    <div id="thumbnail" style="position:fixed;right:0;top:0;width:80px;height:80px">Thumbnail</div>
    <div id="feed" style="height:200px;width:320px;overflow:auto"><div id="items" style="height:1000px">PRIVATE_FEED_TEXT</div></div>
    <div style="height:2000px"></div><script src="/api/tracker.js"></script><script>
    window.publicScope=true;window.feed=document.getElementById('feed');
    window.publicThumbnail=false;
    window.tracker=SiteAnalytics.createTracker({projectId:'interactions-browser',collectionUrl:'/api/collect',publicPath:u=>['/fixture','/next'].includes(u.pathname)?u.pathname:null});
    tracker.trackClick(document.getElementById('tracked'),{name:'play-button',isPublic:()=>publicScope});
    tracker.trackClick(document.getElementById('outer'),{name:'outer',isPublic:()=>publicScope});
    window.feedHandle=tracker.trackScroll(feed,{scopeId:'feed',isPublic:()=>publicScope});
    tracker.trackScroll(document,{scopeId:'document',isPublic:()=>true});
    tracker.trackImpression(document.getElementById('thumbnail'),{contentId:'public-photo',contentType:'photo',isPublic:()=>publicThumbnail});
    document.getElementById('custom').onclick=()=>tracker.recordEvent({name:'filter-selected',isPublic:()=>publicScope});
    window.wait=ms=>new Promise(r=>setTimeout(r,ms));
    window.drain=async()=>{await wait(150);await tracker.flush();await wait(150);await tracker.flush();};
    </script>`));
  app.get('/*',async(request,reply)=>{
    const name=request.url==='/'?'index.html':request.url.slice(1);
    if(!/^[A-Za-z0-9_.-]+\.(?:html|js|css)$/.test(name))return reply.code(404).send();
    try{return reply.type(name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html').send(await readFile(new URL(`../apps/dashboard/dist/dashboard/browser/${name}`,import.meta.url)));}catch{return reply.code(404).send();}
  });
  await app.listen({port:4314,host:'127.0.0.1'});
  await browser('--args','--no-sandbox','open','http://127.0.0.1:4314/fixture');
  await browser('click','#tracked');await browser('click','#custom');
  await evaluate('(async()=>{feed.scrollTop=800;await drain();return true;})()');assert.equal((await rows()).length,0);
  await evaluate('(async()=>{feed.scrollTop=0;await wait(150);tracker.start();await drain();return true;})()');
  await browser('click','#tracked');await browser('click','#custom');
  await evaluate('(async()=>{feed.scrollTop=200;await drain();return true;})()');
  let data=await rows();assert.equal(data.filter(e=>e.type==='click').length,1,'nested registered elements count one click');assert.equal(data.find(e=>e.type==='click').name,'play-button');assert.equal(data.filter(e=>e.type==='custom').length,1);
  assert.deepEqual(data.filter(e=>e.type==='scroll'&&e.scopeId==='feed').map(e=>e.milestone),[25]);
  await evaluate('(async()=>{feed.scrollTop=0;await wait(100);feed.scrollTop=800;await drain();return true;})()');
  data=await rows();const firstView=data.find(e=>e.type==='scroll').viewId;
  assert.deepEqual(data.filter(e=>e.type==='scroll'&&e.scopeId==='feed').map(e=>e.milestone).sort((a,b)=>a-b),[25,50,75,100]);
  await evaluate('(async()=>{document.getElementById("items").style.height="1800px";feed.scrollTop=1600;await drain();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='scroll'&&e.scopeId==='feed').length,4,'dynamic growth does not duplicate');
  await evaluate('(async()=>{history.pushState({},"","/next");await wait(150);feed.scrollTop=0;await wait(100);feed.scrollTop=1600;await drain();return true;})()');
  data=await rows();const next=data.filter(e=>e.type==='scroll'&&e.scopeId==='feed'&&e.viewId!==firstView);assert.equal(next.length,4);assert(next.every(e=>e.path==='/next'));
  await evaluate('(async()=>{window.scrollTo(0,document.documentElement.scrollHeight);await drain();return true;})()');
  assert.deepEqual((await rows()).filter(e=>e.type==='scroll'&&e.scopeId==='document').map(e=>e.milestone).sort((a,b)=>a-b),[25,50,75,100]);
  const before=(await rows()).length;
  await evaluate('(async()=>{publicScope=false;document.getElementById("tracked").click();document.getElementById("custom").click();feed.scrollTop=0;await wait(100);feed.scrollTop=1600;await drain();return true;})()');assert.equal((await rows()).length,before);
  await evaluate('(async()=>{history.pushState({},"","/admin");await wait(100);publicScope=true;document.getElementById("tracked").click();document.getElementById("custom").click();feed.scrollTop=0;await wait(100);feed.scrollTop=1600;await drain();return true;})()');assert.equal((await rows()).length,before);
  await evaluate('(async()=>{tracker.stop();history.pushState({},"","/fixture");document.getElementById("tracked").click();document.getElementById("custom").click();feed.scrollTop=0;await wait(100);feed.scrollTop=1600;await drain();return true;})()');assert.equal((await rows()).length,before);
  assert(!JSON.stringify(await rows()).includes('PRIVATE_'));
  // Actual IntersectionObserver, consent and collector delivery for thumbnails.
  await evaluate('(async()=>{publicThumbnail=true;await wait(1400);await drain();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='content_impression').length,0,'withdrawn consent blocks impressions');
  await evaluate('(async()=>{tracker.start();await wait(1500);await drain();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='content_impression').length,1);
  await evaluate('(async()=>{await wait(1400);await drain();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='content_impression').length,1,'visible thumbnail counted once');
  await evaluate('(async()=>{history.pushState({},"","/next");await wait(1600);await drain();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='content_impression').length,2,'new route allows another impression');
  await evaluate('(async()=>{publicThumbnail=false;history.pushState({},"","/fixture");await wait(1600);await drain();tracker.stop();return true;})()');
  assert.equal((await rows()).filter(e=>e.type==='content_impression').length,2,'private thumbnails excluded');
  // Now inspect the actual owner dashboard, not a mocked report.
  await browser('open','http://127.0.0.1:4314/');await waitFor("document.getElementById('password')");
  await evaluate("document.getElementById('password').value='synthetic-interactions-password';document.querySelector('form').requestSubmit();true");
  await waitFor("document.getElementById('report-project')?.options.length===2");
  const day=new Date().toISOString().slice(0,10);
  await evaluate(`Object.entries(${JSON.stringify({'report-project':'interactions-browser','report-start':day,'report-end':day,'report-zone':'UTC'})}).forEach(([id,value])=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});document.getElementById('report-filters').requestSubmit();true`);
  await waitFor("document.getElementById('interaction-totals')?.textContent.includes('Scroll milestones: 12')");
  const totals=await evaluate("document.getElementById('interaction-totals').textContent");assert(totals.includes('Clicks: 1'));assert(totals.includes('Custom events: 1'));
  assert((await evaluate("document.getElementById('interaction-table').textContent")).includes('filter-selected'));
  const interactionSession=(await rows()).find(e=>e.type==='click').sessionId;
  await evaluate(`[...document.querySelectorAll('#session-table tbody tr')].find(row=>row.textContent.includes(${JSON.stringify(interactionSession)})).querySelector('button').click();true`);await waitFor("document.getElementById('session-timeline')?.textContent.includes('Scroll: feed')");
  const timeline=await evaluate("document.getElementById('session-timeline').textContent");assert(timeline.includes('Click: play-button'));assert(timeline.includes('Custom event: filter-selected'));
  assert.equal((await browser('errors')).trim(),'');
  console.log('PASS: thumbnail impressions, consent, nested click deduplication, custom action, document/container thresholds, growth, route reset, private/excluded routes, withdrawal, no scraped data, real dashboard counts and timeline; no browser errors');
}finally{await browser('close').catch(()=>{});await app?.close();await pool?.end();await database?.stop();await rm(directory,{recursive:true,force:true});}
