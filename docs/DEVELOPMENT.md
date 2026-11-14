# Development workspace

Use Node.js 24.21.0 (see `.nvmrc`) and its bundled npm on Linux x64. This
workspace is separate from MediaSpace. Collection is implemented but defaults to disabled; the browser tracker requires explicit host consent; see [tracker setup](TRACKER.md).

```bash
npm ci
cp .env.example .env
npm run db:dev
```

Leave PostgreSQL running in that terminal. It binds to `127.0.0.1:55432` and
stores development data in the ignored `.local/postgres` directory. The example
password is only for this local database; never reuse it for a deployed service.
The embedded PostgreSQL distribution is a development dependency, not the
production database installation strategy.

In a second terminal, initialize the database and start the application:

```bash
npm run db:migrate
npm run dev
```

Open <http://127.0.0.1:4200>. The dashboard checks the API through its development
proxy. The API health endpoint is <http://127.0.0.1:3100/api/health>. Both servers
bind to loopback. The dashboard provides owner login and project management;
the authenticated reporting API is documented in [REPORTING.md](REPORTING.md), with report screens available after sign-in. The tracker has a separate opt-in static test page.
See [the collection guide](COLLECTION.md) to seed the two isolated development
projects and opt in to local event storage.
The tracker package builds to standalone JavaScript; use the [isolated test page](TRACKER.md) for verification.

Stop the application and database with Ctrl+C in their respective terminals.
Do not point `DATABASE_URL` at MediaSpace or production. Migration scripts use
that variable when supplied and otherwise use the isolated development URL.

## Verification

```bash
npm run check
npm run test:db
```

`check` runs lint, TypeScript/Angular compilation checks, focused tests, and all
workspace builds. `test:db` creates a temporary PostgreSQL database on loopback
port 55433, checks initial and repeat migration, checksum rejection, and real API collection/storage tests, then
stops the database and removes the temporary directory. These ports must be free.
The CI workflow runs both commands on Ubuntu.

Build output lives in ignored `dist` directories. Shared contracts are source
types consumed by the workspace; the tracker builds to standalone JavaScript.
No production configuration or tracking activation is part of this setup.

## Owner access

Day 6 adds optional owner login and project management. Follow [owner setup and recovery](OWNER_ACCESS.md) for ADMIN_ORIGIN, AUTH_SECRET, password provisioning, and the disposable browser check. Collection remains off unless explicitly enabled.
