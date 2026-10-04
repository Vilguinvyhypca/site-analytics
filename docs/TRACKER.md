# Opt-in browser tracker

Build with `npm run build -w @site-analytics/tracker`. Serve
`packages/tracker/dist/tracker.js` from the host site and load it before the
consent integration. Loading the script and creating a tracker do not read
browser storage or send events.

```html
<script src="/tracker.js"></script>
<script>
const analytics = SiteAnalytics.createTracker({
  projectId: '22222222-2222-4222-8222-222222222222',
  collectionUrl: 'https://analytics.example/v1/collect/22222222-2222-4222-8222-222222222222',
  pages: { '/': '/', '/gallery': '/gallery' },
  campaigns: { source: ['newsletter'], medium: ['email'], campaign: ['launch'] }
});
// Call only after the host has resolved consent, authentication, and visibility.
// analytics.start();
// On withdrawal or entry into an excluded user/visibility state:
// analytics.stop();
</script>
```

The collector project must separately be enabled and allow the exact host origin.
The script never enables a project. HTTPS is required except on loopback hosts.
Configuration errors throw at initialization; call the integration separately
from essential page functionality. Collection and network failures are contained.

## Public API

- `start()` opts in, queues the current allowed page, and starts a two-second
  flush timer. Repeated starts do not add another visit or timer.
- `page()` queues the current allowed page while enabled. It returns whether
  a visit was queued. Automatic SPA route detection is Day 5 work.
- `flush()` sends up to ten queued events and resolves to true only for HTTP
  202 while still in the same consent generation. It never rejects for network
  failure. Timer flushes use the same path.
- `stop()` disables collection, clears the queue/timer, aborts the current
  request, and removes the session key. Already received events cannot be recalled.
- `status()` on the instance reports enabled state and queue length. The
  top-level `SiteAnalytics.status()` describes the inert factory, not an instance.

Use one instance per project per page. Consent itself is not persisted: after a
full reload the host must resolve permission and explicitly call `start()` again.

## Data boundaries and delivery

Only exact paths in `pages` are collected, using the supplied safe label.
Configure public paths and non-sensitive labels only; do not enumerate private
paths, email addresses, tokens, or personal identifiers. `/admin` and `/api`
paths are always rejected. Queries and fragments never enter the page label.
Encoded/international paths are currently excluded by the v1 contract.

On the first event of a session, source/medium/campaign are included only when
both syntactically safe and explicitly listed in `campaigns`. Referrers are
reduced to an external HTTP(S) hostname, with no path, query, or credentials.
Same-origin referrers are omitted. Subsequent page views omit attribution so
reporting can use the first event rather than treating internal visits as direct.
No form data, page text, titles, cookies, or search text are collected.

Session IDs use browser `crypto.randomUUID()` and project-specific sessionStorage.
The ID rotates after 30 minutes without a queued event. Blocked storage falls
back to memory. Session storage may be copied into an opener-created tab by the
browser; strict new-tab isolation and the broader reload/navigation matrix need
Day 5 verification. There is no cross-device identity. Tracking fails closed if
secure UUID generation is unavailable.

The memory queue holds at most 100 events, dropping newer events when full.
Each request contains at most ten bounded events, below the 32 KiB API limit.
Only one request is active per instance; it times out after five seconds and
omits credentials and the HTTP referrer. Failed batches are dropped in Day 4.
There are no retries, persistent offline queues, or exit beacons yet; these are
Day 5 work. Closing a page can lose unsent visits.

## Disposable browser fixture

Run `npm run dev:fixture`, then open `http://localhost:4302`. This builds the
standalone bundle in memory, starts the API on loopback port 4102 and an isolated
PostgreSQL cluster on port 55435, migrates it, and enables only its disposable
fixture project. It does not read `.env`, use persistent development data, or
change production. Ctrl+C closes services and removes temporary data.

Allow analytics, then send pending visits. Decline/withdraw must send nothing.
The counter button demonstrates that ordinary page interaction works independently.
Navigation deliberately resets consent to off.

The fixture alone exposes loopback test controls (not application API routes):
`GET /__test/events` reads synthetic rows; `POST /__test/failure` toggles simulated
503 responses to collection. These controls are never installed in the production
API. Only run the fixture locally with disposable test interactions.
