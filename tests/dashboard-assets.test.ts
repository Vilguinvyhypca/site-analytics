import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/src/app.js';

test('optional dashboard serving supports SPA routes and keeps API misses out of the UI fallback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'analytics-dashboard-assets-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<main>dashboard-shell</main>');
  await writeFile(join(directory, 'assets', 'main.js'), 'window.dashboardReady = true;');
  const app = createApp(undefined, undefined, { dashboardDirectory: directory });
  try {
    const home = await app.inject({ method: 'GET', url: '/' });
    assert.equal(home.statusCode, 200);
    assert.equal(home.body, '<main>dashboard-shell</main>');
    assert.equal(home.headers['cache-control'], 'no-cache');

    const route = await app.inject({ method: 'GET', url: '/engagement/content' });
    assert.equal(route.statusCode, 200);
    assert.equal(route.body, '<main>dashboard-shell</main>');

    const script = await app.inject({ method: 'GET', url: '/assets/main.js' });
    assert.equal(script.statusCode, 200);
    assert.match(script.headers['content-type'] ?? '', /^text\/javascript/);
    assert.equal(script.body, 'window.dashboardReady = true;');

    assert.equal((await app.inject({ method: 'GET', url: '/assets/missing.js' })).statusCode, 404);
    const apiMiss = await app.inject({ method: 'GET', url: '/api/not-a-route' });
    assert.equal(apiMiss.statusCode, 404);
    assert.equal(apiMiss.body.includes('dashboard-shell'), false);
    assert.equal((await app.inject({ method: 'GET', url: '/..%2F..%2Fsecret' })).statusCode, 400);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
