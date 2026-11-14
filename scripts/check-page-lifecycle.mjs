// Real Chromium back/forward-cache evidence; no production service or data.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile), events=[];
const bundle=await readFile('packages/tracker/dist/tracker.js');
const server=createServer(async(req,res)=>{
  if(req.url==='/tracker.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}
  if(req.url==='/collect'){
    let body='';for await(const chunk of req)body+=chunk;
    events.push(...JSON.parse(body).events);res.end('{}');return;
  }
  res.setHeader('Content-Type','text/html');
  if(req.url==='/away'){res.end('<title>Away</title><p>Separate document</p>');return;}
  res.end(`<!doctype html><title>Lifecycle fixture</title><a href="/away">Leave</a><button onclick="window.child=window.open('/','analytics-child')">Open child</button>
<script src="/tracker.js"></script><script>
window.marker=crypto.randomUUID();window.restores=0;
addEventListener('pageshow',e=>{if(e.persisted)restores++});
window.tracker=SiteAnalytics.createTracker({projectId:'lifecycle',collectionUrl:'/collect',publicPath:u=>localStorage.getItem('consent')==='yes'&&u.pathname==='/'?'/':null});
</script>`);
});
const browser=async(...args)=>(await exec('node_modules/.bin/agent-browser',['--session','analytics-lifecycle',...args],{timeout:60000})).stdout;
const evaluate=async code=>JSON.parse(await browser('eval',code));
const settle=()=>new Promise(r=>setTimeout(r,2500));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
try{
  await browser('--args','--no-sandbox','open',url);
  await evaluate("localStorage.setItem('consent','yes');tracker.start();true");await settle();
  assert.equal(events.length,1);const marker=await evaluate('marker');
  await browser('click','a');await browser('back');await settle();
  const restored=await evaluate('({marker,restores})');
  assert.equal(restored.marker,marker,'must restore the same document, not reload');
  assert.equal(restored.restores,1,'must observe a real persisted pageshow');
  assert.equal(events.length,2);assert.equal(events[0].sessionId,events[1].sessionId);
  assert.notEqual(events[0].eventId,events[1].eventId);
  await evaluate('tracker.recordRoute();true');await settle();assert.equal(events.length,2);
  await evaluate("localStorage.setItem('consent','no');tracker.stop();true");
  await browser('click','a');await browser('back');await settle();
  assert.equal(await evaluate('restores'),2);assert.equal(events.length,2);
  console.log('PASS: real persisted pageshow, same-document restore, fresh view, session continuity, route deduplication and withdrawal');
  await evaluate("localStorage.setItem('consent','yes');tracker.start();true");await settle();
  const parentSession=events.at(-1).sessionId;
  await browser('click','button');await settle();
  assert.equal(await evaluate('!!window.child && !child.closed'),true,'child browsing context must exist');
  assert.equal(await evaluate("JSON.parse(child.sessionStorage.getItem('site-analytics:session:v1:lifecycle')).id"),parentSession,'fixture must actually copy opener storage');
  await evaluate('child.tracker.start();true');await settle();
  const childSession=events.at(-1).sessionId;
  assert.notEqual(childSession,parentSession,'child must not reuse copied parent session');
  await evaluate('child.location.reload();true');await settle();await evaluate('child.tracker.start();true');await settle();
  assert.equal(events.at(-1).sessionId,childSession,'child reload preserves its own session');
  await evaluate('tracker.pageView();tracker.flush();true');await settle();
  assert.equal(events.at(-1).sessionId,parentSession,'child must not change parent session');
  console.log('PASS: actual opener storage copy, child session isolation, child reload continuity and unchanged parent');
}finally{await browser('close').catch(()=>{});await new Promise(r=>server.close(r));}
