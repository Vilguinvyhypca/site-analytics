# Day 4 verification

Verified October 4, 2026 (America/New_York).

## Implemented

The standalone bundle exposes an explicit tracker factory with start/stop,
manual page recording, bounded batching, safe page labels, campaign allowlists,
referrer-host reduction, and project-specific anonymous session storage.
A loopback fixture exercises the actual collection API and disposable PostgreSQL.
See [tracker integration](../TRACKER.md) for limits and reproduction instructions.

## Automated checks

`npm run check` passed lint, TypeScript/Angular types, all 9 unit tests, and all four
workspace builds. Tracker tests exercise inert loading, consent gating, API-valid
sanitized batches, one-time attribution, storage denial, excluded paths, queue
and batch bounds, network failure, and consent withdrawal during a request.

## Real Chromium → API → PostgreSQL

Ran `npm run dev:fixture` outside the sandbox with disposable PostgreSQL on
55435, the real API on 4102, and the static site at `http://localhost:4302`.
Ports 4300 and 55434 were already occupied, so the fixture uses distinct ports.
Chromium required `--args '--no-sandbox'` on this Ubuntu host.

- Page rendered with the expected consent, navigation, and interaction controls;
  screenshot inspected. No browser runtime errors were reported.
- Before consent: zero sessionStorage entries, zero collection requests, zero rows.
- Decline plus an attempted visit: still zero storage, requests, and rows.
- Allow plus send: exactly one `page_view` row for `/`, with the three approved
  campaign values. The test URL's `token=should-not-leak` was absent from storage.
- Simulated collector HTTP 503: row count stayed at one, a clear failure status
  appeared, and the independent counter still incremented. No unhandled JS error.
- Queue a visit then withdraw: sessionStorage emptied; sending added no rows.
- Follow Gallery, allow, and send: one additional `/gallery` row, for two total.
- Navigate to `/admin` and allow: zero collection requests on that page and the
  database remained at two rows.

The browser was closed after verification. A shutdown test exposed a pool error
when embedded PostgreSQL handled the same signal first; the fixture now handles
idle-pool shutdown errors and requests automatic deletion of its temporary cluster.
A second startup/browser/shutdown check passed without the unhandled error;
the temporary cluster directory was removed.

## Limits

This is local development verification, not a production rollout or browser matrix.
No persistent project was enabled and MediaSpace was not changed. Day 5 still
needs automatic SPA navigation, bounded retries, exit delivery, and the broader
reload/multi-tab/session-expiration matrix. Failed batches are currently dropped.
Authentication, reporting, capacity testing, and production consent decisions
remain later work.
