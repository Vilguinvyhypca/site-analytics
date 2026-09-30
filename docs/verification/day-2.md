# Day 2 verification

Verified September 29, 2026 (America/New_York) on Ubuntu x64, Node 22.23.2.

## Scope

The owner starts a local dashboard, which requests status through the Angular
development proxy. Fastify verifies the PostgreSQL migration ledger and returns
readiness. The dashboard displays the actual response. Visitor collection is off.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run check` | Passed | ESLint, TypeScript, Angular template checks, API/tracker tests, and four workspace builds completed with exit 0 |
| Dashboard production build | Passed | 105.40 kB initial output; approximately 31.91 kB estimated transfer |
| Standalone tracker build | Passed | 563-byte inert IIFE; tested in a JS context with no framework, storage, or network globals |
| `npm run db:migrate` | Passed | Fresh local PostgreSQL applied `001_projects.sql` |
| `npm run test:db:local` | Passed | Real PostgreSQL 18: repeat migration, default-disabled project, checksum mismatch rejection, failed DDL rollback, ledger consistency |
| Desktop browser | Passed | Heading, empty state, report placeholders, connection status, and refresh control rendered; no initial browser errors |
| Mobile browser | Passed | 390 × 844 viewport, readable stacked layout; document width did not exceed viewport |
| Browser → proxy → API → database | Passed | Connection panel displayed `API and database connected` |
| Database outage | Passed | Stopped the task's development database; browser displayed `API connected · database unavailable` |
| Database restart and recovery | Passed | Restart reused the persisted cluster; refresh restored `API and database connected` |
| Runtime dependency audit | Passed | `npm audit --omit=dev --audit-level=moderate` reported zero vulnerabilities |

The database-failure API test also checks a 503 response without leaking internal
error text; liveness remains 200. Event ingestion is deliberately absent (404).

Browser request interception did not provide reliable failure evidence in this
environment. The outage/recovery result above uses an actual database stop and
restart instead; it does not rely on mocked responses.

## Boundaries and remaining work

- GitHub CI configuration is included; a remote CI run is separate evidence.
- These checks cover the Day 2 foundation, not visitor tracking, reporting,
  authentication, load capacity, production deployment, or the full browser matrix.
- The shared contracts package currently defines status responses only; Day 3
  adds versioned event validation and storage.
- Port 4200 was already serving another development page. This workspace uses
  loopback 4201 (dashboard), 4100 (API), and 55432 (development PostgreSQL).
- No MediaSpace source, production credentials, production data, or reverse-proxy
  configuration was changed.

Reproduce using [local setup](../SETUP.md). The repository's progress tracker
records the next task; all Day 3–15 implementation remains pending.
