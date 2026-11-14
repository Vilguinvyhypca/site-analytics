// Disposable browser → authenticated API → PostgreSQL reporting regression.
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import pg from 'pg';
import { pressBrowserEnter } from './browser-keyboard.mjs';
import { startDatabase } from './database.mjs';
import { migrate } from './migrate.mjs';
import { setOwner } from './set-owner.mjs';
import { createApp } from '../apps/api/src/app.ts';
import { postgresAdminStore } from '../apps/api/src/admin-store.ts';
const execute = promisify(execFile);
const browser = async (...args) => (await execute('node_modules/.bin/agent-browser', ['--session', 'analytics-report-regression', ...args], { timeout: 30000 })).stdout;
const evaluate = async code => JSON.parse(await browser('eval', code));
const waitFor = expression => evaluate(`(async()=>{for(let i=0;i<100;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,100));}throw new Error('Expected UI state: '+${JSON.stringify(expression)});})()`);
const filters = (id, start = '2026-03-08', end = '2026-03-10', zone = 'America/New_York') => evaluate(`Object.entries(${JSON.stringify({ 'report-project': id, 'report-start': start, 'report-end': end, 'report-zone': zone })}).forEach(([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));});true`);
const submit = () => evaluate("document.getElementById('report-filters').requestSubmit();true");
const directory = await mkdtemp(join(tmpdir(), 'analytics-report-browser-'));
let database, pool, app;
try {
  database = await startDatabase(directory, 55436);
  const url = 'postgresql://analytics_dev:local-development-only@127.0.0.1:55436/site_analytics_dev';
  await migrate(url);
  pool = new pg.Pool({ connectionString: url });
  await setOwner(pool, 'synthetic-report-password');
  await pool.query("INSERT INTO projects(id,name) VALUES('report-a','First website'),('report-b','Second website'),('report-empty','Empty website')");
  const sessionA = randomUUID(), sessionB = randomUUID();
  for (const [project, at, session, path, host] of [
    ['report-a', '2026-03-08T05:00:00Z', sessionA, '/first', 'search.example'],
    ['report-a', '2026-03-09T03:59:59Z', sessionB, '/first', null],
    ['report-a', '2026-03-09T04:00:00Z', sessionA, '/second', 'search.example'],
    ['report-b', '2026-03-08T12:00:00Z', sessionA, '/other-site', null]
  ]) await pool.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES($1,$2,$3,1,\'page_view\',$4,$5)', [project, randomUUID(), session, at, JSON.stringify({ path, referrerHost: host })]);
  const playbackId = randomUUID();
  for (const [type,at,payload] of [
    ['content_open','2026-03-08T05:00:00Z',{contentId:'video-demo',contentType:'video'}],
    ['share','2026-03-08T05:00:00Z',{contentId:'video-demo',outcome:'copied'}],
    ['playback_start','2026-03-08T05:00:00Z',{contentId:'video-demo',playbackId,autoplay:false}],
    ['playback_progress','2026-03-11T12:00:00Z',{contentId:'video-demo',playbackId,sequence:1,engagedSeconds:12,durationSeconds:12,coveredIntervals:[[0,12]],ended:true}]
  ]) await pool.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES($1,$2,$3,1,$4,$5,$6)', ['report-a',randomUUID(),sessionA,type,at,JSON.stringify(payload)]);
  app = createApp(undefined, { store: postgresAdminStore(pool), origin: 'http://127.0.0.1:4312', secret: randomBytes(32).toString('hex') });
  app.get('/*', async (request, reply) => {
    const name = request.url === '/' ? 'index.html' : request.url.slice(1);
    if (!/^[A-Za-z0-9_.-]+\.(?:html|js|css)$/.test(name)) return reply.code(404).send();
    try { return reply.type(name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html').send(await readFile(new URL(`../apps/dashboard/dist/dashboard/browser/${name}`, import.meta.url))); }
    catch { return reply.code(404).send(); }
  });
  await app.listen({ port: 4312, host: '127.0.0.1' });
  await mkdir('artifacts', { recursive: true });
  await browser('--args', '--no-sandbox', 'open', 'http://127.0.0.1:4312');
  await waitFor("document.getElementById('password')");
  await evaluate("document.getElementById('password').value='synthetic-report-password';document.querySelector('form').requestSubmit();true");
  await waitFor("document.getElementById('report-project')?.options.length===4");
  await filters('report-a'); await submit();
  await waitFor("document.getElementById('page-view-total')?.textContent==='3'");
  assert.equal(await evaluate("document.getElementById('session-total').textContent"), '2');
  assert((await evaluate("document.getElementById('pages-table').textContent")).includes('/first'));
  assert((await evaluate("document.getElementById('referrers-table').textContent")).includes('Unknown'));
  assert.equal(await evaluate("document.querySelectorAll('#daily-table tbody tr').length"), 3);
  assert.equal(await evaluate("document.querySelector('#daily-table tbody tr:last-child').textContent"), '2026-03-1000');
  assert.equal(await evaluate("document.querySelector('svg polyline').getAttribute('points').split(' ').length"), 3);
  await waitFor("document.getElementById('engaged-seconds')?.textContent==='12.0'");
  assert.equal(await evaluate("document.getElementById('content-opens').textContent"),'1');
  assert.equal(await evaluate("document.getElementById('playback-starts').textContent"),'1');
  assert((await evaluate("document.getElementById('playback-table').textContent")).includes('Completed (95%+ and ended)'));
  assert((await evaluate("document.getElementById('sharing-table').textContent")).includes('video-demo'));
  await evaluate("document.getElementById('engagement-heading').scrollIntoView();true");
  await browser('screenshot', 'artifacts/day-nine-engagement-desktop.png');
  await browser('screenshot', 'artifacts/day-eight-reports-desktop.png');
  // Native keyboard focus reaches the date fields and Enter submits the form.
  await evaluate("document.getElementById('report-project').focus();true");
  await browser('press', 'Tab');
  assert.equal(await evaluate('document.activeElement.id'), 'report-start');
  await evaluate("document.querySelector('#report-filters button').focus();true");
  await pressBrowserEnter(await browser('get', 'cdp-url'), 'http://127.0.0.1:4312');
  await waitFor("document.getElementById('page-view-total')?.textContent==='3'");
  await browser('set', 'viewport', '390', '844');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile layout fits');
  await waitFor("document.getElementById('engaged-seconds')?.textContent==='12.0'");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'engagement tables fit mobile viewport');
  await evaluate("document.getElementById('engagement-heading').scrollIntoView();true");
  await browser('screenshot','artifacts/day-nine-engagement-mobile.png');
  await browser('screenshot', 'artifacts/day-eight-reports-mobile.png');
  await filters('report-b');
  await waitFor("!document.getElementById('report-result')");
  await submit(); await waitFor("document.getElementById('page-view-total')?.textContent==='1'");
  assert(!(await evaluate("document.getElementById('pages-table').textContent")).includes('/first'));
  await filters('report-empty'); await submit();
  await waitFor("document.querySelector('.empty-report')");
  assert.equal(await evaluate("document.getElementById('page-view-total').textContent"), '0');
  await filters('report-a', '2026-03-09', '2026-03-09'); await submit();
  await waitFor("document.getElementById('page-view-total')?.textContent==='1'");
  await filters('report-a', '2026-03-08', '2026-03-08', 'UTC'); await submit();
  await waitFor("document.getElementById('page-view-total')?.textContent==='1'");
  assert((await evaluate("document.getElementById('report-result').textContent")).includes('UTC'));
  await filters('report-a', '2026-03-10', '2026-03-08'); await submit();
  await waitFor("document.querySelector('.report-error')?.textContent.includes('end date')");
  assert.equal(await evaluate("!!document.getElementById('page-view-total')"), false);
  // Inject only transport failures/delay; successful report data comes from PostgreSQL.
  await evaluate("window.realFetch=window.fetch;window.fetch=(url,options)=>String(url).startsWith('/api/reports/')?Promise.resolve(new Response('{}',{status:503})):realFetch(url,options);true");
  await filters('report-a'); await submit();
  await waitFor("document.querySelector('.report-error')?.textContent.includes('unavailable')");
  assert.equal(await evaluate("!!document.getElementById('page-view-total')"), false, 'failure never displays zero totals');
  await evaluate("window.fetch=window.realFetch;document.querySelector('.report-error button').click();true");
  await waitFor("document.getElementById('page-view-total')?.textContent==='3'");
  await evaluate("window.fetch=async(url,options)=>{const response=await realFetch(url,options);if(String(url).includes('projectId=report-a'))await new Promise(r=>setTimeout(r,1500));return response;};true");
  await submit(); await waitFor("document.querySelector('#report-filters button').disabled");
  await filters('report-b'); await submit();
  await waitFor("document.getElementById('page-view-total')?.textContent==='1'");
  await evaluate('(async()=>{await new Promise(r=>setTimeout(r,1800));return true;})()');
  assert.equal(await evaluate("document.getElementById('page-view-total').textContent"), '1', 'older response cannot overwrite new project');
  await evaluate('window.fetch=window.realFetch;true');
  await pool.query(`INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload)
    SELECT 'report-b',gen_random_uuid(),$1,1,'page_view','2026-03-10T12:00:00Z',
      jsonb_build_object('path','/' || repeat('long-path-',30) || n,'referrerHost','host-' || n || '.example')
    FROM generate_series(1,101) n`, [sessionB]);
  await submit(); await waitFor("document.getElementById('page-view-total')?.textContent==='102'");
  assert((await evaluate("document.getElementById('report-result').textContent")).includes('Showing top 100 of 102 pages'));
  assert((await evaluate("document.getElementById('report-result').textContent")).includes('Showing top 100 of 102 referrers'));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'long paths fit mobile layout');
  // Real timeline pagination after loading a session with more than fifty events.
  await waitFor("document.querySelectorAll('#session-table tbody tr').length===2");
  await evaluate(`[...document.querySelectorAll('#session-table tbody tr')].find(r=>r.textContent.includes('${sessionB}')).querySelector('button').click();true`);
  await waitFor("document.querySelectorAll('#session-timeline li').length===50");
  const firstTimeline = await evaluate("document.querySelector('#session-timeline li').textContent");
  await evaluate("document.getElementById('next-timeline').focus();true");
  await pressBrowserEnter(await browser('get', 'cdp-url'), 'http://127.0.0.1:4312');
  await waitFor(`document.querySelectorAll('#session-timeline li').length===50 && !document.getElementById('next-timeline').disabled && document.querySelector('#session-timeline li').textContent!==${JSON.stringify(firstTimeline)}`);
  await evaluate("document.getElementById('next-timeline').click();true");
  await waitFor("document.querySelectorAll('#session-timeline li').length===1 && document.getElementById('next-timeline').disabled");
  // Engagement failure is distinct from successful zero traffic and recovers.
  await evaluate("window.fetch=(url,options)=>String(url).startsWith('/api/reports/engagement')?Promise.resolve(new Response('{}',{status:503})):realFetch(url,options);true");
  await submit();await waitFor("document.querySelector('.engagement .report-error')?.textContent.includes('unavailable')");
  assert.equal(await evaluate("!!document.getElementById('engagement-result')"),false);
  await evaluate("window.fetch=window.realFetch;document.querySelector('.engagement .report-error button').click();true");
  await waitFor("document.getElementById('engaged-seconds')?.textContent==='0.0'");
  await pool.query('DELETE FROM owner_sessions');
  await submit(); await waitFor("document.getElementById('password')");
  assert.equal(await evaluate("!!document.getElementById('report-result')"), false);
  assert.equal((await browser('errors')).trim(), '');
  console.log('PASS: real report totals, project/date/zone filters, daily chart and tables, empty/loading/error/retry states, stale-response protection, keyboard, mobile, engagement cohort totals, sharing, timeline pagination/recovery, session expiry; no browser errors');
} finally {
  await browser('close').catch(() => {});
  await app?.close(); await pool?.end(); await database?.stop();
  await rm(directory, { recursive: true, force: true });
}
