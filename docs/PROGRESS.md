# Project progress tracker

This is the working record for Site Analytics. Read it before starting work and update it whenever a task is completed. The [proposal](PROPOSAL.md) defines scope; the [daily plan](DAILY_PLAN.md) supplies detailed tasks and completion criteria.

## Current position

- **Phase:** Days 1–2 complete locally; runnable development workspace verified.
- **Completed work packages:** Days 1–2 of 15; one implementation package completed.
- **Current task:** Day 2 verified on `feat/day-two-workspace`; not merged or deployed.
- **Next action:** Day 3 — versioned event schema, project/event tables, bounded batch collection, and deduplication.
- **Confirmed reporting priority:** content performance, video engagement/watch time, and anonymous session activity; sharing actions included. See [content engagement requirements](CONTENT_ENGAGEMENT.md). Dashboard stays private initially.
- **Provisional defaults:** traffic/retention/session/measurement values are recorded in the decisions document. Production domain, capacity, and activation requirements remain open with owners and deadlines.
- **Delivery state:** PR #1 is merged. Day 1 follow-up documents and Day 2 implementation are present on `feat/day-two-workspace`; their merge and remote CI results have not been verified in this session.
- **Production:** no analytics service deployed and no tracking enabled by this project.

## Update steps for every completed task

1. Check the relevant completion criterion in the daily plan and run the checks needed to verify it.
2. Mark only the work actually finished. A partially completed day stays unchecked in the overview below; individual daily-plan checkboxes can be checked as their tasks finish.
3. Add a dated entry to the completion history describing the change, verification result, and evidence link. Include the affected task/day and any remaining limitations.
4. Update the current position, delivery state, and next-session handoff. Record blockers or decisions explicitly.
5. Include this documentation update in the same commit or PR as the work. Use a PR link or an earlier commit ID for evidence; a commit cannot contain its own final hash.
6. After merge or deployment, record that separate outcome. Implemented, verified, merged, and deployed are different states. Keep this file in `main`; never discard it when a milestone ends.

Corrections should preserve the history: add a correction or reopening entry when a previously completed task needs more work. Never record credentials or actual visitor data here.

## Remaining work overview

Days 1–2 are complete locally; subsequent implementation rows remain pending. The steps below summarize the detailed checklists in the daily plan.

| Complete | Day | Outcome | Steps | Completion evidence |
| --- | --- | --- | --- | --- |
| [x] | 1 | Product decisions | Scope and defaults recorded; tooling selected; outstanding decisions assigned; dashboard sketched | [Decisions](DAY_01_DECISIONS.md), [sketch](DASHBOARD_SKETCH.md) |
| [x] | 2 | Runnable workspace | Scaffold Angular/API/tracker/contracts; initialize isolated PostgreSQL; add startup/checks/CI | [Setup](DEVELOPMENT.md), [API tests](../tests/health.test.ts), [database verification](../scripts/test-database.mjs) |
| [ ] | 3 | Valid event storage | Define schema/tables; validate bounded batches; enforce project status and deduplicate events | Pending |
| [ ] | 4 | Browser collection | Build standalone script; add consent/session/sanitization/batching; connect test website | Pending |
| [ ] | 5 | Verified prototype | Track SPA navigation; bound retries; test consent/exclusions/session behavior; confirm totals | Pending |
| [ ] | 6 | Access and projects | Add owner login/logout; protect APIs; manage projects/origins/collection switches | Pending |
| [ ] | 7 | Reporting API | Add project/date-scoped aggregates; define metric boundaries; verify fixture totals | Pending |
| [ ] | 8 | Angular reports | Connect selectors/cards/chart/tables; handle loading/empty/error states; check accessibility | Pending |
| [ ] | 9A–9C | Content engagement | Add player watch time/coverage, sharing outcomes, aggregation and content/session reports; retain click/scroll tracking | Pending |
| [ ] | 10 | Two-site MVP | Integrate MediaSpace in development; verify overlays/feed/privacy; prove independent second-site integration | Pending |
| [ ] | 11 | Privacy/browser verification | Exercise consent/storage/multi-tab cases; inspect payloads; test agreed browsers | Pending |
| [ ] | 12 | Capacity and abuse controls | Harden limits; load-test agreed target; measure tracker/API/database costs; tune proven bottlenecks | Pending |
| [ ] | 13 | Data lifecycle | Add retention and project deletion; verify isolation; demonstrate backup restoration | Pending |
| [ ] | 14 | Deployment rehearsal | Package staging; configure HTTPS/processes/health/logs; rehearse rollback and owner recovery | Pending |
| [ ] | 15 | Release candidate | Verify proposal acceptance criteria; resolve blockers; prepare concrete production rollout plan | Pending |

Days 16–25 are contingency/stabilization capacity, not automatically required tasks. Add specific follow-up items below only when actual findings justify them. Session replay, heatmaps, billing, and public signup remain outside this release.

## Follow-up work and blockers

| ID | Task or decision | Status | Completion condition |
| --- | --- | --- | --- |
| PLAN-1 | Merge planning documentation into `main` | Complete: PR #1 merged and files verified | Follow-up content requirements and Day 1 changes still need their own merge |
| DEC-1 | Record Day 1 decisions | Complete design baseline | [Defaults and outstanding decisions](DAY_01_DECISIONS.md) are explicit; production values remain reviewable |

## Completion history

### September 29, 2026 — Proposal and repository

- **Completed:** created the private `site-analytics` repository; documented agreed stack, scope, architecture, estimates, and release criteria.
- **Verified:** repository creation and push to `main` succeeded.
- **Evidence:** [proposal commit](https://github.com/Vilguinvyhypca/site-analytics/commit/9b333cf).
- **Remaining:** implementation has not started; production is unchanged.

### September 29, 2026 — Daily work breakdown

- **Completed:** created 15 ordered daily work packages with completion checks and contingency guidance; linked the plan from the README and proposal.
- **Verified:** documentation whitespace check passed and relative links resolved.
- **Evidence:** [daily-plan commit](https://github.com/Vilguinvyhypca/site-analytics/commit/9ee6517), [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** merge the documentation; begin Day 1 decisions.

### September 29, 2026 — Persistent progress record

- **Completed:** added this tracker with remaining steps, completion history, evidence requirements, delivery state, and a next-session handoff; made it the shared progress record linked from the README and daily plan.
- **Verified:** documentation whitespace and relative-link checks passed before commit.
- **Evidence:** this document in [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** all implementation work; confirm the documents reach `main` after merge.

### September 29, 2026 — Content engagement scope clarified

- **Completed:** recorded the owner's priority for content opens, per-video watch time, sharing actions, and session-level activity; deferred public-facing features. Defined proposed measurement rules, player integration steps, and acceptance scenarios.
- **Verified:** documentation whitespace and relative-link checks passed before commit; no tracker or player code has been implemented.
- **Evidence:** [content engagement requirements](CONTENT_ENGAGEMENT.md) in [PR #1](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** confirm detailed measurement/identity rules; prototype both players; revisit the MVP estimate with a provisional 2–4 day scope allowance. Day 1 remains incomplete.

### September 29, 2026 — Day 1 design completed

- **Completed:** recorded anonymous content engagement, social-profile arrival hypotheses, video measurement defaults, technical choices, and a dashboard sketch. Kept subscription implementation outside scope.
- **Verified:** checked all three Day 1 deliverables against the daily plan; documentation whitespace and relative links passed. PR #1 is merged and the planning files exist on `main`.
- **Evidence:** [decisions](DAY_01_DECISIONS.md), [sketch](DASHBOARD_SKETCH.md), branch `docs/day-one-engagement-design`.
- **Correction:** the earlier content-engagement entry referred to PR #1, but that update was pushed after its merge. Its commit has now been carried into the new branch so it is not lost.
- **Remaining:** Day 2 implementation; production defaults are provisional. No application code has been implemented.

### September 30, 2026 — Day 2 workspace recovered and verified

- **Completed:** resumed the unfinished workspace on disk; verified Angular dashboard, Fastify health endpoint, contracts, inert standalone tracker, isolated PostgreSQL, checksum-protected migrations, and CI configuration. Added reproducible development instructions and corrected stale status documents.
- **Verified:** `npm run check` passed lint, TypeScript/Angular checks, all three focused tests, and API/dashboard/tracker builds. `npm run test:db` passed initialization, repeat migration, and checksum rejection against temporary PostgreSQL. Agent-browser verified dashboard rendering, API-connected status, and the connection button; no browser errors were reported. Screenshot: ignored local `artifacts/day-two-dashboard.png`.
- **Evidence:** [development setup](DEVELOPMENT.md), [health tests](../tests/health.test.ts), [database test](../scripts/test-database.mjs), [CI workflow](../.github/workflows/check.yml), branch `feat/day-two-workspace`.
- **Remaining:** Day 3 event collection/storage; no reporting or owner login exists yet. Remote CI, merge, and deployment are not verified. Collection remains disabled. Tests requiring local sockets ran outside the filesystem sandbox; the browser required a container-compatible `--no-sandbox` launch flag.

### September 30, 2026 — Owner development dashboard checks

- **Completed:** owner tested the Day 2 dashboard from Windows through the SSH tunnel at `http://127.0.0.1:14200`.
- **Verified:** owner confirmed API-connected/collection-disabled status and the connection button; reported that the layout works in Firefox developer-tools mobile emulation and remains unchanged after refreshing. Refresh is expected to preserve the same dashboard/status; no visible transition is required.
- **Evidence:** owner-reported manual checks of workspace commit `fc43e00` in this session.
- **Remaining:** mobile emulation does not verify a physical mobile browser. Tailscale access is deferred at the owner's request; adding an endpoint was denied and the subsequent administrator command was canceled. Day 3 event storage remains the next implementation task.

For future entries, copy this structure and replace every placeholder:

```markdown
### YYYY-MM-DD — Day N / short task name

- Completed:
- Verified: exact checks and their results; name anything not tested.
- Evidence: PR, commit, or repository artifact links.
- Remaining: limitations, blockers, or follow-up work.
```

## Next-session handoff

**Start here:** Day 3 in the [daily plan](DAILY_PLAN.md), using the [Day 1 decisions](DAY_01_DECISIONS.md) and [development setup](DEVELOPMENT.md).

**First action:** review shared event contracts and measurement rules, then add project/event migrations and validation tests for bounded collection. Preserve consent, origin, project isolation, and deduplication requirements.

**Expected output:** valid bounded requests create expected rows; malformed requests fail; duplicate event IDs do not duplicate records within a project. Production and MediaSpace integration remain later work.

**Runtime note:** this session restored the pinned Node.js under `/home/seodev/.local/share/site-analytics-node`. If Node is absent from PATH, run `export PATH=/home/seodev/.local/share/site-analytics-node/bin:$PATH` before the documented commands.
