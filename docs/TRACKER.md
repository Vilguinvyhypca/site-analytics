# Day 4 browser tracker

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

Sessions are random UUIDs scoped by project and tab, saved only after consent
and an eligible event, with a memory fallback if session storage is unavailable.
Thirty minutes without a recorded eligible interaction resets the session.
Consent itself is owned by the host and is not persisted by this package.

The queue holds at most 100 events and drops newest overflow. Flush runs every
two seconds with at most 50 events / 64 KiB UTF-8 per request; only one request is
active at a time. Requests time out after five seconds. Failed batches are discarded
in this milestone. Automatic navigation tracking, retry/backoff, page-exit delivery,
and player measurement remain later work.

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
withdrawal, and a caught failed request. Screenshot: ignored local
`artifacts/day-four-consent.png`. Socket/browser execution may require sandbox approval.
