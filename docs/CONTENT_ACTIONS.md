# Content actions and playback aggregation

## Explicit browser hooks

The tracker provides `contentOpen()` and `recordShare()`. These record an action the host has observed; they do not open a dialog, access the clipboard, or send content to anyone. Each call requires a stable content ID and a host-verified public-content predicate, plus active tracker consent and an allowed route.

```js
const content = {
  contentId: 'public-video-123',
  isPublic: () => currentContent.visibility === 'public'
};
// Call when the visitor actually opens the item, not when its thumbnail renders.
analytics.contentOpen({ ...content, contentType: 'video' });
// Call on the share button action.
analytics.recordShare({ ...content, outcome: 'clicked' });
// Separately, after the host has observed a successful clipboard write:
analytics.recordShare({ ...content, outcome: 'copied' });
```

Allowed share outcomes are `clicked`, `copied`, `handoff`, `cancelled` and `failed`. Report `handoff` only after the native sharing API resolves; it is not proof of delivery. Distinguish a user cancellation from another failure. Do not report a successful outcome when an API is absent, rejects, or is still pending. The host should capture the content identity at action start and recheck its visibility at completion.

Content types are `photo` and `video`. Methods return true when queued, false when blocked/invalid/full; true does not guarantee delivery. They catch a throwing public predicate and fail closed. They collect only the declared identifiers and outcome/type, not shared URLs, message bodies, clipboard contents or recipient data. Consent withdrawal and route exclusions still apply when an asynchronous share operation finishes.

Every explicit call is a separate observation with a new event ID. Transport retries preserve that ID and are deduplicated by the collector. Calling a hook twice manually is two observations. A click and a copy are different stages, not two successful shares. There is no attempt ID correlating stages yet; report counts by outcome, not a distinct-share conversion rate. Explicit [click/custom/scroll tracking](INTERACTIONS.md) is available. Thumbnail impressions and site-specific sharing UI wiring remain integration tasks.

## Playback aggregation

Migration `004_playback_summaries.sql` adds a read-through SQL view, `playback_summaries`, and a playback lookup index. It derives one row per project/playback directly from retained raw events, so existing events need no rebuild or background backfill. It is not a materialized counter or a public API; the authenticated [Day 9C reporting routes](ENGAGEMENT_REPORTS.md) consume these summaries.

- Identity is project + playback ID, bound to one content ID and anonymous session. The collector serializes overlapping playback updates with sorted transaction-scoped locks.
- The highest sequence's cumulative snapshot supplies engaged seconds, duration, intervals and end status. Older arrivals never replace it. Identical repeated sequences with new event IDs still contribute only one summary, although their raw events remain stored.
- Conflicting values at the same sequence, changing content/session identity, conflicting start autoplay flags, or engaged seconds decreasing as sequence increases reject the entire batch with 409. No raw inserts from that batch remain. CORS allows the originating tracker to observe 409 and discard a permanent failure rather than retry it forever.
- Retries of an already stored event ID remain no-ops. Sequence identity excludes event ID and occurrence timestamp; those envelope differences do not multiply progress.
- Coverage is the sum of the latest nonoverlapping intervals divided by known duration. It is not the sum across snapshots. Duration/intervals may change (for example, metadata correction); latest sequence is authoritative, while cumulative engaged seconds must be monotonic.
- `started` means an actual start event was received. Progress can arrive before its start and is retained without fabricating a start. Completion requires a received start, an observed end, and at least 95% unique coverage. Unknown duration has null coverage and cannot complete.
- Start-only attempts have zero progress and sequence 0. Repeat playback within the same attempt may increase engagement beyond duration; repeated starts do not add attempts. Multiple playback IDs remain separate.
- `first_observed_at`/`last_observed_at` bound observed event times. `started_at` is the earliest occurrence time among received start events, or null; `latest_received_at` is receipt freshness. These do not prove that all events arrived.

The view uses all retained data for an attempt. The [engagement report](ENGAGEMENT_REPORTS.md) defines first-observed cohort attribution; filtering raw cumulative events to a date range and summing them is incorrect. Removing raw events changes the view automatically. Retention cleanup therefore needs a deliberate policy for attempts spanning the boundary.

For pre-migration historical identity conflicts, the earliest receipt (event ID as tie-break) anchors identity; conflicting rows do not join that summary. Historical equal-sequence disagreements use the earliest receipt. New conflicts are rejected. Prior data is not silently rewritten. Measurements remain bounded but untrusted browser observations, not audit-grade records.

## Automated verification

`npm run check` includes hook consent/privacy/outcome/retry tests. `npm run test:db` tests exact aggregation, progress-before-start, duplicate and reordered sequences, concurrency, conflict rollback, unknown duration, completion, project isolation, distinct sharing outcomes and view updates after raw deletion. `npm run test:native-tracker` verifies real native playback and content/share hooks through the browser, collector, raw storage and playback view. Only synthetic local fixtures are used.

Production capacity and retention enforcement remain later work. The view calculates summaries at read time; production query costs need the planned load tests before claiming operating capacity.
