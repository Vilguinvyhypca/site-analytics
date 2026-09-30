import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';

test('liveness stays available when PostgreSQL fails; readiness returns a safe 503', async () => {
  const app = createApp(async () => { throw new Error('sensitive connection details'); });
  try {
    const health = await app.inject('/health');
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().collectionEnabled, false);
    const ready = await app.inject('/ready');
    assert.equal(ready.statusCode, 503);
    assert.deepEqual(ready.json(), { status: 'unavailable', database: 'unavailable' });
    assert.equal(ready.headers['cache-control'], 'no-store');
    assert.doesNotMatch(ready.body, /sensitive/);
  } finally { await app.close(); }
});

test('readiness confirms the dependency and event collection is absent', async () => {
  let checked = false;
  const app = createApp(async () => { checked = true; });
  try {
    assert.equal((await app.inject('/ready')).statusCode, 200);
    assert.ok(checked);
    assert.equal((await app.inject({ method: 'POST', url: '/v1/events', payload: {} })).statusCode, 404);
  } finally { await app.close(); }
});

test('configuration refuses missing database URLs and invalid ports', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({ DATABASE_URL: 'https://example.com' }), /PostgreSQL/);
  for (const port of ['0', '-1', '4100.5', '65536', 'not-a-port']) {
    assert.throws(() => readConfig({ API_PORT: port, DATABASE_URL: 'postgresql://localhost/test' }), /API_PORT/);
  }
});
