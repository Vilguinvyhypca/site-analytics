# Day 3 verification

Verified September 29, 2026 (America/New_York).

- `npm run check`: passed ESLint, strict TypeScript/Angular checks, unit tests,
  and all four workspace builds.
- `npm run test:db:local`: passed migration and HTTP-injection-to-PostgreSQL
  integration tests using a disposable PostgreSQL 18 cluster.
- Valid input stored expected rows. Concurrent retries inserted exactly one
  row; subsequent retries inserted none. The same ID in a second project
  inserted a separate row.
- Disabled/unknown projects, incorrect/missing origins, malformed mixed
  batches, stale timestamps, nested properties, extra fields, excessive event
  counts, and oversized bodies were rejected. Invalid batches stored no rows.
- Allowed-origin preflight passed. Database errors return generic 503 without
  leaking internal details. Project disable stops subsequent acceptance.

The initial sandbox database startup failed; the same test passed with approved
execution outside the sandbox. No production database or service was touched.

No UI changed and no browser collection was tested; the tracker remains inert.
The development seed command is provided but was not executed against the
persistent development database. Tests independently created two disabled
fixtures and explicitly enabled them for ingestion checks. Production capacity,
rate limiting, reporting, authentication, and browser consent are later work.
