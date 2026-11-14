# Browser and privacy verification

Current development target: `/home/seodev/mediaspace-analytics-reconciled` on `feat/site-analytics-reconciled`. Run `npm run test:mediaspace` from Site Analytics using pinned Node 24. The harness creates synthetic media/catalog and disposable PostgreSQL, then exercises the actual application and collector. It cleans up the browser, services, database and generated media.

## Verified October 26, 2026

| Environment or case | Evidence/status |
| --- | --- |
| Desktop Chromium through agent-browser | Real app → collector → PostgreSQL journey passed |
| 390 × 844 Chromium viewport | SPA navigation passed; no horizontal gallery overflow. This is not a physical mobile-device test |
| Next Link → Photos, Back, Forward, Everything | Exact page-view sequence and unchanged tab session; retained page marker proves same-document navigation |
| Consented excluded query and fragment | No collection while excluded; returning records one new eligible view; sentinel absent from retained events |
| Background video tab | Actual visibilitychange includes hidden; engaged time remains unchanged across a 5.5-second hidden interval |
| Separate tabs and withdrawal | Distinct session IDs; withdrawal in one tab stops the other playing tab |
| Unavailable local consent storage | Consent fails closed; no collection |
| Unavailable session storage after consent | Events share a consistent memory-only session |
| Admin and private/unlisted exclusions | Signed-in browser adds no events; private/unlisted fixture IDs absent |
| Duplicate collection | One initial page view, legacy POST rejected, no parallel Experience event files |
| Native sharing/copy/cancel/failure and unmount | Focused component tests passed; real browser share-click integration also passed |
| Collector request bodies | Inspected 34 actual requests; no search sentinel, excluded query/fragment sentinel, media URLs, or private/unlisted fixture IDs |
| Firefox | Playwright 1.65.0 / Firefox 159.0 on Linux; consent, sanitized view, excluded-route and withdrawal journey passed November 8 |
| WebKit/Safari | Not verified. Playwright WebKit 27.2 binary downloaded, but host libraries are missing; system dependency installation was denied. Linux WebKit would not equal branded Safari |
| Physical iOS/Android devices | Not verified; narrow Chromium viewport is not equivalent |

The deterministic tracker suites also exercise measurement eligibility, pauses/seeks, queue bounds, retries and consent transitions. Those tests complement rather than replace browser evidence.

## November 8 Firefox/WebKit attempt

`npm run test:browser-matrix` now runs the standalone tracker consent journey
through Playwright Firefox and WebKit against the real collector route with a
synthetic in-memory store. Firefox passed: no events before consent, one
sanitized page view after consent, no event on an excluded route, and no
delivery after withdrawal. WebKit could not launch because the Linux host lacks
required libraries; installing those host packages was denied. The fixture and
test are reproducible on a host with the relevant Playwright browsers and
dependencies. This is not branded Safari coverage, nor a physical mobile test.

## Still open

Day 11 remains open for the additional browser/device matrix and lifecycle cases
not represented above. An opener-created same-origin tab correctly receives a
new session after its initial sessionStorage copy, but browser-menu duplication
without an accessible opener remains unverified. Standalone persisted-page
restoration passed; application-specific cache eligibility on MediaSpace remains
unverified. Actual Safari media/autoplay restrictions cannot be inferred from
Chromium viewport resizing. The absence of observed errors in a synthetic
journey does not establish overall reliability.

Production rollout additionally needs the legacy report migration decision: historical Experience reports, source attribution and document-load metrics are not silently merged with the new collector's data. See the reconciliation guide in the MediaSpace development checkout. Nothing in these tests authorizes production collection or deployment.

## October 28 lifecycle implementation

The tracker now handles persisted pageshow as a fresh eligible page view. A deterministic regression passes for ordinary-load deduplication, session continuity, excluded paths, withdrawal and listener cleanup across stop/start. The full project check passes (17 tests; six database cases skipped). This does not establish actual browser cache admission/restoration. The MediaSpace pinned bundle still contains the earlier tracker and needs an explicit update plus integration regression after browser verification.

## October 29 real browser verification

`npm run test:lifecycle` builds the tracker and runs an isolated Chromium HTTP fixture. The run passed: genuine persisted pageshow, retained document marker, fresh view with stable session ID, route deduplication and no events after withdrawal. This establishes standalone tracker restoration; it does not establish Next-specific cache eligibility or other browser engines.

The reconciled MediaSpace vendor bundle was refreshed (SHA-256 `538f6cf0c2e88cb048c812031dc38b28a1e1c82323d6ff184c96856488777d50`). Its complete browser/database journey passed again, including 34 collector requests audited for the existing private-data sentinels. This supersedes the October 28 pending bundle update above.

## October 29 copied opener-session verification

The lifecycle harness now opens a real same-origin child window and first asserts that its sessionStorage contains the parent's ID. Starting the child tracker produces a different session ID; reloading the child preserves that ID; the parent retains its own ID. All assertions passed alongside the existing cache-restoration checks. The automation client's tab list did not expose the child, so the fixture uses its actual same-origin window handle to inspect and operate it.

The fix is in the standalone tracker. MediaSpace's previously verified pinned bundle has not yet been refreshed for this change. Browser-menu duplication with no accessible opener and inaccessible/cross-origin opener cases remain limitations, not verified unique-tab guarantees.

The October 29 MediaSpace integration rerun against the copied-session bundle passed end to end. It inspected 33 collector requests; no configured privacy sentinel was present.
