# Local development

This workspace is an isolated development foundation. It has an Angular
placeholder, a Fastify status API, a PostgreSQL project schema, shared contracts,
and an inert browser tracker. Event ingestion, visitor reports, and owner login
are not implemented. Do not expose these development servers publicly.

## Requirements

- Node.js matching `.nvmrc` (22.23.2) and npm 10 or later.
- A non-root user on a supported embedded-postgres platform, including Ubuntu x64.
- Network access for the first npm installation. No Docker or system PostgreSQL
  installation is needed for the supplied local workflow.

Dependency versions are locked in `package-lock.json`. Angular 22.2 requires
TypeScript 6.0; compatibility was checked against the
[Angular version reference](https://angular.dev/reference/versions) and package
peer requirements. The development-only database uses
[embedded-postgres](https://github.com/leinelissen/embedded-postgres), which
downloads platform binaries through npm and requires its install scripts.

## First run

From the repository root:

```bash
npm ci
cp .env.example .env
npm run build -w @site-analytics/contracts
npm run db:dev
```

Leave that terminal open. In a second terminal at the repository root:

```bash
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:4201>. The connection panel should say **API and database
connected**. The API is at <http://127.0.0.1:4100/health>; `/ready` returns 503
until PostgreSQL is reachable and the migration ledger exists. The dashboard
proxies `/api/*` to the local API. If changing `API_PORT`, also update the local
dashboard proxy target.

For a remote Ubuntu server, forward the dashboard port from your computer:

```bash
ssh -L 4201:127.0.0.1:4201 YOUR_UBUNTU_USER@YOUR_UBUNTU_HOST
```

Then open localhost:4201 on your computer. The development API and database
remain bound to loopback. No production proxy or MediaSpace configuration is needed.

Use Ctrl+C to stop the app and database processes. PostgreSQL data stays inside
the ignored `.local/postgres` directory and is reused on restart. The local
database uses port 55432, database `site_analytics_dev`, and the development-only
credentials in `.env.example`; do not reuse these for deployment. `db:dev`
refuses other database targets. It does not install a system service or create
operating-system users.

## Checks

```bash
npm run check
```

This runs linting, strict TypeScript/Angular template checks, focused API and
tracker tests, and builds all four workspaces. The standalone tracker bundle is
`packages/tracker/dist/tracker.js`; loading it does not collect anything.

For a self-contained real PostgreSQL test, run `npm run test:db:local`. It starts
a temporary cluster on loopback port 55433, runs the integration suite, and
removes only that temporary cluster afterward.

Alternatively, database integration tests require a separate empty database with a name ending
in `_test`. They never clear an existing schema. Set `TEST_DATABASE_URL` to that
database and run:

```bash
npm run test:db
```

CI provisions a disposable PostgreSQL 18 service and executes the same checks.
Integration tests verify repeatable migrations, default-disabled projects,
changed-migration detection, and rollback of failing DDL and ledger writes.

## Migration rules

Add ordered files such as `002_events.sql` to `migrations/`. Do not edit an
already applied migration: checksums detect that. All pending files and their
ledger entries run in one transaction on one connection, with an advisory lock
to serialize concurrent runs. There is no automatic destructive down-migration.
The initial migration creates project configuration only; event schema and
ingestion validation belong to Day 3.

## Workspace map

| Directory | Responsibility |
| --- | --- |
| `apps/dashboard` | Angular dashboard and development API proxy |
| `apps/api` | Fastify liveness/readiness API, loopback binding |
| `packages/contracts` | Shared status types; event contracts follow in Day 3 |
| `packages/tracker` | Standalone JavaScript bundle, currently inert |
| `migrations` | Ordered PostgreSQL schema changes |
| `scripts` | Local database lifecycle and migration runner |
| `tests` | API/tracker behavior and real-database migration tests |

Build artifacts, local database files, `.env`, and screenshots are ignored.
Never copy MediaSpace credentials or production data into this repository.
