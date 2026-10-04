import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBatch } from '../packages/contracts/src/events.js';
import { createApp } from '../apps/api/src/app.js';
const now = Date.now();
const projectId = '11111111-1111-4111-8111-111111111111';
const event = { id: projectId, sessionId: projectId, timestamp: new Date(now).toISOString(), name: 'page_view', path: '/gallery', properties: { count: 1, active: true } };
const batch = { version: 1, projectId, events: [event] };
test('versioned event validation enforces time, shape, URL and property bounds', () => {
  assert.ok(parseBatch(batch, now));
  for (const invalid of [null, {}, { ...batch, version: 2 }, { ...batch, events: [] }, { ...batch, extra: true }]) assert.equal(parseBatch(invalid, now), null);
  for (const fields of [{ timestamp: new Date(now + 300_001).toISOString() }, { timestamp: new Date(now - 86_400_001).toISOString() }, { path: '//external.example' }, { path: '/%3Fsecret' }, { properties: { x: Infinity } }, { properties: { x: 'x'.repeat(129) } }, { properties: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`p${i}`, i])) }]) {
    assert.equal(parseBatch({ ...batch, events: [{ ...event, ...fields }] }, now), null);
  }
});
test('collector failures return a generic retryable response', async () => {
  const fail = async (): Promise<never> => { throw new Error('secret database detail'); };
  const app = createApp(async () => {}, false, { allowed: fail, save: fail });
  try {
    const response = await app.inject({ method: 'POST', url: `/v1/collect/${projectId}`, headers: { origin: 'http://localhost:4300' }, payload: batch });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { error: 'Collection unavailable' });
  } finally { await app.close(); }
});
