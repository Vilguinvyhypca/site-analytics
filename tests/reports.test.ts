import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { TrafficReport } from '@site-analytics/contracts';
import { parseReportQuery } from '../apps/api/src/reports.js';
import { postgresAdminStore } from '../apps/api/src/admin-store.js';
import { createApp } from '../apps/api/src/app.js';
import { sessionHash } from '../apps/api/src/admin.js';

const query = { projectId: 'report-a', startDate: '2026-03-08', endDate: '2026-03-10' };
test('report input validates real dates, bounded ranges and time zones', () => {
  assert.equal(parseReportQuery(query)?.timeZone, 'America/New_York');
  for (const patch of [ { startDate: '2026-02-30' }, { startDate: '2025-03-01' }, { endDate: '2026-03-07' },
    { timeZone: 'Mars/Olympus' }, { timeZone: '+05:00' }, { projectId: ['report-a', 'report-b'] },
    { startDate: '03/08/2026' }, { endDate: null }, { extra: true } ]) assert.equal(parseReportQuery({ ...query, ...patch }), null);
  assert(parseReportQuery({ ...query, startDate: '2024-02-29', endDate: '2024-02-29', timeZone: 'UTC' }));
});

test('authenticated reports have exact project-scoped totals, DST boundaries, empty days and honest failures', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const store = postgresAdminStore(pool);
  const token = randomBytes(32).toString('hex');
  const app = createApp(undefined, { store, origin: 'http://127.0.0.1:4200', secret: randomBytes(32).toString('hex') });
  const headers = { cookie: `analytics-owner=${token}` };
  const url = (patch = {}) => '/api/reports/overview?' + new URLSearchParams({ ...query, ...patch });
  const get = async (patch = {}) => {
    const response = await app.inject({ url: url(patch), headers });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['cache-control'], 'no-store');
    return response.json<TrafficReport>();
  };
  const sessionA = randomUUID(), sessionB = randomUUID();
  const insert = async (project: string, time: string, session: string, path = '/', referrer?: string, type = 'page_view') => {
    await pool.query(`INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload)
      VALUES($1,$2,$3,1,$4,$5,$6)`, [project, randomUUID(), session, type, time, JSON.stringify({ path, ...(referrer ? { referrerHost: referrer } : {}) })]);
  };
  try {
    await pool.query("INSERT INTO owner_account(singleton,password_hash) VALUES(true,'test-only') ON CONFLICT(singleton) DO NOTHING");
    await pool.query("INSERT INTO owner_sessions(token_hash,expires_at) VALUES($1,now()+interval '1 hour')", [sessionHash(token)]);
    await pool.query("INSERT INTO projects(id,name) VALUES('report-a','A'),('report-b','B'),('report-empty','Empty')");
    // Historical fixtures intentionally bypass the collector's 24-hour acceptance window.
    await insert('report-a', '2026-03-08T04:59:59.999Z', sessionA, '/outside');
    await insert('report-a', '2026-03-08T05:00:00Z', sessionA, '/a', 'search.example');
    await insert('report-a', '2026-03-09T03:59:59.999Z', sessionB, '/a');
    await insert('report-a', '2026-03-09T04:00:00Z', sessionA, '/b', 'search.example');
    await insert('report-a', '2026-03-11T04:00:00Z', sessionB, '/outside');
    await insert('report-a', '2026-03-08T12:00:00Z', randomUUID(), '/', undefined, 'content_open');
    await insert('report-b', '2026-03-08T05:00:00Z', sessionA, '/other-project', 'other.example');
    assert.equal((await app.inject(url())).statusCode, 401);
    const report = await get();
    assert.deepEqual(report.totals, { pageViews: 3, sessions: 2 });
    assert.equal(Date.parse(report.startAt), Date.parse('2026-03-08T05:00:00Z'));
    assert.equal(Date.parse(report.endAtExclusive), Date.parse('2026-03-11T04:00:00Z'));
    assert.deepEqual(report.daily, [
      { date: '2026-03-08', pageViews: 2, sessions: 2 },
      { date: '2026-03-09', pageViews: 1, sessions: 1 },
      { date: '2026-03-10', pageViews: 0, sessions: 0 }
    ]);
    assert.deepEqual(report.pages, [{ path: '/a', pageViews: 2, sessions: 2 }, { path: '/b', pageViews: 1, sessions: 1 }]);
    assert.deepEqual(report.referrers, [{ host: 'search.example', label: 'search.example', pageViews: 2, sessions: 1 }, { host: null, label: 'Unknown', pageViews: 1, sessions: 1 }]);
    assert.equal(report.pageGroups, 2); assert.equal(report.referrerGroups, 2);
    assert(Number.isFinite(Date.parse(report.generatedAt))); assert(report.latestReceivedAt);
    const b = await get({ projectId: 'report-b' });
    assert.deepEqual(b.totals, { pageViews: 1, sessions: 1 }); assert.equal(b.pages[0].path, '/other-project');
    const empty = await get({ projectId: 'report-empty' });
    assert.deepEqual(empty.totals, { pageViews: 0, sessions: 0 }); assert.deepEqual(empty.pages, []);
    assert.deepEqual(empty.referrers, []); assert.equal(empty.latestReceivedAt, null); assert.equal(empty.daily.length, 3);
    assert.equal((await app.inject({ url: url({ projectId: 'missing' }), headers })).statusCode, 404);
    for (const suffix of ['&startDate=2026-03-07', '&timeZone=Invalid', '&unexpected=yes']) {
      assert.equal((await app.inject({ url: url() + suffix, headers })).statusCode, 400);
    }
    const spring = await get({ endDate: '2026-03-08' });
    assert.equal(Date.parse(spring.endAtExclusive) - Date.parse(spring.startAt), 23 * 3600000);
    await insert('report-a', '2026-11-01T05:30:00Z', sessionA, '/fall');
    await insert('report-a', '2026-11-01T06:30:00Z', sessionA, '/fall');
    const fall = await get({ startDate: '2026-11-01', endDate: '2026-11-01' });
    assert.equal(Date.parse(fall.endAtExclusive) - Date.parse(fall.startAt), 25 * 3600000);
    assert.deepEqual(fall.totals, { pageViews: 2, sessions: 1 });
    const utc = await get({ startDate: '2026-03-08', endDate: '2026-03-08', timeZone: 'UTC' });
    assert.deepEqual(utc.totals, { pageViews: 2, sessions: 1 });
    await insert('report-a', '2026-03-10T12:00:00Z', sessionB, '/late');
    assert.deepEqual((await get()).totals, { pageViews: 4, sessions: 2 }, 'late arrivals appear on next query; disabled collection preserves history');
    for (let i = 0; i < 102; i++) await insert('report-b', '2026-03-10T12:00:00Z', sessionB, `/page-${i.toString().padStart(3, '0')}`, `host-${i}.example`);
    const bounded = await get({ projectId: 'report-b' });
    assert.equal(bounded.pages.length, 100); assert.equal(bounded.pageGroups, 103);
    assert.equal(bounded.referrers.length, 100); assert.equal(bounded.referrerGroups, 103);
    assert.equal(bounded.totals.pageViews, 103); assert.deepEqual((await get({ projectId: 'report-b' })).pages, bounded.pages);
    const failing = createApp(undefined, { store: { ...store, report: async () => { throw new Error('private database detail'); } }, origin: 'http://127.0.0.1:4200', secret: randomBytes(32).toString('hex') });
    try {
      const r = await failing.inject({ url: url(), headers }); assert.equal(r.statusCode, 503); assert(!r.body.includes('private database detail')); assert(!r.body.includes('pageViews'));
    } finally { await failing.close(); }
    await store.deleteSession(sessionHash(token));
    assert.equal((await app.inject({ url: url(), headers })).statusCode, 401);
  } finally {
    await app.close();
    await pool.query("DELETE FROM events WHERE project_id IN ('report-a','report-b','report-empty')");
    await pool.query("DELETE FROM projects WHERE id IN ('report-a','report-b','report-empty')");
    await store.deleteSession(sessionHash(token));
    await pool.end();
  }
});
