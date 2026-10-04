# Project progress tracker

This is the working record for Site Analytics. Read it before starting work and update it whenever a task is completed. The [proposal](PROPOSAL.md) defines scope; the [daily plan](DAILY_PLAN.md) supplies detailed tasks and completion criteria.

## Current position

- **Phase:** Day 5 browser prototype implemented and locally verified.
- **Completed work packages:** 4 of 15 (Days 2–5); Day 1 product confirmation remains partial.
- **Current task:** Day 5 complete; Day 6 owner access and project controls is next.
- **Next action:** confirm owner login/recovery defaults, then implement authenticated access and project controls.
- **Open decisions:** production traffic target, retention, session definition, reporting time zone, consent behavior, and authentication. Technical foundation choices are implemented in development.
- **Delivery state:** proposal, daily plan, and tracker are on `main`; PR #1 merged September 29, 2026 at 17:33 UTC (merge commit `c91babd`). Day 1 design and Days 2–5 implementation are saved on `feat/development-workspace`; not merged or deployed.
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

The steps below summarize the detailed checklists in the daily plan.

| Complete | Day | Outcome | Steps | Completion evidence |
| --- | --- | --- | --- | --- |
| [ ] | 1 | Product decisions | Confirm owner/sites/reports; set measurement and privacy defaults; choose tooling; sketch dashboard | [Draft decisions and sketch](DECISIONS.md); owner choices pending |
| [x] | 2 | Runnable workspace | Scaffold Angular/API/tracker/contracts; initialize isolated PostgreSQL; add startup/checks/CI | [Day 2 verification](verification/day-2.md) |
| [x] | 3 | Valid event storage | Define schema/tables; validate bounded batches; enforce project status and deduplicate events | [Day 3 verification](verification/day-3.md) |
| [x] | 4 | Browser collection | Build standalone script; add consent/session/sanitization/batching; connect test website | [Day 4 verification](verification/day-4.md) |
| [x] | 5 | Verified prototype | Track SPA navigation; bound retries; test consent/exclusions/session behavior; confirm totals | [Day 5 verification](verification/day-5.md) |
| [ ] | 6 | Access and projects | Add owner login/logout; protect APIs; manage projects/origins/collection switches | Pending |
| [ ] | 7 | Reporting API | Add project/date-scoped aggregates; define metric boundaries; verify fixture totals | Pending |
| [ ] | 8 | Angular reports | Connect selectors/cards/chart/tables; handle loading/empty/error states; check accessibility | Pending |
| [ ] | 9 | Interaction analytics | Add selected clicks/custom events; measure document/container scrolling; display session timelines | Pending |
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
| BROWSER-1 | Verify cloned/opener-tab session isolation and cross-browser BFCache/exit behavior | Day 11 follow-up; independent tabs verified | Record supported browser behavior and any session-clone handling |
| PLAN-1 | Merge planning documentation into `main` | Verified merged; `c91babd` | Verify the daily plan, tracker, and README links exist on `main` after merge |
| DEC-1 | Confirm Day 1 product and technical decisions | Drafted in [DECISIONS.md](DECISIONS.md); owner review pending | Record agreed choices and clearly labelled provisional assumptions |

## Completion history

### October 4, 2026 — Day 5 browser prototype

- **Completed:** automatic SPA navigation, bounded same-ID retries/backoff, keepalive exit delivery, session/consent edge checks, and exact-count database verification.
- **Verified:** all 15 tests, lint, type checks, and builds passed. Chromium verified route sequences, lost-response deduplication, reload, separate tabs, expiry, withdrawal, and exit delivery against disposable PostgreSQL.
- **Evidence:** [Day 5 verification](verification/day-5.md), [tracker integration](TRACKER.md).
- **Remaining:** owner access/project controls next; cloned-tab and cross-browser matrix follow-ups documented; no push, merge, or production deployment.

### October 4, 2026 — Day 4 opt-in browser collection

- **Completed:** standalone tracker, consent start/stop, public path and campaign allowlists, sanitized referrer, anonymous sessions, bounded batching, and disposable static browser fixture.
- **Verified:** lint, type checks, unit tests, and workspace builds; Chromium → real API → PostgreSQL demonstrated denied visits, allowed visits, withdrawal, excluded paths, and failure isolation.
- **Evidence:** [Day 4 verification](verification/day-4.md), [tracker integration](TRACKER.md).
- **Remaining:** Day 5 navigation/retries/exit delivery and broader verification; no push, merge, or production deployment.

### October 4, 2026 — Day 3 checkpoint review

- **Completed:** reviewed and saved the pending Day 3 implementation, tests, and documentation in Git.
- **Verified:** `npm run check` passed; `npm run test:db:local` passed both integration tests with disposable PostgreSQL outside the sandbox. Credential-pattern review found no candidate secrets in the changed files.
- **Remaining:** Day 4 browser collection; no push, merge, production migration, or deployment performed.

### September 29, 2026 — Day 3 event storage

- **Completed:** versioned validation, bounded collection endpoint, origin checks, atomic parameterized insertion, project-scoped deduplication, and disabled development fixture seed command.
- **Verified:** `npm run check` and `npm run test:db:local` passed, including concurrent retries and cross-project event IDs against disposable PostgreSQL.
- **Evidence:** [Day 3 verification](verification/day-3.md), [contract](COLLECTION.md).
- **Remaining:** local uncommitted changes on `feat/development-workspace`; no merge or deployment. Browser collection and reporting remain unimplemented.

### September 29, 2026 — Day 2 runnable development foundation

- **Completed:** four npm workspaces, Angular placeholder with actual dependency
  status, Fastify health/readiness endpoints, shared contracts, an inert tracker
  build, isolated local PostgreSQL, transactional SQL migrations, and CI configuration.
- **Verified:** lint, strict TypeScript/Angular checks, API/tracker tests, all
  builds, and real PostgreSQL migration tests passed. Browser checks confirmed
  desktop/mobile rendering, live API/database connection, refresh interaction,
  and no initial browser errors. A real database stop/restart also verified the
  unavailable state, persistent data, and UI recovery. See the evidence record for limits.
- **Evidence:** [Day 2 verification](verification/day-2.md), [setup](SETUP.md),
  and implementation on `feat/development-workspace`.
- **Remaining:** CI has not yet run on GitHub; Day 3 ingestion and all later
  application milestones remain. No production collection or deployment.


### September 29, 2026 — Day 1 design draft and recovered handoff

- **Completed:** drafted report priorities, measurement defaults, tooling choices,
  a dashboard sketch, and the transition from MediaSpace's existing experience
  tracker. Listed unresolved owner decisions explicitly.
- **Verified:** GitHub reports PR #1 merged; the local `main` checkout contains
  its planning documents at `c91babd`. Documentation whitespace and local Markdown
  links checked. No application behavior was tested because no application exists.
- **Evidence:** [decision document](DECISIONS.md) on `docs/day-one-decisions`;
  [merged planning PR](https://github.com/Vilguinvyhypca/site-analytics/pull/1).
- **Remaining:** owner confirmation, Day 2 scaffolding, and all implementation.
  Earlier entries that say PR #1 is pending describe the historical state.


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

For future entries, copy this structure and replace every placeholder:

```markdown
### YYYY-MM-DD — Day N / short task name

- Completed:
- Verified: exact checks and their results; name anything not tested.
- Evidence: PR, commit, or repository artifact links.
- Remaining: limitations, blockers, or follow-up work.
```

## Next-session handoff

Day 5 is implemented and locally verified on `feat/development-workspace`.
See [Day 5 verification](verification/day-5.md) and [tracker integration](TRACKER.md).
All collection verification used a disposable project/database; production and
persistent development collection settings are unchanged.

Next: Day 6 owner login/logout, protected APIs, and project/origin controls.
The proposed single-owner local account with server-side sessions and local
recovery is still provisional in [DECISIONS.md](DECISIONS.md). Confirm the owner
approach before implementing authentication. Reporting remains unimplemented.
Remaining estimate: ten planned work packages plus unresolved Day 1 decisions;
see Day 5 verification for prototype limits and browser follow-ups.
