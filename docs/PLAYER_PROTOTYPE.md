# Day 5 player measurement experiment

Day 9A update: the bounded measurement core now lives in `packages/tracker/src/measurement.ts` and is shared with the native production adapter. The harness below remains isolated. See [native tracker integration](NATIVE_VIDEO.md); Mux remains prototype-only.

The prototype demonstrates a shared media-event adapter on actual native `<video>`
and Mux Player 3.13.2 web components. It is isolated under `experiments/player` and
is **not exported in the production tracker**. No collector, visitor records,
production media, or credentials are used. All measurements stay in the test page.

## Reproduce

Use the pinned Node runtime described in DEVELOPMENT.md, plus `ffmpeg`. Supply an
installed Mux browser bundle explicitly; the experiment does not install packages
or depend on a hard-coded sibling checkout. For this workspace:

```bash
export PATH=/home/seodev/.local/share/site-analytics-node/bin:$PATH
MUX_PLAYER_BUNDLE=/home/seodev/sturdy-journey/node_modules/@mux/mux-player/dist/mux-player.mjs node scripts/player-prototype.mjs
# In a second terminal:
node scripts/check-player-prototype.mjs
```

The server binds to `127.0.0.1:4301`. It generates a 12-second synthetic WebM in
ignored `artifacts/`, serves byte ranges for real seeking, and bundles the experiment
in memory. Stop with Ctrl+C. Browser and ffmpeg subprocesses can require sandbox
approval. The Mux bundle is loaded read-only; no MediaSpace files are changed.
Verified bundle SHA-256:
`a08865aba49470165a445eee1e05573d1674a15ded5651164d429c829c05b6e5`.

Mux Data tracking and cookies are disabled; the test page's content security policy
restricts connections to the local origin. This tests Mux's public element API using
local media, **not Mux-hosted HLS delivery or signed-token playback**. Mux documents
native-compatible playback events in its [HTML API reference](https://www.mux.com/docs/guides/player-api-reference/html)
and access through a React ref in its [React API reference](https://www.mux.com/docs/guides/player-api-reference/react).

## Measurement behavior

- Measurement attaches only after the harness's explicit permission button. Each
  attachment has a content ID and a random playback ID. The host must dispose the
  old adapter before switching content/source, and attach a new one for that item.
- `playing` marks actual playback start. A paused, unopened player records zero time.
- A monotonic clock, media positions, media events and 250 ms local sampling measure
  elapsed time. Five-second cumulative summaries are local callbacks, not requests.
- The document must be visible and at least half the player must intersect the
  viewport. Pause, waiting, seeking, error and end disable accumulation. Observed
  playback progress bounds elapsed time, so an unchanged playhead adds nothing.
- Seek discontinuities and sampling gaps over 1.5 seconds are discarded. This is
  deliberately conservative: timer throttling or delayed events can undercount.
- Coverage merges actual eligible played intervals. Replaying adds elapsed time
  without duplicating unique coverage. Playback rate changes affect timeline
  coverage independently of elapsed seconds.
- Coverage thresholds are cumulative 25/50/75 percent flags. Completion requires an
  observed end and at least 95 percent unique coverage. Unknown duration has elapsed
  time but no percentage or completion. These are snapshot states, not repeated
  milestone events; production aggregation must preserve that distinction.
- Snapshots cap elapsed time at 24 hours and intervals at 100. Exceeding the interval
  cap sets `truncated`; production reporting needs a strategy for surfacing partial
  measurements. Do not silently treat this prototype as an exact accounting engine.
- Dispose normally for a final local summary (overlay close/navigation); dispose
  with withdrawal to detach timers/listeners without a final emission. The host
  clears its locally retained summaries on withdrawal.

## Evidence — October 10, 2026

`npm run check` includes deterministic tests covering seeks, replay, 2× speed,
ineligible states, stalls, scheduling gaps, unknown duration, the 95% completion
boundary, snapshot immutability and the interval bound.

The browser harness exercised both real player surfaces in Chromium. It verified
opening without play, actual `playing`/`seeking`/`seeked` events, pause, seeking to
seven seconds without counting the gap, 2× speed, actual offscreen intersection,
separate content/playback IDs, withdrawal, and complete 4× playback. The 12-second
fixture produced approximately 2.8–3.0 engaged seconds at 4× with 98–99.9% coverage;
both emitted end and met the agreed completion definition. Browser page errors:
none. Screenshot: ignored `artifacts/day-five-players.png`.

The first browser attempt exposed a harness error: missing HTTP byte-range support
made seeking restart at zero. The server now supports ranges and the test explicitly
checks the actual seek destination before checking coverage.

## What remains for Day 9 and integration

This is measurement-risk discovery, not the completed watch-time feature. Connect
adapters to the consent-controlled tracker queue; enforce page/admin/content
exclusions; validate events; implement idempotent project/playback/sequence
aggregation, cross-midnight allocation and reports. Handle late attachment to an
already-playing element, source changes, overlay close, looping and concurrent
feed players explicitly in the production integration.

Test real Mux HLS, token expiry, network buffering, real tab backgrounding, mobile
browsers, feed scroll containers and background scheduling before release. Pure
eligibility/stall tests do not establish those browser/network scenarios.

The prototype supports retaining the provisional **2–4 additional working packages**
for content engagement. Days 6–15 remain, including Day 9A–9C. There is no evidence
yet to reduce the estimate: production integration and idempotent aggregation are
still the largest unresolved work. Days are work packages, not calendar promises.

## Automated native-only regression — October 20, 2026

Run the repeatable native-video journey without a manual walkthrough:

```bash
export PATH=/home/seodev/.local/share/site-analytics-node/bin:$PATH
MUX_PLAYER_BUNDLE=/home/seodev/sturdy-journey/node_modules/@mux/mux-player/dist/mux-player.mjs npm run test:player
```

This starts its own harness on loopback port 4311, launches an isolated browser,
checks native playback and shuts both down. Mux's bundle is still a fixture dependency
of the shared harness; this command exercises only native video. It leaves the
manual test servers and database alone. Requires ffmpeg and the installed browser.

Assertions cover consent off, actual playback, stable watch time while paused,
paused seeking without added coverage, a bounded 1× end segment, incomplete status
when part of the video was skipped, the independent native output, 2× replay without
inflated unique coverage, and withdrawal beyond a heartbeat. The deterministic
suite also covers the exact 10.196-to-12-second interval and a long paused gap.

Latest result: 2.997 seconds for a three-second play; 1.802 engaged seconds for the
final 1.804 seconds of content at 1×; 0.700 elapsed seconds during 2× replay. All
assertions passed. The earlier manual 2.876-second increase was not reproduced;
its cause remains unconfirmed because that run's rate/event history is unavailable.
Do not describe it as a proven bug fix or proof of universal browser correctness.
