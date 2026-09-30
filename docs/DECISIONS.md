# Day 1: smallest useful product

Date: September 29, 2026

Status: working decisions for review. The stack is agreed in the proposal;
product priorities and numerical defaults below are provisional, not owner approvals.
No production collection is enabled by this document.

## Product boundary

Build a private tool for one owner, initially measuring MediaSpace development
and a small independent static test website. Keep Angular, Node.js, PostgreSQL,
and a framework-independent JavaScript tracker as specified in the proposal.

Proposed first reports:

1. **Arrival sources:** landing pages, source/medium/campaign, and sessions by day.
   Attribute the source once to a session; later internal page views must not
   reclassify the visit as direct traffic.
2. **Media engagement:** opens, playback starts, completions, shares, searches
   with no results, and document/feed scroll milestones.
3. **Where visits stop:** simple ordered sequences and playback/browser errors,
   with an inspectable session timeline. Missing events indicate observed
   inactivity, not why someone left.

Keep traffic totals and popular pages as context. Advanced funnel builders,
replay, heatmaps, and cross-device identity remain outside the release.

## Measurement defaults to validate

| Decision | Provisional default | Validation or owner |
| --- | --- | --- |
| Capacity | 100,000 events/day across two sites; burst test at 100 events/second for 60 seconds | Developer measures in Day 12; owner confirms anticipated traffic |
| Retention | 90 days of raw events | Owner confirms; scheduled deletion tested on Day 13 |
| Session | Per-tab random ID; rotate after 30 minutes without tracked activity; no cross-site identity | Developer documents storage/reload/multi-tab behavior and tests on Day 5 |
| Reporting | Store timestamps in UTC; default reports to America/New_York | Owner confirms; test daylight-saving boundaries |
| Attribution | First event captures sanitized landing attribution; keep source, medium, and campaign separate | Developer verifies later page views preserve attribution |
| Collection | Off until explicitly started by the host site's consent integration; stop clears unsent events | Owner confirms production consent behavior before activation |
| Exclusions | Admin sessions, admin/API routes, private and unlisted media | MediaSpace adapter supplies visibility and waits for auth resolution |
| Sensitive data | No raw search text, form data, full referrer URLs, access tokens, or persisted raw IP analytics fields | Inspect real payloads in Day 11 |

For basic media sequences, match events by site, session, and media ID, in
timestamp order. A play of one video must not hide an unplayed open of another.
Specify observation windows and incomplete-session treatment before publishing
drop-off percentages. Counts of sessions are not counts of people.

## Implementation choices

Implemented for the authorized Day 2 development foundation: TypeScript across the workspace; npm workspaces;
Fastify for the Node.js API; PostgreSQL accessed through parameterized SQL;
ordered SQL migrations with a migration ledger; an Angular dashboard; and a
bundled standalone tracker with no host-framework runtime dependency.

Resolve supported dependency versions against current official documentation
when scaffolding. Do not copy MediaSpace environment files or credentials.

Proposed owner authentication: one locally provisioned account, no public signup,
server-side sessions in PostgreSQL, secure HTTP-only session cookies, and a
server-local recovery command. Confirm this approach before Day 6. Select and
verify maintained password/session libraries during implementation; do not
implement cryptographic primitives. Reporting stays local until authentication
and authorization are verified.

## MediaSpace transition

The existing development checkout includes visitor-experience instrumentation,
an `/api/experience` collector, daily JSONL storage, and an admin report. Treat
these as a requirements reference, not evidence of a production deployment.

Keep website-specific event hooks in MediaSpace; move collection storage and
reporting into Site Analytics. Preserve playback errors, initial load timing,
active page duration, campaign attribution, search/filter actions, and sharing
as explicit event requirements. Generic custom events alone do not guarantee
these reports exist.

Use one configurable adapter so a browser action goes to one active collector.
During the development pilot disable the existing experience collector when
enabling Site Analytics; keep Fullstory disabled. Verify rollback to the prior
configuration. Decide whether historical JSONL data needs importing separately;
do not delete it or assume compatible session definitions.

## Dashboard sketch

```text
Site Analytics                         [Site v] [Date range v] [Time zone]

Sessions       Page views       Media opens       Playback errors

Arrival sources                         Daily activity
Source / medium / campaign               [sessions and views trend]
Landing page / sessions

Media engagement                        Where visits stop
Open / start / complete / share          Open -> start -> complete
Searches with zero results               Counts and defined denominators
Document and feed scroll milestones      Browser and playback errors

Session timeline
[Session] [Time] [Sanitized page] [Action] [Allowed details]
```

Include empty, loading, disabled-collection, and reporting-failure states. Keep
the tracked-link builder with the arrival report. Never display sample values
as live visitor data.

## Outstanding owner decisions

- Confirm the three reports and private single-owner scope.
- Confirm or revise traffic, retention, time zone, and session defaults.
- Confirm production consent behavior and owner login/recovery approach.
- Choose a deployment domain before staging; local scaffolding does not depend on it.

The developer owns technical validation. These assumptions allow a reviewable
design and isolated scaffolding; they do not settle production configuration.

Day 2 validation: Angular 22.2 / TypeScript 6.0 / Fastify 5; local PostgreSQL 18 through a pinned development-only embedded-postgres package. See [setup](SETUP.md). The user authorized continuation of implementation; production product defaults remain provisional.
