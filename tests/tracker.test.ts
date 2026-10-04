import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker } from '../packages/tracker/src/index.js';

test('consent, sanitization, session continuity, queue bounds and failure isolation', async () => {
  const values = new Map<string, string>();
  let reads = 0;
  const requests: { events: { path: string; sessionId: string; referrerHost?: string }[] }[] = [];
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const globals = {
    location: { href: 'https://public.example/videos?token=secret#private' },
    document: { referrer: 'https://referrer.example/private?token=secret' },
    sessionStorage: { getItem: (key: string) => { reads++; return values.get(key) ?? null; }, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    fetch: async (_url: string, options: RequestInit) => { requests.push(JSON.parse(options.body as string)); return { ok: true }; }
  };
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const tracker = createTracker({ projectId: 'test', collectionUrl: 'https://collector.example/api/collect', publicPath: url => url.pathname === '/videos' ? '/videos' : null });
  try {
    assert.equal(reads, 0);
    assert.equal(tracker.pageView(), false);
    assert.equal(await tracker.flush(), false);
    tracker.start(); tracker.start();
    assert.equal(await tracker.flush(), true);
    assert.equal(requests[0].events.length, 1);
    assert.equal(requests[0].events[0].path, '/videos');
    assert.equal(requests[0].events[0].referrerHost, 'referrer.example');
    const id = requests[0].events[0].sessionId;
    globals.location.href = 'https://public.example/admin';
    assert.equal(tracker.pageView(), false);
    globals.location.href = 'https://public.example/videos';
    for (let i = 0; i < 110; i++) tracker.pageView();
    await tracker.flush(); await tracker.flush();
    assert.equal(requests.length, 3);
    assert.equal(requests[1].events.length, 50);
    assert.equal(requests[2].events.length, 50);
    assert.equal(requests[2].events[0].sessionId, id);
    tracker.pageView(); tracker.stop();
    assert.equal(values.size, 0);
    assert.equal(await tracker.flush(), false);
    tracker.start(); await tracker.flush();
    assert.notEqual(requests[3].events[0].sessionId, id);
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => { throw new Error('offline'); } });
    tracker.pageView();
    assert.equal(await tracker.flush(), false);
    assert.equal(await tracker.flush(), false);
  } finally {
    tracker.stop();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
