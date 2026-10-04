# Day 5 prototype verification

Verified October 4, 2026 (America/New_York).

## Change

Added automatic SPA path tracking, popstate and BFCache handling, bounded
same-ID retries/backoff, Retry-After handling, stale-event removal, best-effort
keepalive delivery, and cleanup on consent withdrawal. Queue limits now include
in-flight events. Expanded the disposable fixture with SPA navigation, attempt
inspection, and a simulated lost successful response.

## Automated evidence

`npm run check` passed ESLint, strict TypeScript/Angular checks, all 15 tests,
and all four workspace builds. The standalone minified bundle is approximately
4.7 KiB. New tests cover SPA route exclusions, preserving history exceptions and
restoring hooks, three-attempt bounds, identical retry IDs/payloads, backoff,
429 Retry-After caps, permanent errors, expiry, reload/new-tab/withdrawal session
behavior, keepalive batch bounds, BFCache restoration, and in-flight queue limits.
A fake clock exercises expiry and retry boundaries without real-time delays.

## Chromium → real API → disposable PostgreSQL

Used the loopback fixture (site 4302, API 4102, temporary PostgreSQL 55435) and
inspected actual stored rows and attempt results. No persistent project was enabled.
The page rendered correctly and browser runtime-error inspection was empty.

| Action | Expected / observed cumulative rows |
| --- | --- |
| Load, decline, attempt a visit | 0 |
| Allow home, SPA gallery, Back, Forward | 4; paths `/`, `/gallery`, `/`, `/gallery`; one session |
| Record with simulated lost response, then retry | 5; first attempt stored 1 and returned 503; same-ID retry returned 202 with accepted 0 / duplicates 1 |
| Navigate to excluded `/admin` | 5 |
| Return to `/gallery` | 6 |
| Reload, then renew consent | 7; same session; off until renewal |
| Queue visit and immediately navigate away | 8; keepalive delivery succeeded |
| Open an independent new tab and allow | 9; second session |
| Age saved test session beyond 30 minutes, reload, allow | 10; third session |
| Queue then withdraw and attempt send | 10; storage cleared and pending visit discarded |

The session-age browser test edited only the fixture's synthetic sessionStorage;
unit tests additionally advance time while the same page is live. The test browser
was closed and the disposable fixture shut down after verification.

## Remaining limits and estimate

Day 5 required one implementation/verification session, including a TypeScript
annotation correction. The prototype now demonstrates the full browser/API/data
flow, but it is not production ready. Keep the remaining estimate as ten planned
work packages (Days 6–15), plus outstanding Day 1 decisions; these are work units,
not a promise of ten calendar days. Authentication and reporting are still ahead,
so this prototype does not justify compressing the deployment estimate.

Independent tabs were verified; opener-created or duplicated tabs may inherit
sessionStorage and therefore share an ID. Strict clone isolation remains a
browser-matrix follow-up. BFCache is unit-tested; cross-browser BFCache and exit
reliability remain Day 11 work. Exit delivery is best effort and can lose queued
visits. Server capacity/abuse tests, production consent, retention, deployment,
and MediaSpace integration remain in their existing planned milestones.
