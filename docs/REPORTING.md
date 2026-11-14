# Traffic reporting API

`GET /api/reports/overview?projectId=static-dev&startDate=2026-03-08&endDate=2026-03-10`

Requires the owner session cookie. Responses are private (`Cache-Control: no-store`). Public project IDs grant no reporting access. The Angular reporting interface is Day 8.

## Range and metric definitions

- `projectId`, `startDate` and `endDate` are required. Dates use real `YYYY-MM-DD` calendar dates, from 2000 through 9998, inclusive; maximum range 366 days. Reversed ranges, repeated parameters and unknown parameters return 400.
- Optional `timeZone` defaults to `America/New_York`; recognized IANA zone names are canonicalized. UTC is supported. Day boundaries are midnight in that zone: inclusive start, exclusive midnight after the end date. PostgreSQL performs calendar arithmetic before UTC conversion, including 23/25-hour DST days.
- Page views count stored `page_view` rows by `occurred_at`. Collector deduplication already limits an event ID to one row per project. Other event types do not contribute to traffic metrics.
- Sessions count distinct anonymous session IDs with at least one page view in the range. This is neither people nor sessions first started in the range. A session spanning multiple days counts once overall and once on each active day; daily session totals must not be summed to get the range total.
- Popular pages group by stored sanitized path. Referrers group by the hostname on each page-view event, not first-touch session attribution. Missing/empty hosts return `host: null, label: "Unknown"`; they are not inferred to be direct traffic. Per-group sessions can overlap and must not be added together.
- Collection-disabled projects retain reportable history. Unknown projects return 404. Known projects with no matching data return genuine zero totals, empty group lists and zero-filled calendar days.

## Response and freshness

The shared `TrafficReport` contract includes the selected range/zone, `startAt`, `endAtExclusive`, `totals`, zero-filled `daily`, `pages`, and `referrers`. Each count object contains `pageViews` and `sessions`.

Groups are ordered by descending views, then bytewise path/hostname (unknown hosts last on ties). Each list has at most `groupLimit: 100` rows. `pageGroups` and `referrerGroups` give the full number of groups, so a client can disclose truncation; totals and daily data always cover the whole range. Pagination is not provided yet.

All metrics use one SQL statement and one database snapshot. `generatedAt` is query start time; `latestReceivedAt` is the newest receipt time among matching page views, or null for an empty result. This is not proof all visitors have delivered their events. A subsequent query includes newly committed, late-arriving events in their occurrence-date bucket. No application reporting cache is used. Database failures return 503, never fabricated zero counts.

Counts describe observed, consented events, not audit-grade totals. Event loss, blocked collection, clock skew and the collector's timestamp acceptance window still apply. Retention enforcement and production capacity testing are later work packages; the 366-day request bound does not promise 366 days of retained data.

## Automated evidence

`npm run test:db` runs the collector, owner and report suites sequentially against a disposable PostgreSQL database. `tests/reports.test.ts` checks exact two-project fixtures, shared session IDs across projects, midnight and DST boundaries, UTC selection, zero days/projects, non-page events, late arrivals, disabled-project history, bounded/deterministic lists, authentication/revocation, invalid input and database failures. Historical rows are inserted directly because fixed-date fixtures intentionally fall outside the collector's 24-hour acceptance window.

`npm run check` runs lint, type checks, non-database tests and builds. Database tests are skipped there and must also run with `npm run test:db`.

## Dashboard

After signing in, use **Traffic reports** to choose a website, inclusive start/end dates and New York or UTC boundaries, then select **Show report**. The initial dates cover the last seven calendar days in New York. The dashboard shows page-view/session cards, a daily trend with an expandable exact-data table, and popular-page/referrer tables. Reports over 100 groups explicitly disclose the displayed subset.

Changing a filter clears previous results; cancelled or out-of-order responses cannot overwrite the current selection. Loading, no recorded views, unavailable reports and invalid ranges have separate states. Retry uses the current filters. Session expiry clears private reports and returns to sign-in. Requests time out after 15 seconds.

Run `npm run test:reports` for the automated dashboard check. It builds the app, starts a disposable database on loopback port 55436 and dashboard/API on 4312, then cleans them up. The browser uses synthetic credentials and fixed historical fixtures. Successful reports use the real API and database; only transport failures/delays are injected to exercise recovery and request races. Screenshots are saved under ignored `artifacts/day-eight-reports-*.png`.

Content/video engagement and anonymous session sections now use these same filters. See [engagement reporting](ENGAGEMENT_REPORTS.md) for lifetime playback attribution, denominators and cursor pagination.
