import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';
import { parseBatch } from '../packages/contracts/src/events.js';
import type { createTracker } from '../packages/tracker/src/index.js';
const projectId = '22222222-2222-4222-8222-222222222222';
const result = await build({ entryPoints: ['packages/tracker/src/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'SiteAnalytics' });
const bundle = result.outputFiles[0]!.text;
function browser(blockStorage = false, stored = new Map<string, string>()) {
  let now = Date.now();
  class Clock extends Date {
    constructor(value?: string | number) { super(value ?? now); }
    static now() { return now; }
  }
  const listeners = new Map<string, Set<(event?: unknown) => void>>();
  const addEventListener = (name: string, fn: (event?: unknown) => void) => { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); };
  const removeEventListener = (name: string, fn: (event?: unknown) => void) => { listeners.get(name)?.delete(fn); };
  const emit = (name: string, event = {}) => { for (const fn of listeners.get(name) ?? []) fn(event); };
  let storageReads = 0;
  const requests: RequestInit[] = [];
  const intervals = new Set<() => void>();
  const location = { pathname: '/', search: '?token=secret&utm_source=fixture&utm_medium=email@example.com', origin: 'https://site.example' };
  let fetcher = async (_url: string, init: RequestInit) => { requests.push(init); return { status: 202 }; };
  const navigate = (_data: unknown, _unused: string, url?: string | URL | null) => {
    if (!url) return;
    const next = new URL(url, location.origin + location.pathname);
    if (next.origin !== location.origin) throw new Error('Cross-origin history denied');
    location.pathname = next.pathname; location.search = next.search;
  };
  const history = { pushState: navigate, replaceState: navigate };
  const document = { addEventListener, removeEventListener, visibilityState: 'visible', referrer: 'https://referrer.example/private?token=secret' };
  const context = vm.createContext({ URL, URLSearchParams, Date: Clock, AbortController, crypto: { randomUUID },
    window: { location, history, addEventListener, removeEventListener }, document,
    sessionStorage: {
      getItem: (key: string) => { storageReads++; if (blockStorage) throw Error('denied'); return stored.get(key); },
      setItem: (key: string, value: string) => { if (blockStorage) throw Error('denied'); stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
    },
    fetch: (url: string, init: RequestInit) => fetcher(url, init),
    setInterval: (fn: () => void) => { intervals.add(fn); return fn; }, clearInterval: (fn: () => void) => intervals.delete(fn),
    setTimeout: () => 1, clearTimeout: () => {},
  });
  vm.runInContext(bundle, context);
  const tracker = vm.runInContext(`SiteAnalytics.createTracker(${JSON.stringify({ projectId, collectionUrl: `https://collector.example/v1/collect/${projectId}`, pages: { '/': '/', '/gallery': '/gallery' }, campaigns: { source: ['fixture'] } })})`, context) as ReturnType<typeof createTracker>;
  return { tracker, stored, requests, intervals, location, history, document, emit, advance: (ms: number) => { now += ms; }, reads: () => storageReads, setFetch: (fn: typeof fetcher) => { fetcher = fn; } };
}
test('bundle is inert even without browser globals', () => {
  const context = vm.createContext({});
  vm.runInContext(bundle, context);
  assert.equal(vm.runInContext('SiteAnalytics.status().collectionEnabled', context), false);
});
test('consent gates storage and collection; sanitization produces API-valid batches', async () => {
  const b = browser();
  assert.equal(b.reads(), 0);
  assert.equal(b.tracker.page(), false);
  assert.equal(await b.tracker.flush(), false);
  assert.equal(b.requests.length, 0);
  b.tracker.start(); b.tracker.start();
  assert.equal(b.intervals.size, 1);
  b.tracker.page();
  assert.equal(await b.tracker.flush(), true);
  const body = String(b.requests[0]!.body);
  const batch = parseBatch(JSON.parse(body))!;
  assert.ok(batch);
  assert.equal(batch.events.length, 2);
  assert.equal(batch.events[0]!.sessionId, batch.events[1]!.sessionId);
  assert.deepEqual(batch.events[0]!.properties, { source: 'fixture', referrer_host: 'referrer.example' });
  assert.deepEqual(batch.events[1]!.properties, {});
  assert.ok(!body.includes('secret') && !body.includes('email@') && !body.includes('/private'));
  assert.equal(b.requests[0]!.credentials, 'omit');
  assert.equal(b.requests[0]!.referrerPolicy, 'no-referrer');
  b.tracker.page(); b.tracker.stop();
  assert.equal(b.stored.size, 0);
  assert.equal(b.intervals.size, 0);
  assert.equal(b.tracker.status().queued, 0);
  assert.equal(await b.tracker.flush(), false);
});
test('exclusions, storage failures, queue limits, and network failures are contained', async () => {
  const b = browser(true);
  b.location.pathname = '/admin'; b.tracker.start();
  assert.equal(b.tracker.status().queued, 0);
  b.location.pathname = '/private/person'; assert.equal(b.tracker.page(), false);
  b.location.pathname = '/gallery';
  for (let i = 0; i < 120; i++) b.tracker.page();
  assert.equal(b.tracker.status().queued, 100);
  await b.tracker.flush();
  const batch = parseBatch(JSON.parse(String(b.requests[0]!.body)))!;
  assert.equal(batch.events.length, 10);
  assert.equal(new Set(batch.events.map(e => e.sessionId)).size, 1);
  b.setFetch(async () => { throw Error('offline'); });
  assert.equal(await b.tracker.flush(), false);
  assert.equal(b.tracker.status().queued, 90);
  b.tracker.stop();
});
test('withdrawal aborts in-flight requests; late completion cannot change a new consent session', async () => {
  const b = browser();
  let complete!: (value: { status: number }) => void;
  let signal: AbortSignal | null | undefined;
  b.setFetch(async (_url, init) => { signal = init.signal; return new Promise(resolve => { complete = resolve; }); });
  b.tracker.start();
  const first = b.tracker.flush();
  b.tracker.stop(); assert.equal(signal?.aborted, true);
  b.tracker.start(); complete({ status: 202 });
  assert.equal(await first, false);
  assert.equal(b.tracker.status().queued, 1);
  b.tracker.stop();
});

test('SPA navigation follows path changes and restores history hooks on withdrawal', async () => {
  const b = browser();
  const original = b.history.pushState;
  b.tracker.start();
  b.history.pushState({}, '', '/gallery?token=secret');
  b.history.replaceState({}, '', '/gallery?other=secret');
  b.history.pushState({}, '', '/admin');
  b.location.pathname = '/'; b.emit('popstate');
  await b.tracker.flush();
  assert.deepEqual(JSON.parse(String(b.requests[0]!.body)).events.map((e: { path: string }) => e.path), ['/', '/gallery', '/']);
  assert.throws(() => b.history.pushState({}, '', 'https://other.example/'));
  b.tracker.stop();
  assert.equal(b.history.pushState, original);
  b.history.pushState({}, '', '/gallery'); b.emit('popstate');
  assert.equal(b.tracker.status().queued, 0);
});
test('network retries preserve event IDs, back off, and stop after three attempts', async () => {
  const b = browser();
  b.setFetch(async (_url, init) => { b.requests.push(init); throw Error('lost response'); });
  b.tracker.start();
  assert.equal(await b.tracker.flush(), false);
  assert.equal(await b.tracker.flush(), false);
  assert.equal(b.requests.length, 1);
  b.advance(1_000); await b.tracker.flush();
  b.advance(1_999); await b.tracker.flush(); assert.equal(b.requests.length, 2);
  b.advance(1); await b.tracker.flush();
  assert.equal(b.requests.length, 3); assert.equal(b.tracker.status().queued, 0);
  assert.equal(new Set(b.requests.map(r => String(r.body))).size, 1);
  b.tracker.stop();
});
test('permanent errors drop; 429 retries honor a bounded Retry-After; stale events expire', async () => {
  const b = browser();
  b.setFetch(async (_url, init) => { b.requests.push(init); return { status: 429, headers: new Headers({ 'Retry-After': '9999' }) }; });
  b.tracker.start(); await b.tracker.flush(); b.advance(29_999); await b.tracker.flush();
  assert.equal(b.requests.length, 1);
  b.advance(1); await b.tracker.flush(); assert.equal(b.requests.length, 2);
  b.advance(30_000); b.setFetch(async () => ({ status: 400 })); await b.tracker.flush();
  assert.equal(b.tracker.status().queued, 0);
  b.tracker.page(); b.advance(86_400_000); await b.tracker.flush();
  assert.equal(b.tracker.status().queued, 0); b.tracker.stop();
});
test('reload reuses a session after renewed consent; idle, separate tabs, and withdrawal rotate IDs', async () => {
  const first = browser(); first.tracker.start(); await first.tracker.flush();
  const firstId = JSON.parse(String(first.requests[0]!.body)).events[0].sessionId;
  const reload = browser(false, first.stored);
  assert.equal(reload.reads(), 0); reload.tracker.start(); await reload.tracker.flush();
  assert.equal(JSON.parse(String(reload.requests[0]!.body)).events[0].sessionId, firstId);
  reload.advance(30 * 60_000); reload.tracker.page(); await reload.tracker.flush();
  assert.notEqual(JSON.parse(String(reload.requests[1]!.body)).events[0].sessionId, firstId);
  const tab = browser(); tab.tracker.start(); await tab.tracker.flush();
  assert.notEqual(JSON.parse(String(tab.requests[0]!.body)).events[0].sessionId, firstId);
  first.tracker.stop(); first.tracker.start(); await first.tracker.flush();
  assert.notEqual(JSON.parse(String(first.requests[1]!.body)).events[0].sessionId, firstId);
  for (const b of [first, reload, tab]) b.tracker.stop();
});
test('exit delivery uses bounded keepalive and BFCache restores record a new visit', async () => {
  const b = browser(); b.tracker.start();
  for (let i = 0; i < 20; i++) b.tracker.page();
  b.emit('pagehide'); await Promise.resolve();
  assert.equal(b.requests[0]!.keepalive, true);
  assert.equal(JSON.parse(String(b.requests[0]!.body)).events.length, 10);
  const before = b.tracker.status().queued;
  b.emit('pageshow', { persisted: true });
  assert.equal(b.tracker.status().queued, before + 1);
  b.tracker.stop(); b.emit('pagehide'); b.emit('pageshow', { persisted: true });
  assert.equal(b.tracker.status().queued, 0);
});
test('queue capacity includes an in-flight batch and late failures do not undo withdrawal', async () => {
  const b = browser();
  let reject!: (error: Error) => void;
  b.setFetch(async () => new Promise((_resolve, fail) => { reject = fail; }));
  b.tracker.start(); for (let i = 0; i < 99; i++) b.tracker.page();
  const sent = b.tracker.flush();
  assert.equal(b.tracker.page(), false);
  b.tracker.stop(); reject(Error('offline')); await sent;
  assert.equal(b.tracker.status().queued, 0);
});
