import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { postgresStore } from '../apps/api/src/collection.js';
import type { CollectionBatch } from '@site-analytics/contracts';
const batch = (): CollectionBatch => ({ version: 1, projectId: 'static-dev', events: [{ version: 1, projectId: 'static-dev', eventId: randomUUID(), sessionId: randomUUID(), occurredAt: new Date().toISOString(), type: 'page_view', path: '/video' }] });
test('collection rejects malformed, oversized, cross-project and implausible events before storage', async () => {
  let calls = 0;
  const app = createApp({ async collect(b) { calls++; return { accepted: b.events.length, duplicates: 0 }; } });
  const send = (payload: unknown, origin = 'http://localhost:4300') => app.inject({ method: 'POST', url: '/api/collect', headers: { origin, 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
  try {
    assert.equal((await send(batch())).statusCode, 202);
    const good = batch();
    const e = good.events[0];
    const invalid = [ {}, { ...good, extra: 'private' }, { ...good, events: [] }, { ...good, events: Array(51).fill(e) },
      { ...good, events: [{ ...e, projectId: 'other' }] }, { ...good, events: [{ ...e, version: '1' }] },
      { ...good, events: [{ ...e, occurredAt: '2020-01-01T00:00:00Z' }] }, { ...good, events: [{ ...e, occurredAt: new Date(Date.now() + 600000).toISOString() }] },
      { ...good, events: [{ ...e, path: '/?secret=yes' }] }, { ...good, events: [{ ...e, email: 'private@example.test' }] },
      { ...good, events: [{ ...e, type: 'playback_progress', path: undefined, contentId: 'v1', playbackId: randomUUID(), sequence: 1, engagedSeconds: 2, durationSeconds: 10, coveredIntervals: [[8, 11]], ended: false }] }
    ];
    for (const payload of invalid) assert.equal((await send(payload)).statusCode, 400, JSON.stringify(payload));
    assert.equal((await send({ ...good, padding: 'x'.repeat(65536) })).statusCode, 413);
    for (const origin of ['', 'null', 'https://example.test/path']) assert.equal((await send(good, origin)).statusCode, 403);
    assert.equal(calls, 1);
    assert.equal((await app.inject({ method: 'OPTIONS', url: '/api/collect', headers: { origin: 'http://localhost:4300' } })).statusCode, 204);
  } finally { await app.close(); }
});
test('database failure returns a bounded unavailable response', async () => {
  const app = createApp({ async collect() { throw new Error('secret database details'); } });
  try { const response = await app.inject({ method: 'POST', url: '/api/collect', headers: { origin: 'http://localhost:4300' }, payload: batch() }); assert.equal(response.statusCode, 503); assert.equal(response.body.includes('secret'), false); } finally { await app.close(); }
});
test('collector sheds excess concurrent work and resumes when capacity recovers', async () => {
  let active = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const app = createApp({ async collect(b) { active++; await gate; active--; return { accepted: b.events.length, duplicates: 0 }; } });
  try {
    const requests = Array.from({length:5},()=>app.inject({method:'POST',url:'/api/collect',headers:{origin:'http://localhost:4300'},payload:batch()}));
    for(let i=0;i<30&&active<5;i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(active,5);
    const shed=await app.inject({method:'POST',url:'/api/collect',headers:{origin:'http://localhost:4300'},payload:batch()});
    assert.equal(shed.statusCode,503);assert.equal(shed.headers['retry-after'],'2');
    release();assert((await Promise.all(requests)).every(response=>response.statusCode===202));
    assert.equal((await app.inject({method:'POST',url:'/api/collect',headers:{origin:'http://localhost:4300'},payload:batch()})).statusCode,202);
  } finally { release(); await app.close(); }
});
test('real PostgreSQL storage, retries, isolation, origin and disable checks', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const app = createApp(postgresStore(pool));
  const send = (payload: CollectionBatch, origin = 'http://localhost:4300') => app.inject({ method: 'POST', url: '/api/collect', headers: { origin }, payload });
  try {
    await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES ('static-dev','Static',true,ARRAY['http://localhost:4300']),('mediaspace-dev','MediaSpace',true,ARRAY['http://localhost:3000'])");
    const b = batch();
    assert.deepEqual((await send(b)).json(), { accepted: 1, duplicates: 0 });
    assert.deepEqual((await send(b)).json(), { accepted: 0, duplicates: 1 });
    const other: CollectionBatch = { ...b, projectId: 'mediaspace-dev', events: b.events.map(e => ({ ...e, projectId: 'mediaspace-dev' })) };
    assert.deepEqual((await send(other, 'http://localhost:3000')).json(), { accepted: 1, duplicates: 0 });
    assert.equal((await send(batch(), 'http://localhost:3000')).statusCode, 403);
    const unknown: CollectionBatch = { ...b, projectId: 'unknown', events: b.events.map(e => ({ ...e, projectId: 'unknown' })) };
    assert.equal((await send(unknown)).statusCode, 403);
    const video: CollectionBatch = { ...b, events: [{ version: 1, projectId: b.projectId, eventId: randomUUID(), sessionId: b.events[0].sessionId, occurredAt: new Date().toISOString(), type: 'playback_progress', contentId: 'video-1', playbackId: randomUUID(), sequence: 1, engagedSeconds: 5, durationSeconds: 20, coveredIntervals: [[0, 5]], ended: false }] };
    assert.equal((await send(video)).statusCode, 202);
    const invalid = batch(); invalid.events.push({ ...invalid.events[0], eventId: randomUUID(), projectId: 'mediaspace-dev' });
    assert.equal((await send(invalid)).statusCode, 400);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM events WHERE project_id IN ('static-dev','mediaspace-dev')")).rows[0].n, 3);
    // A later database error rolls back earlier inserts in the same batch.
    await pool.query("ALTER TABLE events ADD CONSTRAINT test_failure CHECK (payload->>'path' IS DISTINCT FROM '/fail')");
    const rollback = batch(); rollback.events.push({ ...rollback.events[0], eventId: randomUUID(), type: 'page_view', path: '/fail' });
    assert.equal((await send(rollback)).statusCode, 503);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM events WHERE project_id IN ('static-dev','mediaspace-dev')")).rows[0].n, 3);
    await pool.query('ALTER TABLE events DROP CONSTRAINT test_failure');
    const concurrent = batch();
    const results = await Promise.all([send(concurrent), send(concurrent)]);
    assert.equal(results.reduce((total, r) => total + r.json().accepted, 0), 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM events WHERE project_id IN ('static-dev','mediaspace-dev')")).rows[0].n, 4);
    await pool.query("UPDATE projects SET collection_enabled = false WHERE id = 'static-dev'");
    assert.equal((await send(batch())).statusCode, 403);
    const rows = (await pool.query("SELECT project_id,payload FROM events WHERE project_id IN ('static-dev','mediaspace-dev') ORDER BY received_at")).rows;
    assert.equal(rows[0].payload.path, '/video');
    assert.equal(rows[2].payload.engagedSeconds, 5);
  } finally { await app.close(); await pool.end(); }
});
