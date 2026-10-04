import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/api/src/app.js';
test('API exposes only scaffold health and rejects collection', async () => {
  const app = createApp();
  try {
    const health = await app.inject('/api/health');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: 'ok', service: 'site-analytics', collectionEnabled: false });
    assert.equal((await app.inject({ method: 'POST', url: '/api/collect', payload: {} })).statusCode, 404);
  } finally { await app.close(); }
});
