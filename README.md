# Site Analytics

A proposed self-hosted analytics service for multiple websites, with an Angular dashboard, Node.js API, PostgreSQL database, and a small standalone JavaScript tracker.

**Status:** proposal only. No application or tracking code has been implemented in this repository.

Read the [project proposal](docs/PROPOSAL.md) for scope, architecture, delivery milestones, estimates, and acceptance criteria.

Use the [daily delivery plan](docs/DAILY_PLAN.md) to choose the next small task, check what counts as done, and record progress. Start with Day 1; application implementation has not started.

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

TypeScript can be used where useful in development, including Angular's normal tooling. The browser tracker is distributed as JavaScript and must not require Angular, React, or Next.js on the host website. The Node.js framework and backend source language remain implementation decisions.

## Delivery target

Target a useful MVP in approximately **1–2 weeks**, and a dependable first release in approximately **3–5 weeks**, assuming one experienced developer working close to full-time with ChatGPT/Codex assistance. These are effort estimates, not guaranteed calendar dates. Scope and progress will be reviewed after the first working prototype.

The proposal is versioned project documentation. Keep it in the default `main` branch as implementation proceeds, updating its status and recording significant scope changes.
