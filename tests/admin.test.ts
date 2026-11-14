import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { hash } from '@node-rs/argon2';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { postgresStore } from '../apps/api/src/collection.js';
import { postgresAdminStore } from '../apps/api/src/admin-store.js';
import { sessionHash } from '../apps/api/src/admin.js';

test('owner login, CSRF, project access, disable, expiry, recovery and limits with PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const password = 'synthetic-owner-password-123';
  const origin = 'http://127.0.0.1:4200';
  const secret = randomBytes(32).toString('hex');
  const store = postgresAdminStore(pool);
  const app = createApp(postgresStore(pool), { store, origin, secret });
  const jar = new Map<string, string>();
  let csrfToken = '';
  const cookies = () => [...jar].map(([key,value]) => `${key}=${value}`).join('; ');
  const send = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object, extra: Record<string,string> = {}) => {
    const response = await app.inject({ method, url, headers: { cookie: cookies(), origin, 'x-csrf-token': csrfToken, ...extra }, ...(payload ? { payload } : {}) });
    for (const c of response.cookies) jar.set(c.name, c.value);
    return response;
  };
  const session = async () => { const r = await send('GET', '/api/auth/session'); assert.equal(r.statusCode,200); csrfToken = r.json().csrfToken; return r; };
  const provision = (value: string) => {
    const result = spawnSync(process.execPath, ['scripts/set-owner.mjs'], { input: value, encoding: 'utf8', env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });
    assert.equal(result.status, 0, result.stderr);
    assert(!result.stdout.includes(value));
  };
  try {
    provision(password);
    assert.match((await store.passwordHash())!, /^\$argon2id\$/);
    await app.ready();
    for (const url of ['/api/admin/projects', '/api/admin/projects/owner-test-a', '/api/reports/overview?projectId=owner-test-a']) {
      const r = await app.inject(url); assert.equal(r.statusCode, 401); assert.equal(r.headers['cache-control'], 'no-store');
    }
    assert.equal((await session()).json().authenticated, false);
    assert.equal((await send('POST', '/api/auth/login', { password }, { 'x-csrf-token': '' })).statusCode, 403);
    assert.equal((await send('POST', '/api/auth/login', { password }, { origin: 'https://attacker.example' })).statusCode, 403);
    const wrong = await send('POST', '/api/auth/login', { password: 'wrong' });
    assert.equal(wrong.statusCode, 401, wrong.body);
    await session();
    const preloginCsrf = csrfToken;
    const login = await send('POST', '/api/auth/login', { password });
    assert.equal(login.statusCode, 200, login.body);
    const ownerCookie = login.cookies.find(c => c.name === 'analytics-owner')!;
    assert(ownerCookie.httpOnly); assert.equal(ownerCookie.sameSite, 'Strict');
    const firstToken = jar.get('analytics-owner')!;
    assert.equal((await pool.query('SELECT token_hash FROM owner_sessions')).rows[0].token_hash, sessionHash(firstToken));
    assert.equal((await session()).json().authenticated, true);
    const project = { id: 'owner-test-a', name: 'First website', allowedOrigins: ['https://first.example'], collectionEnabled: true };
    assert.equal((await send('POST', '/api/admin/projects', project, { 'x-csrf-token': preloginCsrf })).statusCode, 403, 'CSRF token binds to the login session');
    assert.equal((await send('POST', '/api/admin/projects', project)).statusCode, 201);
    assert.equal((await send('POST', '/api/admin/projects', { ...project, id: 'owner-test-b', name: 'Second website', allowedOrigins: ['https://second.example'] })).statusCode, 201);
    assert.equal((await send('POST', '/api/admin/projects', project)).statusCode, 409);
    assert.equal((await send('PUT', '/api/admin/projects/owner-test-b', project)).statusCode, 400, 'URL/body project mismatch rejected');
    for (const allowedOrigins of [['*'], ['https://first.example/path'], ['null']]) {
      assert.equal((await send('PUT', '/api/admin/projects/owner-test-a', { ...project, allowedOrigins })).statusCode, 400);
    }
    assert.equal((await send('GET', '/api/admin/projects/owner-test-b')).json().name, 'Second website');
    assert.equal((await send('GET', '/api/admin/projects/missing')).statusCode, 404);
    assert.equal((await send('GET', '/api/reports/overview?projectId=owner-test-b')).statusCode, 400, 'report dates required');
    const batch = { version: 1, projectId: project.id, events: [{ version: 1, projectId: project.id, eventId: randomUUID(), sessionId: randomUUID(), occurredAt: new Date().toISOString(), type: 'page_view', path: '/' }] };
    const collect = () => app.inject({ method: 'POST', url: '/api/collect', headers: { origin: 'https://first.example' }, payload: batch });
    assert.equal((await collect()).statusCode, 202);
    assert.equal((await send('PUT', '/api/admin/projects/owner-test-a', { ...project, collectionEnabled: false })).statusCode, 200);
    assert.equal((await collect()).statusCode, 403);
    assert.equal((await send('GET', '/api/admin/projects/owner-test-b')).json().collectionEnabled, true);
    assert.equal((await send('PUT', '/api/admin/projects/owner-test-a', { ...project, allowedOrigins: ['https://new.example'] })).statusCode, 200);
    assert.equal((await collect()).statusCode, 403, 'removed origin stops collection');
    assert.equal((await app.inject({ method: 'POST', url: '/api/admin/projects', payload: project, headers: { origin, 'x-csrf-token': csrfToken } })).statusCode, 401);
    assert.equal((await send('POST', '/api/auth/logout')).statusCode, 204);
    assert.equal((await app.inject({ url: '/api/admin/projects', headers: { cookie: `analytics-owner=${firstToken}` } })).statusCode, 401);
    await session(); assert.equal((await send('POST', '/api/auth/login', { password })).statusCode, 200);
    await pool.query("UPDATE owner_sessions SET expires_at=now()-interval '1 second'");
    assert.equal((await send('GET', '/api/admin/projects')).statusCode, 401);
    await session(); assert.equal((await send('POST', '/api/auth/login', { password })).statusCode, 200);
    provision('replacement-synthetic-password');
    assert.equal((await send('GET', '/api/admin/projects')).statusCode, 401, 'password recovery revokes all sessions');
    await session();
    assert.equal((await send('POST', '/api/auth/login', { password })).statusCode, 401);
    assert.equal((await send('POST', '/api/auth/login', { password })).statusCode, 429, 'single-owner login attempts bounded globally per process');
    // Recovery racing a verified login cannot create a session with the old digest.
    assert.equal(await store.createSession('a'.repeat(64), await hash(password)), false);
    const tlsApp = createApp(undefined, { store, origin: 'https://analytics.example', secret });
    try {
      const r = await tlsApp.inject('/api/auth/session');
      assert(r.cookies[0].secure); assert(r.cookies[0].httpOnly); assert(r.cookies[0].name.startsWith('__Host-'));
    } finally { await tlsApp.close(); }
    const restarted = createApp(undefined, { store, origin, secret });
    try {
      const digest = (await store.passwordHash())!;
      const persistentToken = randomBytes(32).toString('hex');
      await store.createSession(sessionHash(persistentToken), digest);
      assert.equal((await restarted.inject({ url: '/api/admin/projects', headers: { cookie: `analytics-owner=${persistentToken}` } })).statusCode, 200, 'session survives API instance restart');
    } finally { await restarted.close(); }
  } finally { await app.close(); await pool.end(); }
});
