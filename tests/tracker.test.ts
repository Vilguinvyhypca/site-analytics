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
function browser(blockStorage = false) {
  const stored = new Map<string, string>();
  let storageReads = 0;
  const requests: RequestInit[] = [];
  const intervals = new Set<() => void>();
  const location = { pathname: '/', search: '?token=secret&utm_source=fixture&utm_medium=email@example.com', origin: 'https://site.example' };
  let fetcher = async (_url: string, init: RequestInit) => { requests.push(init); return { status: 202 }; };
  const context = vm.createContext({ URL, URLSearchParams, Date, AbortController, crypto: { randomUUID },
    window: { location }, document: { referrer: 'https://referrer.example/private?token=secret' },
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
  return { tracker, stored, requests, intervals, location, reads: () => storageReads, setFetch: (fn: typeof fetcher) => { fetcher = fn; } };
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
  assert.equal(b.tracker.status().queued, 80);
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
