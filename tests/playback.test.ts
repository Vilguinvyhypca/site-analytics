import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AnalyticsEvent, PlaybackProgress, PlaybackStart } from '@site-analytics/contracts';
import { createApp } from '../apps/api/src/app.js';
import { postgresStore } from '../apps/api/src/collection.js';

test('playback summaries resist duplicate, reordered, conflicting and concurrent updates', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const app = createApp(postgresStore(pool));
  const envelope = { version: 1 as const, projectId: 'playback-a', eventId: randomUUID(), sessionId: randomUUID(), occurredAt: new Date().toISOString() };
  const start: PlaybackStart = { ...envelope, type: 'playback_start', contentId: 'video-1', playbackId: randomUUID(), autoplay: false };
  const progress = (sequence: number, seconds: number, overrides: Partial<PlaybackProgress> = {}): PlaybackProgress => ({ ...envelope, eventId: randomUUID(), type: 'playback_progress', contentId: start.contentId, playbackId: start.playbackId, sequence, engagedSeconds: seconds, durationSeconds: 10, coveredIntervals: [[0, Math.min(seconds, 10)]], ended: false, ...overrides });
  const send = (events: AnalyticsEvent[], projectId = 'playback-a') => app.inject({ method: 'POST', url: '/api/collect', headers: { origin: 'https://fixture.example' }, payload: { version: 1, projectId, events } });
  const summary = async (project = 'playback-a', playback = start.playbackId) => (await pool.query('SELECT * FROM playback_summaries WHERE project_id=$1 AND playback_id=$2', [project, playback])).rows[0];
  try {
    await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('playback-a','A',true,ARRAY['https://fixture.example']),('playback-b','B',true,ARRAY['https://fixture.example'])");
    const newest = progress(3, 9.6, { ended: true });
    assert.equal((await send([newest])).statusCode, 202);
    assert.equal((await summary()).started, false); assert.equal((await summary()).completed, false, 'missing start is not fabricated');
    assert.equal((await send([start, progress(1, 2), progress(2, 5)])).statusCode, 202);
    let result = await summary(); assert.equal(result.engaged_seconds, 9.6); assert.equal(result.sequence, 3); assert.equal(result.completed, true); assert.equal(result.coverage, 0.96);
    assert.equal((await send([newest])).json().duplicates, 1);
    assert.equal((await send([{ ...newest, eventId: randomUUID() }, { ...start, eventId: randomUUID() }])).statusCode, 202);
    assert.equal((await summary()).engaged_seconds, 9.6, 'different event IDs do not multiply cumulative time');
    for (const bad of [progress(3, 8), progress(4, 8), progress(2, 10), progress(4, 10, { contentId: 'wrong' }), progress(4, 10, { sessionId: randomUUID() }), { ...start, eventId: randomUUID(), autoplay: true }]) {
      const r = await send([bad]); assert.equal(r.statusCode, 409, r.body); assert.equal(r.headers['access-control-allow-origin'], 'https://fixture.example');
    }
    const count = Number((await pool.query("SELECT count(*) FROM events WHERE project_id='playback-a'")).rows[0].count);
    assert.equal((await send([{ ...envelope, eventId: randomUUID(), type: 'share', contentId: 'video-1', outcome: 'copied' }, progress(4, 1)])).statusCode, 409);
    assert.equal(Number((await pool.query("SELECT count(*) FROM events WHERE project_id='playback-a'")).rows[0].count), count, 'conflict rolls back entire batch');
    const concurrent = await Promise.all([send([progress(4, 10)]), send([progress(5, 11)])]);
    assert(concurrent.every(r => r.statusCode === 202)); result = await summary(); assert.equal(result.sequence, 5); assert.equal(result.engaged_seconds, 11); assert.equal(result.covered_seconds, 10);
    const conflicting = await Promise.all([send([progress(6, 12)]), send([progress(6, 13)])]);
    assert.deepEqual(conflicting.map(r => r.statusCode).sort(), [202, 409]);
    const other = { ...progress(1, 3), projectId: 'playback-b', contentId: 'other-video', sessionId: randomUUID() };
    assert.equal((await send([other], 'playback-b')).statusCode, 202);
    assert.equal((await summary('playback-b')).engaged_seconds, 3); assert.equal((await summary('playback-b')).content_id, 'other-video');
    const unknown = progress(1, 4, { playbackId: randomUUID(), durationSeconds: null, coveredIntervals: [], ended: false });
    assert.equal((await send([unknown])).statusCode, 202); result = await summary('playback-a', unknown.playbackId); assert.equal(result.coverage, null); assert.equal(result.completed, false);
    const seek = progress(1, 1, { playbackId: randomUUID(), coveredIntervals: [[9,10]], ended: true });
    assert.equal((await send([{ ...start, eventId: randomUUID(), playbackId: seek.playbackId }, seek])).statusCode, 202);
    assert.equal((await summary('playback-a', seek.playbackId)).completed, false);
    const shares: AnalyticsEvent[] = ['clicked','copied','handoff','cancelled','failed'].map(outcome => ({ ...envelope, eventId: randomUUID(), type: 'share', contentId: 'video-1', outcome: outcome as 'clicked' }));
    assert.equal((await send(shares)).statusCode, 202); assert.equal((await send(shares)).json().duplicates, 5);
    const outcomes = (await pool.query("SELECT payload->>'outcome' AS outcome,count(*)::int AS n FROM events WHERE project_id='playback-a' AND type='share' GROUP BY 1")).rows;
    assert.equal(outcomes.length, 5); assert(outcomes.every(r => r.n === 1));
    // The read-through view includes historical raw rows without a rebuild job.
    const historic = { ...progress(1, 2), playbackId: randomUUID() };
    await pool.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES($1,$2,$3,1,$4,$5,$6)', [historic.projectId,historic.eventId,historic.sessionId,historic.type,historic.occurredAt,JSON.stringify(historic)]);
    assert.equal((await summary('playback-a', historic.playbackId)).engaged_seconds, 2);
    await pool.query("DELETE FROM events WHERE project_id='playback-a'");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM playback_summaries WHERE project_id='playback-a'")).rows[0].n, 0);
    assert.equal((await summary('playback-b')).engaged_seconds, 3);
  } finally {
    await app.close(); await pool.query("DELETE FROM events WHERE project_id IN ('playback-a','playback-b')");
    await pool.query("DELETE FROM projects WHERE id IN ('playback-a','playback-b')"); await pool.end();
  }
});
