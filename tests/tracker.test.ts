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
    document: Object.assign(new EventTarget(), { referrer: 'https://referrer.example/private?token=secret', visibilityState: 'visible' }),
    window: new EventTarget(),
    history: { pushState() {}, replaceState() {} },
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
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
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
    tracker.start(); await new Promise(resolve => setImmediate(resolve));
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

test('automatic retries respect backoff, stop after five retries, and retain event IDs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const requests: { events: { eventId: string }[] }[] = [];
  const globals = {
    location: { href: 'https://public.example/' },
    document: Object.assign(new EventTarget(), { referrer: '', visibilityState: 'visible' }),
    window: new EventTarget(),
    history: { pushState() {}, replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (_url: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string));
      return { ok: false, status: 503 };
    }
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const tracker = createTracker({ projectId: 'test', collectionUrl: '/collect', publicPath: url => url.pathname });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  try {
    tracker.start(); await settle();
    assert.equal(requests.length, 1);
    t.mock.timers.tick(1000); await settle();
    assert.equal(requests.length, 2);
    globals.location.href = 'https://public.example/next';
    tracker.recordRoute(); await settle();
    t.mock.timers.tick(1000); await settle();
    assert.equal(requests.length, 2, 'route and periodic flush must respect pending backoff');
    t.mock.timers.tick(1000); await settle();
    assert.equal(requests.length, 3);
    for (const delay of [4000, 8000, 16000]) { t.mock.timers.tick(delay); await settle(); }
    assert.equal(requests.length, 6);
    t.mock.timers.tick(60000); await settle();
    assert.equal(requests.length, 6, 'automatic attempts stop after five retries');
    assert.equal(new Set(requests.map(r => r.events[0].eventId)).size, 1);
    await tracker.flush();
    assert.equal(requests.length, 7, 'explicit flush can restart delivery');
    tracker.stop();
    t.mock.timers.tick(60000); await settle();
    assert.equal(requests.length, 7, 'withdrawal cancels retries');
  } finally {
    tracker.stop(); t.mock.timers.reset();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('cached-page restoration records a fresh view without duplicating normal loads or bypassing consent', async () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const requests: { events: { eventId: string; sessionId: string; path: string }[] }[] = [];
  const globals = {
    location: { href: 'https://public.example/' },
    document: Object.assign(new EventTarget(), { referrer: '', visibilityState: 'visible' }),
    window: new EventTarget(),
    history: { pushState() {}, replaceState() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (_url: string, options: RequestInit) => {
      requests.push(JSON.parse(options.body as string)); return { ok: true };
    }
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const tracker = createTracker({ projectId: 'test', collectionUrl: '/collect', publicPath: url => url.pathname === '/' ? '/' : null });
  const show = async (persisted: boolean) => {
    globals.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    await new Promise(resolve => setImmediate(resolve));
  };
  try {
    await show(true); assert.equal(requests.length, 0);
    tracker.start(); await show(false); assert.equal(requests.length, 1);
    globals.window.dispatchEvent(new Event('pagehide'));
    await show(true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].events[0].sessionId, requests[0].events[0].sessionId);
    assert.notEqual(requests[1].events[0].eventId, requests[0].events[0].eventId);
    tracker.recordRoute(); await show(false); assert.equal(requests.length, 2);
    globals.location.href = 'https://public.example/admin';
    await show(true); assert.equal(requests.length, 2);
    tracker.stop(); globals.location.href = 'https://public.example/';
    await show(true); assert.equal(requests.length, 2);
    tracker.start(); await show(false); assert.equal(requests.length, 3);
    await show(true); assert.equal(requests.length, 4, 'restart installs only one restoration listener');
  } finally {
    tracker.stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
