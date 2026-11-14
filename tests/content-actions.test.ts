import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnalyticsEvent, ShareEvent } from '@site-analytics/contracts';
import { createTracker } from '../packages/tracker/src/index.js';

test('content opens and sharing outcomes require consent, public content and an eligible route', async () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const batches: AnalyticsEvent[][] = [];
  let fail = false, publicContent = true, checks = 0;
  const globals = {
    location: { href: 'https://public.example/' }, history: { pushState() {}, replaceState() {} },
    document: Object.assign(new EventTarget(), { referrer: '', visibilityState: 'visible' }), window: new EventTarget(),
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async (_url: string, options: RequestInit) => { batches.push(JSON.parse(options.body as string).events); return { ok: !fail, status: fail ? 503 : 202 }; }
  };
  for (const [key,value] of Object.entries(globals)) { originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{configurable:true,writable:true,value}); }
  const tracker = createTracker({ projectId: 'test', collectionUrl: '/api/collect', publicPath: url => url.pathname === '/' ? '/' : null });
  const action = { contentId: 'video-1', isPublic: () => { checks++; return publicContent; } };
  const drain = async () => { await new Promise(resolve => setImmediate(resolve)); await tracker.flush(); };
  try {
    assert.equal(tracker.contentOpen({ ...action, contentType: 'video' }), false);
    assert.equal(tracker.recordShare({ ...action, outcome: 'clicked' }), false); assert.equal(checks,0);
    tracker.start(); await drain();
    assert.equal(tracker.contentOpen({ ...action, contentType: 'video' }), true); await drain();
    for (const outcome of ['clicked','copied','handoff','cancelled','failed'] as const) { assert.equal(tracker.recordShare({ ...action, outcome }), true); await drain(); }
    const shares = batches.flat().filter((e): e is ShareEvent => e.type === 'share');
    assert.deepEqual(shares.map(e => e.outcome), ['clicked','copied','handoff','cancelled','failed']);
    assert.equal(new Set(shares.map(e => e.eventId)).size, 5);
    assert.equal(new Set(batches.flat().map(e => e.sessionId)).size, 1);
    publicContent = false; assert.equal(tracker.recordShare({ ...action, outcome:'copied' }), false);
    publicContent = true; globals.location.href = 'https://public.example/admin'; assert.equal(tracker.contentOpen({ ...action, contentType:'photo' }), false);
    globals.location.href = 'https://public.example/';
    assert.equal(tracker.recordShare({ ...action, contentId:'https://secret.example/signed', outcome:'copied' }), false);
    assert.equal(tracker.recordShare({ ...action, isPublic: () => { throw Error('private metadata unavailable'); }, outcome:'copied' }), false);
    assert.equal(tracker.recordShare({ ...action, outcome: 'delivered' as 'copied' }), false);
    fail = true; tracker.recordShare({ ...action, outcome:'failed' }); await drain();
    const failed = batches.at(-1)![0]; fail = false; await tracker.flush(); assert.equal(batches.at(-1)![0].eventId, failed.eventId);
    tracker.stop(); const count = batches.length;
    assert.equal(tracker.recordShare({ ...action, outcome:'copied' }), false); await drain(); assert.equal(batches.length,count);
  } finally { tracker.stop(); for (const [key,value] of originals) { if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key); } }
});
