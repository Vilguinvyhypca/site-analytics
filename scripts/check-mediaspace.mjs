// Development-only two-site pilot with synthetic catalog and disposable PostgreSQL.
import {mkdtemp, mkdir, writeFile, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import pg from 'pg';
import {startDatabase} from './database.mjs';
import {migrate} from './migrate.mjs';
import {createApp} from '../apps/api/src/app.ts';
import {postgresStore} from '../apps/api/src/collection.ts';
const exec=promisify(execFile), pilot=resolve(process.env.MEDIASPACE_PILOT_DIR ?? '../mediaspace-analytics-reconciled');
const files=await readdir(pilot);
assert(!files.some(name=>name==='release.json'||/^\.env(?:\.(?:local|development|production|test)(?:\.local)?)?$/.test(name)), 'Use an isolated checkout without release manifests or environment files');
const temp=await mkdtemp(join(tmpdir(),'analytics-mediaspace-'));
const browser=async(...args)=>(await exec('node_modules/.bin/agent-browser',['--session','analytics-mediaspace',...args],{timeout:60000})).stdout;
const evaluate=async code=>JSON.parse(await browser('eval',code));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async expression=>{
  for(let attempt=0;attempt<3;attempt++){
    try{return await evaluate(`(async()=>{for(let i=0;i<150;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,100));}throw Error('Condition timed out');})()`);}
    catch(error){if(attempt===2||!/Execution context was destroyed|Cannot find context/.test(String(error)))throw error;await wait(250);}
  }
};
let database,pool,app,server;let serverLog='';
const collectionPayloads=[];
const count=async()=>(await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n;
const events=async project=>(await pool.query('SELECT payload FROM events WHERE project_id=$1 ORDER BY received_at,event_id',[project])).rows.map(r=>r.payload);
try {
  await mkdir(join(pilot,'public/uploads'),{recursive:true});
  await writeFile(join(pilot,'public/uploads/analytics-pilot.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64'));
  await exec('ffmpeg',['-y','-f','lavfi','-i','testsrc=size=160x240:rate=15','-t','12','-c:v','libvpx','-pix_fmt','yuv420p',join(pilot,'public/uploads/analytics-pilot.webm')]);
  const media=[{id:'local:pilot-photo',type:'photo',url:'/uploads/analytics-pilot.png'},...Array.from({length:4},(_,i)=>({id:`local:pilot-video-${i}`,type:'video',url:'/uploads/analytics-pilot.webm'}))].map(item=>({...item,title:item.id,album:'Pilot',visibility:'public',createdAt:new Date().toISOString()}));
  media.push({...media[0],id:'private-pilot',visibility:'private'}, {...media[0],id:'unlisted-pilot',visibility:'unlisted'});
  await writeFile(join(temp,'media.json'),JSON.stringify(media));
  database=await startDatabase(join(temp,'pg'),55439);
  const dbUrl='postgresql://analytics_dev:local-development-only@127.0.0.1:55439/site_analytics_dev';
  await migrate(dbUrl);pool=new pg.Pool({connectionString:dbUrl});
  await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('mediaspace-pilot','MediaSpace pilot',true,ARRAY['http://127.0.0.1:4320']),('static-pilot','Static pilot',true,ARRAY['http://127.0.0.1:4315'])");
  app=createApp(postgresStore(pool));
  app.addHook('preValidation',async request=>{
    if(request.method==='POST'&&request.url==='/api/collect')collectionPayloads.push(JSON.stringify(request.body));
  });
  app.get('/static',async(_request,reply)=>reply.type('text/html').send(`<!doctype html><title>Independent site</title><script src="/api/tracker.js"></script><button onclick="tracker.start()">Allow analytics</button><script>const tracker=SiteAnalytics.createTracker({projectId:'static-pilot',collectionUrl:'/api/collect',publicPath:u=>u.pathname==='/static'?'/static':null});</script>`));
  await app.listen({port:4315,host:'127.0.0.1'});
  server=spawn(process.execPath,[join(pilot,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','4320','-H','127.0.0.1'],{cwd:pilot,env:{...process.env,DATABASE_URL:'',DATABASE_URL_DATABASE_URL:'',POSTGRES_URL:'',MEDIA_DATA_DIR:temp,MEDIA_UPLOAD_PROVIDER:'',NEXTAUTH_SECRET:'synthetic-pilot-secret-only-1234567890',NEXTAUTH_URL:'http://127.0.0.1:4320',ADMIN_PASSWORD:'synthetic-pilot-admin',NEXT_PUBLIC_FULLSTORY_ENABLED:'false',NEXT_PUBLIC_SITE_ANALYTICS_ENABLED:'true',NEXT_PUBLIC_SITE_ANALYTICS_PROJECT_ID:'mediaspace-pilot',NEXT_PUBLIC_SITE_ANALYTICS_COLLECTION_URL:'http://127.0.0.1:4315/api/collect'},stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk).slice(-12000);});
  for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:4320/api/auth/session')).ok)break;}catch{}if(i===119)throw Error(serverLog);await wait(1000);}
  // This checkout uses the slower WASM compiler. Compile routes before CDP navigation.
  for (const path of ['/', '/photos', '/feed', '/api/media']) {
    const response=await fetch(`http://127.0.0.1:4320${path}`,{signal:AbortSignal.timeout(240000)});
    assert.equal(response.status,200);await response.text();
  }
  const retired=await fetch('http://127.0.0.1:4320/api/experience',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(retired.status,410,'stale clients cannot write legacy events');
  assert.equal((await fetch('http://127.0.0.1:4320/api/experience')).status,401,'historical reports remain protected');
  console.log('PASS: retired legacy writes and private historical reports');
  await browser('--args','--no-sandbox','open','http://127.0.0.1:4320/');
  await waitFor("document.querySelector('[aria-label=\"Visitor analytics preferences\"]')");
  await waitFor("document.querySelector('a[data-media-overlay][href*=photos]')");
  await evaluate("document.querySelector('a[data-media-overlay][href*=photos]').scrollIntoView({block:'center'});true");
  await wait(1800);assert.equal(await count(),0);assert.equal(await evaluate("!!window.SiteAnalytics"),false,'no tracker loaded before consent');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Allow analytics').click();true");
  await waitFor('!!window.SiteAnalytics');await wait(3500);
  let data=await events('mediaspace-pilot');assert.equal(data.filter(e=>e.type==='page_view').length,1,'one initial page view, no duplicate provider collection');assert(data.some(e=>e.type==='content_impression'));
  // Real Next Link navigation at a narrow viewport, retaining the same document/session.
  await browser('set','viewport','390','844');
  const navigationSession=data.find(e=>e.type==='page_view').sessionId;
  await evaluate("window.navigationMarker='same-document';document.querySelector('a[href=\"/photos\"]').click();true");
  await waitFor("location.pathname==='/photos' && document.querySelector('a[data-media-overlay]')");await wait(2500);
  await browser('back');await waitFor("location.pathname==='/'");await wait(2500);
  await browser('forward');await waitFor("location.pathname==='/photos'");await wait(2500);
  await evaluate("document.querySelector('a[href=\"/\"]').click();true");await waitFor("location.pathname==='/' && document.querySelector('a[data-media-overlay]')");await wait(2500);
  let navigationViews=(await events('mediaspace-pilot')).filter(e=>e.type==='page_view');
  assert.deepEqual(navigationViews.map(e=>e.path),['/','/photos','/','/photos','/']);
  assert(navigationViews.every(e=>e.sessionId===navigationSession));assert.equal(await evaluate('window.navigationMarker'),'same-document');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,'narrow gallery has no horizontal overflow');
  await evaluate("history.pushState({},'', '/?token=PRIVATE_NAV_SENTINEL');true");await wait(2500);
  const excludedBaseline=await count();
  await evaluate("document.querySelector('a[data-media-overlay][href*=photos]').click();true");await wait(1500);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Close').click();true");await wait(1500);
  assert.equal(await count(),excludedBaseline,'consented excluded query blocks content actions');
  await browser('back');await waitFor("location.pathname==='/' && !location.search");await wait(2500);
  await evaluate("location.hash='PRIVATE_NAV_SENTINEL';true");await wait(2500);
  const fragmentBaseline=await count();await wait(1500);assert.equal(await count(),fragmentBaseline);
  await browser('back');await waitFor("!location.hash");await wait(2500);
  navigationViews=(await events('mediaspace-pilot')).filter(e=>e.type==='page_view');
  assert.deepEqual(navigationViews.map(e=>e.path),['/','/photos','/','/photos','/','/','/']);
  assert.equal(await evaluate('window.navigationMarker'),'same-document');
  await browser('set','viewport','1280','720');
  console.log('PASS: real SPA links, back/forward, same-tab session, narrow viewport, consented excluded query/fragment and return');
  await browser('fill','#media-search','PRIVATE_SEARCH_SENTINEL');await wait(2000);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Clear').click();true");
  await waitFor("document.querySelector('#media-search').value==='' && document.querySelector('a[data-media-overlay][href*=photos]')");await wait(2500);
  await evaluate("document.querySelector('a[data-media-overlay][href*=photos]').click();true");await wait(1000);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Share').click();true");await wait(1000);
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Close').click();true");
  await evaluate("document.querySelector('a[data-media-overlay][href*=videos]').click();true");
  await waitFor('!!document.querySelector(\'[role="dialog"] video\')');
  await evaluate("(async()=>{const v=document.querySelector('[role=dialog] video');v.muted=true;await v.play();return true;})()");await wait(6500);
  await evaluate("document.querySelector('[aria-label=\"Close video viewer\"]').click();true");await wait(1500);
  data=await events('mediaspace-pilot');assert(data.some(e=>e.type==='content_open'));assert(data.some(e=>e.type==='share'&&e.outcome==='clicked'));assert(data.some(e=>e.type==='playback_progress'&&e.engagedSeconds>0));
  await browser('open','http://127.0.0.1:4320/feed');await waitFor("document.querySelector('main[aria-label=\"Video feed\"] article')");await wait(1500);
  await evaluate("document.querySelector('main[aria-label=\"Video feed\"]').scrollTop=99999;true");await wait(3000);
  assert((await events('mediaspace-pilot')).some(e=>e.type==='scroll'&&e.scopeId==='video-feed'));
  await evaluate("window.visibilityRecords=[];document.addEventListener('visibilitychange',()=>visibilityRecords.push(document.visibilityState));true");
  const firstTabSession=await evaluate("JSON.parse(sessionStorage.getItem('site-analytics:session:v1:mediaspace-pilot')).id");
  await browser('tab','new','http://127.0.0.1:4320/');await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='Turn off visitor analytics')");await wait(3000);
  const secondTabSession=await evaluate("JSON.parse(sessionStorage.getItem('site-analytics:session:v1:mediaspace-pilot')).id");assert.notEqual(firstTabSession,secondTabSession,'tabs have separate anonymous sessions');
  const progressForFirstTab=async()=>{
    const latest=new Map();
    for(const event of await events('mediaspace-pilot'))if(event.sessionId===firstTabSession&&event.type==='playback_progress'){
      if(!latest.has(event.playbackId)||event.sequence>latest.get(event.playbackId).sequence)latest.set(event.playbackId,event);
    }
    return [...latest.values()].reduce((sum,event)=>sum+event.engagedSeconds,0);
  };
  const hiddenEngagement=await progressForFirstTab();await wait(5500);
  assert.equal(await progressForFirstTab(),hiddenEngagement,'background tab does not accumulate watch time');

  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Turn off visitor analytics').click();true");
  await browser('tab','0');await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='Allow visitor analytics')");await wait(500);
  assert.equal(await evaluate("visibilityRecords.includes('hidden')"),true,'the original tab actually became hidden');
  let before=await count();await wait(6000);assert.equal(await count(),before,'withdrawal propagates to playing tab');
  await browser('tab','close','1');
  console.log('PASS: stored consent, separate tab sessions, actual background watch-time exclusion and cross-tab withdrawal');
  await browser('open','http://127.0.0.1:4320/?token=secret');await wait(2000);assert.equal(await count(),before);
  await browser('open','http://127.0.0.1:4320/');await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='Allow visitor analytics')");
  await evaluate("window.savedGet=Storage.prototype.getItem;window.savedSet=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(this===localStorage)throw Error('blocked');return savedGet.call(this,key)};Storage.prototype.setItem=function(key,value){if(this===localStorage)throw Error('blocked');return savedSet.call(this,key,value)};window.dispatchEvent(new Event('storage'));true");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent==='Allow analytics')");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Allow analytics').click();true");await wait(2500);assert.equal(await count(),before,'unavailable consent storage fails closed');
  await evaluate("Storage.prototype.getItem=savedGet;Storage.prototype.setItem=savedSet;window.dispatchEvent(new Event('storage'));true");
  const memoryBaseline=(await events('mediaspace-pilot')).length;
  await evaluate("Storage.prototype.getItem=function(key){if(this===sessionStorage)throw Error('blocked');return savedGet.call(this,key)};Storage.prototype.setItem=function(key,value){if(this===sessionStorage)throw Error('blocked');return savedSet.call(this,key,value)};[...document.querySelectorAll('button')].find(b=>b.textContent==='Allow visitor analytics').click();true");await wait(3000);
  await waitFor("document.querySelector('a[data-media-overlay][href*=photos]')");await evaluate("document.querySelector('a[data-media-overlay][href*=photos]').click();true");await wait(2000);
  const memoryEvents=(await events('mediaspace-pilot')).slice(memoryBaseline);assert(memoryEvents.some(e=>e.type==='page_view'));assert(memoryEvents.some(e=>e.type==='content_open'));assert.equal(new Set(memoryEvents.map(e=>e.sessionId)).size,1,'unavailable session storage uses one in-memory session');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Turn off visitor analytics').click();Storage.prototype.getItem=savedGet;Storage.prototype.setItem=savedSet;true");await wait(500);before=await count();
  console.log('PASS: blocked consent storage fails closed; blocked session storage uses memory');
  // A stored opt-in still cannot record authenticated administrators.
  await evaluate("(async()=>{localStorage.setItem('mediaspace:self-hosted-analytics-consent:v1','accepted');const csrf=await (await fetch('/api/auth/csrf')).json();await fetch('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,password:'synthetic-pilot-admin',json:'true'})});return true;})()");
  await browser('open','http://127.0.0.1:4320/');await wait(3000);assert.equal(await evaluate("(async()=>!!(await (await fetch('/api/auth/session')).json()).user)()"),true);assert.equal(await evaluate("!!window.SiteAnalytics"),false);assert.equal(await count(),before);
  await browser('open','http://127.0.0.1:4315/static');await wait(1000);assert.equal((await events('static-pilot')).length,0);await browser('click','button');await wait(1500);assert.equal((await events('static-pilot')).length,1);
  const payload=JSON.stringify(await events('mediaspace-pilot'));assert(!payload.includes(`c_${Buffer.from('private-pilot').toString('hex')}`));assert(!payload.includes(`c_${Buffer.from('unlisted-pilot').toString('hex')}`));assert(!(await readdir(temp)).includes('experience'),'no parallel legacy event files');assert(!payload.includes('/uploads/'));assert(!payload.includes('token=secret'));assert(!payload.includes('PRIVATE_NAV_SENTINEL'));
  assert(collectionPayloads.length>0,'inspect actual collector request bodies, not only retained rows');
  const wire=collectionPayloads.join('\n');
  for(const forbidden of ['PRIVATE_SEARCH_SENTINEL','PRIVATE_NAV_SENTINEL','/uploads/','token=secret',`c_${Buffer.from('private-pilot').toString('hex')}`,`c_${Buffer.from('unlisted-pilot').toString('hex')}`])assert(!wire.includes(forbidden),`collector payload leaked ${forbidden}`);
  console.log(`PASS: inspected ${collectionPayloads.length} collector requests; no search text, excluded URL data, media URLs or private/unlisted IDs`);
  console.log('PASS: real MediaSpace consent, thumbnails, overlays, share click, native playback, internal feed scroll, withdrawal, excluded URL, authenticated exclusion, and independent static project');
} catch(error){console.error(serverLog);console.error(await browser('errors').catch(()=> 'Browser diagnostics unavailable'));console.error(await browser('get','url').catch(()=> 'Browser URL unavailable'));throw error;}
finally {
  await browser('close').catch(()=>{});
  if(server){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),wait(5000)]);if(server.exitCode===null)server.kill('SIGKILL');}
  await app?.close();await pool?.end();await database?.stop();
  await rm(temp,{recursive:true,force:true});
  for(const name of ['analytics-pilot.png','analytics-pilot.webm'])await rm(join(pilot,'public/uploads',name),{force:true});
}
