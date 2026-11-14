# Site Analytics

A self-hosted analytics service in development for multiple websites, with an Angular dashboard, Node.js API, PostgreSQL database, and a small standalone JavaScript tracker.

**Status:** Days 1–10, Day 12 query-index review, and Day 13 data lifecycle are verified locally for the agreed native-video scope, including traffic/engagement reports, anonymous timelines, sharing, clicks, custom events, scrolling and the two-site development integration. Day 11's browser/device matrix remains partial; Day 14 staging/recovery and Day 15 release review remain open. Mux production integration remains deferred; production collection is disabled.

Read the [project proposal](docs/PROPOSAL.md) for scope, architecture, delivery milestones, estimates, and acceptance criteria.

Use the [development setup](docs/DEVELOPMENT.md) to run the workspace. Use the [daily delivery plan](docs/DAILY_PLAN.md) to choose the next small task, check what counts as done, and record progress.

**Start each work session with the [progress tracker](docs/PROGRESS.md).** It lists remaining work, completed results, verification evidence, and the next action. Update it whenever a task is completed, in the same commit or PR as the work.

The first dashboard priority is [content engagement](docs/CONTENT_ENGAGEMENT.md): per-content opens, video watch time and coverage, sharing actions, and anonymous session activity. These requirements also describe the updated MVP estimate.

## Intended outcome

Understand visits, selected clicks, media opens, and scrolling across independently built websites through one private dashboard. Start with the owner's websites and use MediaSpace as the first integration. Keep session replay outside the first release.

## Agreed technology choices

| Component | Technology |
| --- | --- |
| Dashboard | Angular |
| Collection and reporting API | Node.js |
| Data storage | PostgreSQL |
| Website integration | Standalone JavaScript browser tracker |
| Hosting | Separate deployment on an Ubuntu server |

The API uses Fastify and TypeScript. The browser tracker builds to standalone JavaScript and must not require Angular, React, or Next.js on the host website. Runtime versions and local setup are documented in the [development guide](docs/DEVELOPMENT.md).

## Development dashboard from Windows

The development servers run on Ubuntu and listen on loopback. To view the
dashboard from Windows, keep the Ubuntu development servers running and open
a Windows PowerShell terminal with this SSH tunnel, substituting your normal
SSH username and server address:

```powershell
ssh -o ExitOnForwardFailure=yes -L 14200:127.0.0.1:4200 YOUR_USER@YOUR_SERVER
```

Leave that SSH connection open and visit [http://127.0.0.1:14200](http://127.0.0.1:14200)
in the Windows browser. The dashboard proxy handles API requests; no separate
API tunnel is required. Ubuntu's local dashboard address is `http://127.0.0.1:4200`.

The dashboard provides workspace status, owner login/logout and project management.
Set `ADMIN_ORIGIN=http://127.0.0.1:14200` when using the Windows SSH tunnel, and follow
[owner access setup and recovery](docs/OWNER_ACCESS.md) to provision your password
and configure the private auth secret. The [traffic reporting API](docs/REPORTING.md) and dashboard report screens are available.

## Verification and next work

`npm run check` passes lint, type checks, focused tests and builds. `npm run test:db`
verifies collection, owner/project behavior and exact reporting totals against temporary PostgreSQL. The
Day 6 browser harness demonstrates two projects, a consented event from the actual
installation snippet, collection disablement, reload and logout. Mobile viewport
layout passes; physical mobile-browser testing remains later work. `npm run test:reports` verifies the dashboard against disposable PostgreSQL, including filters, errors, stale requests and session expiry.

Work is local on `feat/day-six-owner-admin`. Remote CI, merge and deployment remain
unverified. See the [progress tracker](docs/PROGRESS.md) for evidence and the Day 10
handoff. Tailscale dashboard access remains deferred.

## Delivery target

Target a useful MVP in approximately **1–2 weeks**, and a dependable first release in approximately **3–5 weeks**, assuming one experienced developer working close to full-time with ChatGPT/Codex assistance. These are effort estimates, not guaranteed calendar dates. Scope and progress will be reviewed after the first working prototype.

The proposal is versioned project documentation. Keep it in the default `main` branch as implementation proceeds, updating its status and recording significant scope changes.

Day 1 deliverables: [decisions and measurement defaults](docs/DAY_01_DECISIONS.md), [dashboard sketch](docs/DASHBOARD_SKETCH.md).

Native video integration and its automated browser check are documented in [NATIVE_VIDEO.md](docs/NATIVE_VIDEO.md). Use `npm run test:native-tracker` to verify playback through the collector and disposable database.

[Content action hooks and playback summary rules](docs/CONTENT_ACTIONS.md) describe sharing outcomes, cumulative updates and conflict handling.

[Engagement reporting](docs/ENGAGEMENT_REPORTS.md) explains the playback date rules, sharing labels and paginated anonymous timelines.

[Interaction tracking](docs/INTERACTIONS.md) documents explicit click/custom hooks, per-view scroll milestones and `npm run test:interactions`.
