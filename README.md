# Site Analytics

A self-hosted analytics service in development for multiple websites, with an Angular dashboard, Node.js API, PostgreSQL database, and a small standalone JavaScript tracker.

**Status:** Day 3 event storage implemented and locally verified. The API validates and stores bounded event batches in isolated PostgreSQL. Projects default to disabled. The browser tracker is still inert; reporting and owner login are not implemented. See the [collection contract](docs/COLLECTION.md).

See [local setup](docs/SETUP.md) for installation, startup, migration, and check commands.

Read the [project proposal](docs/PROPOSAL.md) for scope, architecture, delivery milestones, estimates, and acceptance criteria.

Use the [daily delivery plan](docs/DAILY_PLAN.md) to choose the next small task, check what counts as done, and record progress. The next implementation task is Day 4: consent-controlled browser collection.

**Start each work session with the [progress tracker](docs/PROGRESS.md).** It lists remaining work, completed results, verification evidence, and the next action. Update it whenever a task is completed, in the same commit or PR as the work.

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

TypeScript can be used where useful in development, including Angular's normal tooling. The browser tracker is distributed as JavaScript and must not require Angular, React, or Next.js on the host website. The foundation uses Fastify and TypeScript, with ordered PostgreSQL SQL migrations.

## Delivery target

Target a useful MVP in approximately **1–2 weeks**, and a dependable first release in approximately **3–5 weeks**, assuming one experienced developer working close to full-time with ChatGPT/Codex assistance. These are effort estimates, not guaranteed calendar dates. Scope and progress will be reviewed after the first working prototype.

The proposal is versioned project documentation. Keep it in the default `main` branch as implementation proceeds, updating its status and recording significant scope changes.

The [Day 1 working decisions and dashboard sketch](docs/DECISIONS.md) capture proposed visitor-experience reports and the MediaSpace integration transition. Outstanding owner choices are labelled provisional.
