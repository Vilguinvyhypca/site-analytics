# Content, video and anonymous session reports

Sign in, choose a website/date range/time zone in **Traffic reports**, and select **Show report**. The content/video/session sections load beneath the traffic report, including when traffic has zero page views. They use real stored observations, with loading, empty, retry and expired-session states. Table containers can be focused and scrolled on narrow screens. All API routes require the owner session and return `Cache-Control: no-store`.

## Date attribution and denominators

Opens and sharing outcomes count individual stored events whose occurrence times are inside the selected dates. The existing reporting rules apply: inclusive local dates, exclusive midnight after the last date, New York by default or UTC, and a maximum 366-day range.

Playback metrics describe a **cohort of attempts first observed in the selected dates**. Each attempt contributes its latest lifetime summary across retained events, including updates occurring after the selected end date. It does not measure seconds watched exclusively during those dates. An attempt first observed before the range is excluded even if it progresses inside the range. Late arrivals can move an attempt's first-observed date or change its measured totals. These rules are displayed in the dashboard.

- Opens count explicit open events; thumbnails alone are not opens.
- Attempts count distinct project/playback summaries; starts count only those with a received start event. Missing-start progress remains observable without inventing a start.
- Engaged seconds sum each attempt's authoritative cumulative snapshot once. Concurrent attempts can accrue time separately; this is not exclusive human attention.
- Completion requires received start + observed end + at least 95% unique coverage. The displayed denominator is started attempts with known duration, excluding unknown-duration and start-only attempts.
- Coverage milestones count attempts whose latest known coverage meets 25%, 50% or 75%. Each attempt contributes at most once to each threshold; these counts may overlap. Missing-start attempts can have known coverage but are not counted as completed.
- Watch-time buckets count attempts with 0 observed seconds, more than 0 but under 10, 10 to under 60, and 60 or more. Zero can mean no progress was received; it does not prove no playback occurred.
- Shares are separate clicked/copied/handoff/cancelled/failed observations. Their sum is not a count of distinct shares, and none proves delivery to a recipient.

Playback details show content/playback IDs, observed elapsed seconds, known duration, unique coverage, completion/start status and last observed event time. Repeat playback may increase elapsed seconds without increasing coverage. Playhead position and repeat-attempt counts are not inferred from coverage or elapsed time; playhead position is not collected. Last event time does not establish an exit reason.

## API routes

All routes accept `projectId`, `startDate`, `endDate`, and optional `timeZone`, using the traffic endpoint's validation. Bad parameters return 400; unknown projects return 404; a known empty project returns real empty/zero data. A database error returns 503, never fabricated zeros.

| Route | Extra parameters | Response |
| --- | --- | --- |
| `/api/reports/engagement` | optional `after` playback UUID | Full-cohort totals, watch-time distribution, top 100 content rows by engaged seconds then content ID, total content-group count, up to 50 playback rows, `nextPlayback` |
| `/api/reports/sessions` | optional `after` session UUID | Up to 50 sessions with any event in the range, their in-range event counts and first/last times, `nextSession` |
| `/api/reports/timeline` | required `sessionId`; optional opaque `cursor` | Up to 50 in-range events for that project/session, `nextCursor` |

Playback and session pages order by ID and use exclusive keyset cursors. Timeline pages order by `(occurred_at, event_id)`; the opaque cursor preserves PostgreSQL timestamp microseconds so tied timestamps do not skip rows. A cursor does not grant access: every request still filters by the authenticated owner's selected project/date/session. Unknown session IDs return an empty list.

Each request uses a single database statement/snapshot. Pages are not a frozen export: late events that sort before a cursor require restarting from the first page. Reload the report to refresh totals. Content totals include rows beyond the top 100; the UI explicitly discloses truncation. Changing playback page does not change the whole-cohort totals. Pagination replaces the current page rather than accumulating unbounded browser state.

Session lists count **any** observed event, unlike traffic sessions which require a page view. The timeline displays selected event fields, including cumulative playback-progress values and sequence; values must not be added together. It is an anonymous event timeline, not a person profile or visual replay. The timeline's date filter can omit later progress shown in the lifetime playback summary; this distinction is explicit in the interface.

## Verification and remaining work

`tests/engagement.test.ts` runs in `npm run test:db`: exact two-project cohort/action fixtures, New York/UTC boundaries, missing starts, unknown duration, completion, late lifetime progress, empty projects, authentication, errors and multi-page playback/session/timeline results including timestamp ties with microseconds.

`npm run test:reports` builds and exercises the real dashboard/API/database. Engagement fixtures verify displayed lifetime totals and sharing, mobile layout, keyboard timeline pagination, error/retry and session expiry. Synthetic screenshots are saved under ignored `artifacts/day-nine-engagement-*.png`.

This completes the engagement reporting portion of Day 9C. Original click/custom-event and scroll tracking is now verified and included in [interaction counts](INTERACTIONS.md). Thumbnail-impression automation, physical mobile/assistive-technology checks, MediaSpace integration, load testing and production rollout are not claimed here. The underlying summary view computes at read time; production operating capacity remains unverified.

Keyboard verification uses `scripts/browser-keyboard.mjs` for native Chrome Enter activation because the installed agent-browser key command emitted keydown without the button activation click. Focused diagnostics confirmed the application click handler and API were working. The final browser regression verified all three pages of a 101-event timeline using native Enter followed by click.

The engagement response now includes `interactions`: full occurrence-date click/custom/scroll totals, group count and up to 100 groups with event/session counts. Timeline entries expose declared interaction names, scope IDs and milestones. They never expose scraped text or arbitrary custom properties.
