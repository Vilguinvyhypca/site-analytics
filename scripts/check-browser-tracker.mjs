import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
const browser = (...args) => execFileSync('node_modules/.bin/agent-browser', ['--session', 'analytics-day-four', ...args], { encoding: 'utf8' });
const evaluate = code => browser('eval', code);
const pool = new pg.Pool({ connectionString: 'postgresql://analytics_dev:local-development-only@127.0.0.1:55434/site_analytics_dev' });
const count = async () => (await pool.query('SELECT count(*)::int AS count FROM events')).rows[0].count;
try {
  browser('--args', '--no-sandbox', 'open', 'http://127.0.0.1:4300');
  const baseline = await count();
  console.log(browser('snapshot', '-i'));
  browser('screenshot', 'artifacts/day-four-consent.png');
  evaluate("document.querySelector('#deny').click(); document.querySelector('#visit').click()");
  await new Promise(resolve => setTimeout(resolve, 2200));
  assert.equal(await count(), baseline, 'denied visit must not collect');
  evaluate("document.querySelector('#allow').click(); document.querySelector('#send').click()");
  await new Promise(resolve => setTimeout(resolve, 3200));
  assert.equal(await count(), baseline + 1, 'permitted browser visit reaches PostgreSQL');
  const row = (await pool.query('SELECT payload FROM events')).rows[0].payload;
  assert.equal(row.path, '/');
  evaluate("document.querySelector('#visit').click(); document.querySelector('#deny').click(); document.querySelector('#send').click()");
  await new Promise(resolve => setTimeout(resolve, 2200));
  assert.equal(await count(), baseline + 1, 'withdrawal clears unsent visits');
  assert.match(evaluate('sessionStorage.length'), /0/);
  // Routes, query/hash deduplication, exclusions, history and reload continuity.
  const waitCount = async expected => {
    for (let i = 0; i < 30; i++) {
      if (await count() === expected) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await count(), expected);
  };
  evaluate("document.querySelector('#allow').click()");
  evaluate("(async () => { while (document.querySelector('#allow').disabled) await new Promise(resolve => setTimeout(resolve, 100)); return true; })()");
  await waitCount(baseline + 2);
  evaluate("history.pushState({}, '', '/one?secret=hidden')");
  await waitCount(baseline + 3);
  evaluate("history.replaceState({}, '', '/one?different=hidden#fragment')");
  evaluate("history.pushState({}, '', '/admin?secret=hidden')");
  await new Promise(resolve => setTimeout(resolve, 2200));
  assert.equal(await count(), baseline + 3);
  evaluate("history.pushState({}, '', '/two')");
  await waitCount(baseline + 4);
  evaluate('history.back()');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await count(), baseline + 4);
  evaluate('history.back()');
  await waitCount(baseline + 5);
  evaluate('history.forward()');
  await new Promise(resolve => setTimeout(resolve, 300));
  evaluate('history.forward()');
  await waitCount(baseline + 6);
  const key = 'site-analytics:session:v1:static-dev';
  const session = evaluate(`JSON.parse(sessionStorage.getItem('${key}')).id`);
  browser('reload');
  assert.match(evaluate("document.querySelector('#status').textContent"), /Analytics off/);
  assert.equal(await count(), baseline + 6);
  evaluate("document.querySelector('#allow').click()");
  evaluate("(async () => { while (document.querySelector('#allow').disabled) await new Promise(resolve => setTimeout(resolve, 100)); return true; })()");
  await waitCount(baseline + 7);
  assert.equal(evaluate(`JSON.parse(sessionStorage.getItem('${key}')).id`), session);
  // Age only the stored session; real event timestamps stay valid for the API.
  evaluate(`const saved = JSON.parse(sessionStorage.getItem('${key}')); saved.last -= 1800001; sessionStorage.setItem('${key}', JSON.stringify(saved))`);
  browser('reload');
  evaluate("document.querySelector('#allow').click()");
  evaluate("(async () => { while (document.querySelector('#allow').disabled) await new Promise(resolve => setTimeout(resolve, 100)); return true; })()");
  await waitCount(baseline + 8);
  assert.notEqual(evaluate(`JSON.parse(sessionStorage.getItem('${key}')).id`), session);
  // Server accepted the batch, but the browser lost the response: retry same IDs.
  evaluate("window.realFetch = window.fetch; window.attempts = []; window.fetch = async (...args) => { attempts.push(JSON.parse(args[1].body)); const response = await realFetch(...args); if (attempts.length === 1) throw new Error('simulated lost response'); return response; }; document.querySelector('#visit').click(); document.querySelector('#send').click()");
  await waitCount(baseline + 9);
  await new Promise(resolve => setTimeout(resolve, 1600));
  assert.match(evaluate('attempts.length'), /2/);
  assert.match(evaluate('attempts[0].events[0].eventId === attempts[1].events[0].eventId'), /true/);
  assert.equal(await count(), baseline + 9, 'lost response retry must not duplicate rows');
  evaluate('window.fetch = realFetch');
  // Queue and leave in the same JS task, before the periodic flush can run.
  evaluate("document.querySelector('#visit').click(); location.href = '/one'");
  await waitCount(baseline + 10);
  const paths = (await pool.query('SELECT payload FROM events')).rows.map(r => r.payload.path);
  assert(paths.every(path => ['/', '/one', '/two'].includes(path)), 'only sanitized public paths stored');
  evaluate("window.failedTracker = SiteAnalytics.createTracker({projectId:'static-dev',collectionUrl:'http://127.0.0.1:3101/missing',publicPath:()=>'/'}); failedTracker.start()");
  assert.match(evaluate('(async () => await failedTracker.flush())()'), /false/);
  evaluate('failedTracker.stop()');
  console.log(browser('errors'));
  console.log('PASS: 10 expected rows; consent, routes, history, reload, expiry, retry deduplication, exclusions and page exit verified');
} finally { await pool.end(); browser('close'); }
