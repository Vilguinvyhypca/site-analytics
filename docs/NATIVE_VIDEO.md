# Native video tracking

The standalone tracker supports explicit registration of standard HTML `<video>` elements. It does not scan the page or automatically identify content. Mux remains outside this integration; the earlier Mux prototype is separate.

```js
const analytics = SiteAnalytics.createTracker({
  projectId: 'your-project',
  collectionUrl: 'https://analytics.example/api/collect',
  publicPath: url => url.pathname === '/videos' ? '/videos' : null
});
const registration = analytics.trackVideo(videoElement, {
  contentId: 'public-video-123',
  isPublic: () => currentContent.visibility === 'public',
  autoplay: false
});
// Use host-verified visibility metadata, never infer it from a signed media URL.
// Registration alone does not start measurement or send events.
analytics.start(); // only after consent
// Before closing the overlay, removing the element, or assigning different content:
registration.detach();
// On consent withdrawal, discard queued data and stop all registered adapters:
analytics.stop();
```

`isPublic` is required and must reflect current, host-verified public visibility. The route allowlist must also permit collection. A false/throwing visibility check stops recording and resets the current attempt. Already accepted public events are not deleted by withdrawal. Do not register private/unlisted media or admin views. Never send raw media URLs, titles or account IDs as content identifiers.

Register each element once; duplicate registration throws. Detach before reusing an element for another content ID. A detached handle is idempotent. Registering before consent is inert: no observer, timer, session storage or request starts until `start()`. `stop()` disposes active adapters without a final report, aborts in-flight delivery and drops queued events; registrations remain for a later explicit `start()`, which starts fresh playback IDs. Detach releases the registration permanently. At most 20 video elements can be registered per tracker. Browsers without IntersectionObserver do not record video engagement; ordinary page tracking remains available.

## Measurements and lifecycle

Actual playback produces a `playback_start`, even if offscreen; visibility determines engaged time, not whether the player started. The optional autoplay flag is declared by the host (defaults false), not proof of a human gesture. Opening/attaching a paused player creates no playback start. A player already running at consent begins measurement from its current position, without retroactive watch time.

Engaged time accumulates monotonic elapsed seconds only while the player is playing, not paused/seeking/buffering, at least 50% visible, with a visible document. Samples occur every 250ms and reconcile against media advancement and playback speed. Gaps over 1.5 seconds are conservatively discarded. Unique coverage unions observed intervals; skipped segments do not count and repeats do not inflate coverage. Unknown/nonfinite durations retain elapsed time but no intervals or completion. Measurement is capped at 86,400 seconds and 100 coverage intervals; excess intervals are omitted conservatively.

Progress is a cumulative snapshot, with a playback ID and increasing sequence. Changed snapshots are queued every five seconds and on pause, waiting, end, error, hidden document, page exit or detach. Unchanged snapshots are suppressed. Normal queue delivery runs every two seconds; final delivery is best effort and can be lost on abrupt termination. A report is not evidence of a complete session.

Replay/looping within one attached attempt keeps its playback ID and unions coverage; elapsed engagement can increase. Source replacement, loss of public eligibility, consent restart, and resumption after session expiry create fresh attempts. Source comparison stays local; URLs never enter event payloads. Detach before replacing a source to preserve the last available summary and bind the new content explicitly. Different registered players keep independent IDs and measurements; concurrent eligible players may each accrue time, which is not a claim of exclusive human attention.

The existing bounded queue (100 events, 50 per request, 64 KiB body), backoff and event-ID deduplication apply. Queue exhaustion or lost final requests may undercount. Raw progress rows must **not** be summed: use the [Day 9B summary view and conflict rules](CONTENT_ACTIONS.md). The traffic dashboard still counts only page views; video reporting is Day 9C. Completion requires a received start and an observed end plus at least 95% unique coverage, not merely reaching the end by seeking.

## Verification

- `npm run check`: shared measurement regressions and adapter lifecycle tests, plus lint, type checks and builds.
- `npm run test:native-tracker`: generated 12-second native fixture → real browser → collector → temporary PostgreSQL. No Mux dependency or production configuration. Uses loopback ports 4313 and 55437 and cleans up afterward.
- `npm run test:db`: collector/auth/report database regressions, including event deduplication and project isolation.

The native browser script checks denied consent, playback/pause, seek-to-end bounds, 2× replay, separate players, private-content exclusion, final detach, different-content reattachment, duplicate delivery and withdrawal beyond a heartbeat. Deterministic tests cover offscreen/hidden state, buffering, session expiry and retry identity. Physical mobile browsers, real MediaSpace feed/overlay integration and production capacity remain later work.
