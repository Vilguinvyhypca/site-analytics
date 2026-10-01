import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, verify } from '@node-rs/argon2';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import { createApp } from '../apps/api/src/app.js';
test('selected owner-auth dependencies work with the API runtime', async () => {
  const digest = await hash('development-compatibility-check');
  assert.ok(digest.startsWith('$argon2id$'));
  assert.equal(await verify(digest, 'development-compatibility-check'), true);
  assert.equal(await verify(digest, 'incorrect'), false);
  const app = createApp();
  try {
    await app.register(cookie);
    await app.register(csrf);
    await app.register(rateLimit, { max: 10, timeWindow: '1 minute' });
    await app.ready();
    assert.equal((await app.inject('/api/health')).statusCode, 200);
  } finally { await app.close(); }
});
