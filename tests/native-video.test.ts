import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnalyticsEvent, PlaybackProgress } from '@site-analytics/contracts';
import { createTracker } from '../packages/tracker/src/index.js';

test('native adapter consent, lifecycle, visibility, seeks, session renewal and delivery retries', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'] });
  let now = 0, isPublic = true, observers = 0;
  class Video extends EventTarget {
    currentTime = 0; duration = 12; playbackRate = 1; paused = true; seeking = false; readyState = 4; isConnected = true; currentSrc = 'https://private-cdn.example/signed?secret=abc';
  }
  const visibilityCallbacks: ((entries: object[]) => void)[] = [];
  const batches: AnalyticsEvent[][] = [];
  let failure = false;
  const values = new Map<string, string>();
  const globals = {
    HTMLVideoElement: Video,
    IntersectionObserver: class {
      constructor(callback: (entries: object[]) => void) { observers++; visibilityCallbacks.push(callback); }
      observe() { visibilityCallbacks.at(-1)!([{ isIntersecting: true, intersectionRatio: 1 }]); }
      disconnect() { observers--; }
    },
    performance: { now: () => now },
    location: { href: 'https://site.example/video' },
    history: { pushState() {}, replaceState() {} }, window: new EventTarget(),
    document: Object.assign(new EventTarget(), { referrer: '', visibilityState: 'visible' }),
    sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    fetch: async (_url: string, options: RequestInit) => { batches.push(JSON.parse(options.body as string).events); return { ok: !failure, status: failure ? 503 : 202 }; }
  };
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const tracker = createTracker({ projectId: 'native-test', collectionUrl: '/api/collect', publicPath: url => url.pathname === '/video' ? '/video' : null });
  const player = new Video();
  const tick = (seconds: number, advance = seconds) => {
    for (let i = 0; i < seconds * 4; i++) { now += 250; player.currentTime += advance / (seconds * 4); t.mock.timers.tick(250); }
  };
  const event = (name: string) => player.dispatchEvent(new Event(name));
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  const drain = async () => { await settle(); await tracker.flush(); await settle(); };
  const all = () => batches.flat();
  const progress = () => all().filter((e): e is PlaybackProgress => e.type === 'playback_progress').at(-1)!;
  try {
    const handle = tracker.trackVideo(player as unknown as HTMLVideoElement, { contentId: 'video-a', isPublic: () => isPublic });
    assert.equal(observers, 0); assert.equal(values.size, 0);
    player.paused = false; event('playing'); tick(1); await drain(); assert.equal(batches.length, 0);
    player.paused = true; player.currentTime = 0;
    tracker.start(); await drain(); assert.equal(observers, 1);
    tick(1, 0); await drain(); assert.equal(all().filter(e => e.type === 'playback_start').length, 0);
    player.paused = false; event('playing'); tick(2); player.paused = true; event('pause'); await drain();
    assert.equal(progress().engagedSeconds, 2);
    const firstId = progress().playbackId, firstSession = progress().sessionId;
    tick(2, 0); await drain(); assert.equal(progress().engagedSeconds, 2);
    player.seeking = true; event('seeking'); player.currentTime = 10; tick(0.25, 0); player.seeking = false; event('seeked');
    player.paused = false; event('playing'); tick(2); player.paused = true; event('ended'); await drain();
    assert.equal(progress().engagedSeconds, 4); assert.equal(progress().ended, true);
    assert.deepEqual(progress().coveredIntervals, [[0, 2], [10, 12]]);
    player.seeking = true; event('seeking'); player.currentTime = 0; player.seeking = false; event('seeked');
    player.playbackRate = 2; event('ratechange'); player.paused = false; event('playing'); tick(1, 2); player.paused = true; event('pause'); await drain();
    assert.equal(progress().engagedSeconds, 5); assert.deepEqual(progress().coveredIntervals, [[0, 2], [10, 12]]);
    visibilityCallbacks.at(-1)!([{ isIntersecting: false, intersectionRatio: 0 }]);
    player.paused = false; event('playing'); tick(1, 2); player.paused = true; event('pause'); await drain();
    assert.equal(progress().engagedSeconds, 5);
    visibilityCallbacks.at(-1)!([{ isIntersecting: true, intersectionRatio: 1 }]);
    globals.document.visibilityState = 'hidden'; globals.document.dispatchEvent(new Event('visibilitychange'));
    player.paused = false; event('playing'); tick(1, 2); player.paused = true; event('pause'); await drain();
    assert.equal(progress().engagedSeconds, 5);
    globals.document.visibilityState = 'visible'; globals.document.dispatchEvent(new Event('visibilitychange'));
    player.paused = false; event('playing'); tick(0.5, 1); event('waiting'); tick(1, 0); event('playing'); tick(0.5, 1); player.paused = true; event('pause'); await drain();
    assert.equal(progress().engagedSeconds, 6);
    isPublic = false; const beforePrivate = all().length; player.paused = false; event('playing'); tick(6, 0); await drain(); assert.equal(all().length, beforePrivate);
    isPublic = true; tick(0.5, 1); player.paused = true; event('pause'); await drain(); assert.notEqual(progress().playbackId, firstId);
    const beforeSession = progress().playbackId;
    tick(1801, 0); player.currentTime = 0; player.paused = false; event('playing'); tick(0.5, 1); player.paused = true; event('pause'); await drain();
    assert.notEqual(progress().playbackId, beforeSession); assert.notEqual(progress().sessionId, firstSession);
    failure = true; player.paused = false; event('playing'); tick(0.5, 1); player.paused = true; event('pause'); await settle();
    const retryIds = batches.at(-1)!.map(e => e.eventId); failure = false; await tracker.flush();
    assert.deepEqual(batches.at(-1)!.map(e => e.eventId), retryIds, 'retry keeps event identity');
    const secondPlayer = new Video();
    const secondHandle = tracker.trackVideo(secondPlayer as unknown as HTMLVideoElement, { contentId: 'video-b', isPublic: () => true });
    assert.equal(observers, 2);
    player.currentTime = 0; player.currentSrc = 'https://cdn.example/video-b'; secondPlayer.currentTime = 0;
    player.paused = false; event('playing'); secondPlayer.paused = false; secondPlayer.dispatchEvent(new Event('playing'));
    for (let i = 0; i < 4; i++) {
      now += 250; player.currentTime += 0.25; secondPlayer.currentTime += 0.25; t.mock.timers.tick(250);
    }
    player.paused = true; event('pause');
    for (let i = 0; i < 2; i++) {
      now += 250; secondPlayer.currentTime += 0.25; t.mock.timers.tick(250);
    }
    secondPlayer.paused = true; secondPlayer.dispatchEvent(new Event('pause')); await drain();
    const firstConcurrent = all().filter((e): e is PlaybackProgress => e.type === 'playback_progress' && e.contentId === 'video-a').at(-1)!;
    const secondConcurrent = all().filter((e): e is PlaybackProgress => e.type === 'playback_progress' && e.contentId === 'video-b').at(-1)!;
    assert.notEqual(firstConcurrent.playbackId, secondConcurrent.playbackId, 'concurrent players have separate playback identities');
    assert(firstConcurrent.engagedSeconds > 0 && firstConcurrent.engagedSeconds < 2);
    assert(secondConcurrent.engagedSeconds > 0 && secondConcurrent.engagedSeconds < 2);
    assert(secondConcurrent.coveredIntervals[0][1] > firstConcurrent.coveredIntervals[0][1], 'switching playback to another video only advances that video');
    secondHandle.detach();
    tracker.stop(); assert.equal(observers, 0); assert.equal(values.size, 0);
    const beforeStop = all().length; tick(6, 0); event('playing'); await drain(); assert.equal(all().length, beforeStop);
    tracker.start(); await drain(); assert.equal(observers, 1);
    handle.detach(); handle.detach(); await drain(); assert.equal(observers, 0);
    assert(!JSON.stringify(batches).includes('private-cdn')); assert(!JSON.stringify(batches).includes('secret'));
  } finally { tracker.stop(); t.mock.timers.reset(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
});
