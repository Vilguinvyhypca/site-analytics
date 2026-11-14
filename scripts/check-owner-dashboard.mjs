import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
const browser = (...args) => execFileSync('node_modules/.bin/agent-browser', ['--session', 'analytics-day-six', ...args], { encoding: 'utf8', timeout: 30000 });
const evaluate = code => JSON.parse(browser('eval', code));
const pool = new pg.Pool({ connectionString: 'postgresql://analytics_dev:local-development-only@127.0.0.1:55435/site_analytics_dev' });
const waitFor = expression => evaluate(`(async () => { for(let i=0;i<60;i++){if(${expression})return true; await new Promise(r=>setTimeout(r,100));} throw new Error('UI did not reach expected state: '+document.body.innerText); })()`);
const submit = values => evaluate(`Object.entries(${JSON.stringify(values)}).forEach(([id,value])=>{const input=document.getElementById(id); if(typeof value==='boolean')input.checked=value;else input.value=value}); (document.querySelector('#project-form') || document.querySelector('form')).requestSubmit(); true`);
try {
  await mkdir('artifacts', { recursive: true });
  browser('--args', '--no-sandbox', 'open', 'http://127.0.0.1:4302');
  waitFor("document.getElementById('password')");
  assert.equal(evaluate("(async () => (await fetch('/api/admin/projects?projectId=browser-first')).status)()"), 401);
  assert.equal(evaluate("(async () => (await fetch('/api/reports/overview?projectId=browser-first')).status)()"), 401);
  submit({ password: 'synthetic-owner-browser-password' });
  waitFor("document.getElementById('project-id')");
  assert.equal(evaluate("document.cookie.includes('analytics-owner')"), false, 'owner session is HttpOnly');
  for (const [id, name] of [['browser-first', 'First website'], ['browser-second', 'Second website']]) {
    evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New project').click(); true");
    submit({ 'project-id': id, 'project-name': name, origins: 'http://127.0.0.1:4302' });
    waitFor(`document.querySelector('#snippet')?.value.includes('${id}') && document.body.textContent.includes('Project saved.')`);
    const row = (await pool.query('SELECT name, collection_enabled FROM projects WHERE id=$1', [id])).rows[0];
    assert.equal(row.name, name); assert.equal(row.collection_enabled, false, 'new projects disabled by default');
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM projects')).rows[0].n, 2);
  evaluate("[...document.querySelectorAll('.project')].find(b=>b.textContent.includes('browser-first')).click(); true");
  waitFor("document.getElementById('project-id').value==='browser-first'");
  const snippet = evaluate("document.getElementById('snippet').value");
  assert(snippet.includes('http://127.0.0.1:4302/api/tracker.js'));
  assert(snippet.includes('// analytics.start()'));
  evaluate("document.querySelector('input[type=checkbox]').checked=true; (document.querySelector('#project-form') || document.querySelector('form')).requestSubmit(); true");
  waitFor("document.body.textContent.includes('Project saved.') && ![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Working'))");
  assert.equal((await pool.query("SELECT collection_enabled FROM projects WHERE id='browser-first'")).rows[0].collection_enabled, true);
  // Execute the exact generated installation script, without its commented consent call.
  evaluate(`(async () => {
    const snippet = document.getElementById('snippet').value;
    const src = /<script src="([^"]+)"/.exec(snippet)[1];
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.append(s)});
    const code = snippet.split('<script>')[1].split('</script>')[0];
    new Function(code + '; window.installedTracker = analytics;')();
    return true;
  })()`);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n, 0, 'installation alone is inert');
  evaluate('installedTracker.start(); true');
  for (let i=0;i<30;i++) { if ((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n === 1) break; await new Promise(r=>setTimeout(r,100)); }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n, 1);
  // Remove the test tracker before changing owner settings; it is never installed in the dashboard normally.
  evaluate('installedTracker.stop(); true');
  evaluate("document.querySelector('input[type=checkbox]').checked=false; (document.querySelector('#project-form') || document.querySelector('form')).requestSubmit(); true");
  waitFor("document.body.textContent.includes('Project saved.') && ![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Working'))");
  assert.equal((await pool.query("SELECT collection_enabled FROM projects WHERE id='browser-first'")).rows[0].collection_enabled, false);
  const blocked = evaluate(`(async () => {
    const event={version:1, projectId:'browser-first',eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),occurredAt:new Date().toISOString(),type:'page_view',path:'/'};
    return (await fetch('/api/collect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,projectId:'browser-first',events:[event]})})).status;
  })()`);
  assert.equal(blocked, 403);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM events')).rows[0].n, 1, 'disabled project creates no more rows');
  const deletionRows=[];
  for(const id of ['browser-first','browser-second']){
    const event={version:1,projectId:id,eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),occurredAt:new Date().toISOString(),type:'page_view',path:'/deletion-fixture'};
    await pool.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES($1,$2,$3,1,$4,$5,$6)',[id,event.eventId,event.sessionId,event.type,event.occurredAt,event]);deletionRows.push(event.eventId);
  }
  evaluate("[...document.querySelectorAll('.project')].find(b=>b.textContent.includes('browser-first')).click(); true");
  waitFor("document.getElementById('delete-confirmation')");
  evaluate("(()=>{const field=document.getElementById('delete-confirmation');field.value='wrong-id';field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.danger').click();return true})()");
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM projects WHERE id='browser-first'")).rows[0].n,1);
  evaluate("(()=>{const field=document.getElementById('delete-confirmation');field.value='browser-first';field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.danger').click();return true})()");
  waitFor("document.body.textContent.includes('Project and its analytics data deleted.')");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM projects WHERE id='browser-first'")).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM events WHERE project_id='browser-first'")).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM events WHERE project_id='browser-second' AND event_id=$1",[deletionRows[1]])).rows[0].n,1);
  browser('reload'); waitFor("document.querySelectorAll('.project').length===1");
  assert.equal(evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  browser('screenshot', 'artifacts/day-six-owner-projects.png');
  browser('set', 'viewport', '390', '844');
  assert.equal(evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile layout fits viewport');
  browser('screenshot', 'artifacts/day-six-owner-mobile.png');
  evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign out').click(); true");
  waitFor("document.getElementById('password')");
  assert.equal(evaluate("(async () => (await fetch('/api/admin/projects')).status)()"), 401);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM owner_sessions')).rows[0].n, 0);
  assert.equal(browser('errors').trim(), '');
  console.log('PASS: owner login, consent-only snippet, collection disable, confirmed project deletion/isolation, mobile layout and logout; no browser errors');
} finally { await pool.end(); browser('close'); }
