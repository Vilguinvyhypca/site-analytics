# Day 1 — engagement analytics decisions

Status: design baseline completed; implementation has not started. Defaults below are reversible engineering choices, not claims about measured traffic or user-approved numerical requirements.

## Confirmed direction

- Build a reusable analytics service with Angular, Node.js, PostgreSQL, and a standalone browser tracker.
- Prioritize content opens, per-video watch time, sharing actions, and anonymous session activity.
- Keep the dashboard private. Visitors need no accounts; do not collect names or introduce fingerprinting.
- Initial journey: social profile link → content profile → media open → playback → another item or sharing action.
- Short visits and difficulty discovering playable media are hypotheses to test, not established findings.
- Scope is SEO, UX, and engagement analytics. Subscription/notification implementation belongs to the MediaSpace developer and is outside this project.

## Initial defaults

| Decision | Starting value | Reason / review point |
| --- | --- | --- |
| Ownership | One operator managing multiple websites | No public customer signup in this release |
| Pilot websites | MediaSpace development instance plus a static test website | Verify both player integration and framework independence |
| Visitor identity | Random project-scoped session ID; no persistent returning-person identifier | Sufficient to study a short content journey; cannot count unique people |
| Session boundary | Per tab, reset after 30 minutes without qualifying interaction; storage only after consent, memory fallback | Multiple tabs may count separately; explain this in reports |
| Retention | 30 days for raw events and playback summaries | Provisional cost limit; no retained aggregates initially that silently outlive deletion |
| Time | Store timestamps in UTC; default reports to America/New_York | Display chosen report zone and apply it consistently at day boundaries |
| Consent | Off until the host explicitly permits collection; stop and clear unsent events/identifier when revoked | Host owns the consent UI; no third-party service required |
| URL handling | Path plus allowlisted profile/content IDs; strip query/fragment; referrer hostname only | Avoid signed media URLs and personal URL data |
| Capacity test | 100,000 events/day and a 50 events/second burst for 60 seconds | A provisional synthetic test, not a production capacity claim; revise after measurement |
| Request limits | At most 50 events and 64 KiB per batch; bounded tracker queue | Bound memory, database work, and retry cost; test actual encoded payload sizes |
| Watch heartbeat | Every 5 seconds during eligible playback, plus best-effort final summary | Final interval can be lost; label observed time honestly |
| Player eligibility | Document visible and at least 50% of player area in viewport | Engagement proxy, not proof of attention; test overlays and mobile feed |

## Reporting definitions

The three initial views are **content performance**, **video engagement**, and **anonymous session activity**. See the [dashboard sketch](DASHBOARD_SKETCH.md).

- Track a profile visit on initial arrival and relevant client navigation. Referrer hostname can be absent; never assume an unknown source is social or direct.
- Count an eligible thumbnail impression after at least 50% visibility for one continuous second, once per content item per page view. This supplies the denominator for discovering whether visitors notice/open media. Clicks can still occur before that threshold.
- Report content opens separately from playback starts. Autoplay is labelled separately where known; do not infer intent from playback alone.
- Engaged playback seconds accumulate only while playing, not buffering/seeking/paused, and meeting visibility rules. Pause the clock during gaps and reconcile against player state; do not blindly add five seconds per heartbeat.
- Timeline coverage is the union of intervals actually played during eligible playback. Seeking does not add skipped time; replaying increases elapsed time but not unique coverage. Playback speed affects covered duration, not the elapsed clock.
- Milestones are 25%, 50%, and 75% coverage once per playback. Completion requires at least 95% coverage plus an observed end event. Label it “completed (95%+ and ended),” not “100% watched.” Unknown/nonfinite durations have elapsed time but no coverage percentage or completion rate.
- Average watch time = total observed engaged seconds / playback instances that started. Completion rate uses only started instances with known duration. Counts of sessions, opens, and plays stay separate.
- The profile journey report counts distinct eligible sessions at each step, with ordered events for conversion calculations. Rates use only sessions whose required earlier step was observed; include counts and explain missing observations.
- Sharing outcomes are button click, link copied, native handoff reported, cancelled, or failed. Never label these as verified posting, recipient delivery, or recipient viewing.
- Cumulative progress snapshots are keyed by project/playback ID with a sequence number. Accept newer valid snapshots; retries or older versions must not add totals again. Preserve the timing needed for daily reporting rather than assigning all watch time to an arbitrary last-update date.

## Technical choices for the first scaffold

- **Node.js API:** Fastify, with route JSON Schemas for runtime validation. Use TypeScript for API/contracts to share checked event definitions with Angular; runtime validation remains mandatory. This is a maintainability choice, not a performance claim. [Fastify schema documentation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- **Database access:** `pg` with parameterized SQL, explicit migrations, and SQL aggregation. Keep reporting queries readable and independently testable. [node-postgres query documentation](https://node-postgres.com/features/queries)
- **Migrations:** ordered SQL files with a migration ledger, checksums, and a transaction/lock-aware runner. Test initialization and upgrade paths against disposable databases.
- **Tracker:** standalone TypeScript source compiled into a small JavaScript artifact; no Angular/React runtime dependency. Explicit native-video/Mux adapters feed the same contract.
- **Owner authentication:** server-managed opaque sessions in PostgreSQL and an HttpOnly cookie; one operator account provisioned outside public routes. Use a maintained password-hashing implementation, login rate limits, CSRF protection for mutations, and a documented operator recovery command. Select and verify packages in Day 2; no handwritten cryptography or public signup.
- **Local setup:** npm workspaces and isolated development PostgreSQL. Choose compatible maintained package/runtime versions and lock them during Day 2 after checking current official documentation.
- **Dashboard:** Angular with semantic tables first and one chart once the reporting API exists. Choose a chart library in Day 8; no dependency is needed for this sketch.

## UX guidance experiment

Measure the baseline before shipping a popup. First candidate: a visible play affordance plus “Tap a photo or video to open it.” If tested, record guide exposure, dismissal where applicable, and subsequent media open/play. Keep visitors able to browse without interacting with the guide. Compare equivalent cohorts or clearly label before/after observations; a correlation alone does not prove the guide caused a change.

Implementation of prompts in MediaSpace is a separate integration change. Analytics should expose the measurement hooks without inserting arbitrary UI into every tracked website.

## Outstanding items and owners

| Item | Owner | Needed by | Blocks Day 2? |
| --- | --- | --- | --- |
| Confirm/adjust retention and traffic assumptions | Project owner, with measured developer evidence | Before production pilot | No |
| Production analytics domain and available server capacity | Project owner / operations | Staging setup | No |
| Review consent wording and applicable deployment requirements | Project owner | Production activation | No |
| Validate native/Mux player event behavior and completion tolerance | Implementation work | Day 5 prototype review | No |
| Select compatible package versions and auth libraries | Implementation work | Day 2 scaffold | Part of Day 2 |

## Day 1 completion check

Product scope, pilot sites, initial defaults, measurement definitions, technical direction, dashboard sketch, and owners for outstanding decisions are recorded. This completes the design package only. No code, live measurement, or production activation is claimed.
