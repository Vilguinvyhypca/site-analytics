# Development workspace

Use Node.js 24.21.0 (see `.nvmrc`) and its bundled npm on Linux x64. This
workspace is separate from MediaSpace. It does not collect visitor events yet.

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
bind to loopback. The initial dashboard shows workspace status and planned reports;
authentication, reports, event collection, and consent handling are later tasks.
The tracker package is an inert scaffold, not an installable analytics integration.

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
port 55433, checks initial and repeat migration plus checksum rejection, then
stops the database and removes the temporary directory. These ports must be free.
The CI workflow runs both commands on Ubuntu.

Build output lives in ignored `dist` directories. Shared contracts are source
types consumed by the workspace; the tracker builds to standalone JavaScript.
No production configuration or tracking activation is part of this setup.
