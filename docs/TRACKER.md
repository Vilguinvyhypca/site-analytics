# Browser tracker — Days 4–5

The standalone IIFE exports `SiteAnalytics.createTracker`. It does nothing until
`start()` is called by the host after consent. `start()` records one eligible
page view; repeated starts are inert. `pageView()` records another eligible view;
`flush()` sends queued events and resolves to a success boolean. `stop()` clears
queued events, aborts the active request, removes the tab session, and stops timers.
A request already received by the server cannot be recalled by withdrawal.

```js
const tracker = SiteAnalytics.createTracker({
  projectId: 'static-dev',
  collectionUrl: 'http://127.0.0.1:3101/api/collect',
  publicPath: url => url.pathname === '/' ? '/' : null
});
// Host consent UI calls tracker.start() or tracker.stop().
```

`publicPath` is required and fails closed: return a sanitized public path or null.
Use an explicit allowlist and server-verified visibility for dynamic media routes;
do not pass arbitrary paths containing personal identifiers. The tracker validates
paths and rejects queries/fragments, control characters, whitespace and backslashes.
Referrers contain only an eligible HTTP(S) hostname. Requests omit credentials
and the HTTP referrer. No form values or DOM text are read.

Sessions are random UUIDs stored per project in sessionStorage, saved only after consent
and an eligible event, with a memory fallback if session storage is unavailable.
Thirty minutes without a recorded eligible interaction resets the session.
Consent itself is owned by the host and is not persisted by this package.

When a same-origin opener is accessible and its session ID matches the copied
stored ID, the child starts a new session. Child reloads retain that new ID and
do not alter the parent's session. Browser-menu duplication without an accessible
opener is not covered by this detection: copied storage can still share an ID.
Cross-origin/inaccessible openers retain normal stored-session behavior. Therefore
session counts must not be described as guaranteed unique physical tabs.

The queue holds at most 100 events and drops newest overflow. Flush runs every
two seconds with at most 50 events / 64 KiB UTF-8 per request; only one request is
active at a time. Requests time out after five seconds. Client-side navigation uses
`pushState`, `replaceState`, back/forward and hash changes. It records a new page view
only when the sanitized public path changes, so query-only changes do not duplicate
views. Excluded paths reset route comparison and never create events.

A persisted `pageshow` (back/forward-cache restoration) starts a fresh page view
when the tracker is enabled and the host's public-path policy still permits it.
Normal `pageshow` does not duplicate the initial view. Restoration keeps the
session subject to its usual inactivity expiry; `stop()` removes the handler.
The host must keep consent/authentication eligibility current in its policy.

Network errors, HTTP 429 and server errors retry with exponential delays, capped at
30 seconds and five automatic retries per failure streak. Periodic and navigation
flushes respect pending backoff; page exit may make a final best-effort attempt. Other client errors are
discarded as permanent. A later explicit `flush()` starts a new retry streak. When
the document is hidden or exits, the tracker makes one best-effort keepalive request.
The server may receive a request after the browser begins closing; delivery is not
guaranteed. Player measurement remains later work.

## Reproduce the isolated browser check

```bash
npm run build -w @site-analytics/tracker
node --import tsx scripts/verify-browser-tracker.mjs
```

This creates synthetic data in a temporary PostgreSQL database on port 55434,
an opt-in collector on port 3101, and a static site on port 4300. It does not read
production configuration or alter the normal development database. Stop with Ctrl+C
to stop PostgreSQL and remove the temporary database. The site resets consent on
reload. With the servers running, the reproducible browser/database assertions are:

```bash
node scripts/check-browser-tracker.mjs
```

The check uses agent-browser with container-compatible `--no-sandbox`, verifies
zero new rows after denial, one new row after permission, no additional rows after
withdrawal, navigation/history, sanitized route deduplication, excluded URLs, reload
session continuity, expiry, duplicate retries after a lost response, actual page-exit
delivery, and a caught failed request. It asserts exactly ten new database rows. Screenshot: ignored local
`artifacts/day-four-consent.png`. Socket/browser execution may require sandbox approval.

## Native video registration

Use `tracker.trackVideo(videoElement, { contentId, isPublic, autoplay })` for explicitly selected public HTML video elements. Registration is inert before consent; `start()` activates measurement and `stop()` discards queued data and removes active observers/listeners. The returned `detach()` releases an element and queues its last permitted snapshot before it is removed. See [native-video integration and verification](NATIVE_VIDEO.md) for lifecycle rules and measurement limits. No raw media URLs are sent. Playback snapshots are cumulative and must not be summed; use the [playback summary view](CONTENT_ACTIONS.md) rather than adding raw rows.

## Content and sharing actions

`trackImpression(element, { contentId, contentType, isPublic })` measures explicitly registered thumbnails after consent, at 50% viewport intersection for one continuous second. See [impression rules and limits](IMPRESSIONS.md).

`contentOpen({ contentId, contentType, isPublic })` records an explicit open. `recordShare({ contentId, outcome, isPublic })` records a host-observed share outcome. Both require consent and public content on an allowed route, and return whether an event was queued. See [action hooks and aggregation rules](CONTENT_ACTIONS.md) for correct outcome labels and retry semantics.

## Clicks, custom events and scrolling

`trackClick(element, { name, isPublic })`, `recordEvent({ name, isPublic })` and `trackScroll(documentOrElement, { scopeId, isPublic })` are available. See [interaction definitions and tests](INTERACTIONS.md) for consent, registration limits, per-view deduplication and dynamic-height behavior. Migration 005 is required before collecting these new event types.
