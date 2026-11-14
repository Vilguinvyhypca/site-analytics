import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
test('health is liveness while readiness requires a working database', async () => {
  let connected = true;
  const app = createApp(undefined, undefined, { databaseReady: async () => { if (!connected) throw new Error('private database failure'); } });
  try {
    const health = await app.inject('/api/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: 'ok', service: 'site-analytics', collectionEnabled: false });
    assert.deepEqual((await app.inject('/api/ready')).json(), { status: 'ready', service: 'site-analytics' });
    connected = false;
    const unavailable = await app.inject('/api/ready');
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.json(), { status: 'unavailable', service: 'site-analytics' });
    assert.equal(unavailable.body.includes('private database'), false);
    assert.equal((await app.inject({ method: 'POST', url: '/api/collect', payload: {} })).statusCode, 404);
  } finally { await app.close(); }
});

test('readiness reports not configured when database checks are absent', async () => {
  const app = createApp();
  try {
    const ready = await app.inject('/api/ready');
    assert.equal(ready.statusCode, 503);
    assert.deepEqual(ready.json(), { status: 'not_ready', service: 'site-analytics' });
  } finally { await app.close(); }
});

test('readiness confirms an actual PostgreSQL connection', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const app = createApp(undefined, undefined, { databaseReady: async () => { await pool.query('SELECT 1'); } });
  try {
    const ready = await app.inject('/api/ready');
    assert.equal(ready.statusCode, 200);
    assert.deepEqual(ready.json(), { status: 'ready', service: 'site-analytics' });
  } finally { await app.close(); await pool.end(); }
});
