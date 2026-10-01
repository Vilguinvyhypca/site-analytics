# Site Analytics

A self-hosted analytics service in development for multiple websites, with an Angular dashboard, Node.js API, PostgreSQL database, and a small standalone JavaScript tracker.

**Status:** Days 1–2 complete locally. The dashboard, API, contracts, and inert tracker scaffold are verified; visitor collection is not implemented. Day 3 event storage is next.

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

The current dashboard shows workspace status and placeholders for content
performance, video engagement, and session activity. Reports, owner login,
and visitor collection are not implemented yet.

## Verification and next work

Day 2 verification passed: `npm run check` (lint, type checks, three focused
tests, and all workspace builds), `npm run test:db` (isolated PostgreSQL
initialization, repeat migration, and checksum rejection), and browser checks.
The owner also confirmed the connected status, connection button, Firefox
mobile-emulation layout, and unchanged dashboard after refresh through the SSH
tunnel. Physical mobile-browser testing remains pending.

The work is committed locally on `feat/day-two-workspace`: workspace commit
`fc43e00` and owner verification record `61ae101`. Merge, remote CI, and deployment
have not been verified. Production collection remains disabled.

Next: Day 3 project/event tables, bounded event validation and collection, and
duplicate prevention. Tailscale dashboard access is deferred to a later session.
See the [progress tracker](docs/PROGRESS.md) for the full handoff.

## Delivery target

Target a useful MVP in approximately **1–2 weeks**, and a dependable first release in approximately **3–5 weeks**, assuming one experienced developer working close to full-time with ChatGPT/Codex assistance. These are effort estimates, not guaranteed calendar dates. Scope and progress will be reviewed after the first working prototype.

The proposal is versioned project documentation. Keep it in the default `main` branch as implementation proceeds, updating its status and recording significant scope changes.

Day 1 deliverables: [decisions and measurement defaults](docs/DAY_01_DECISIONS.md), [dashboard sketch](docs/DASHBOARD_SKETCH.md).
