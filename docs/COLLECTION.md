# Day 3 collection contract

The collector is implemented and tested locally. The [Day 4 tracker](TRACKER.md) implements consented browser page views and bounded batching. Reporting, authentication, abuse rate limits, retention cleanup, and production deployment are later packages.

## Enable isolated development collection

Start the local PostgreSQL server as described in [development setup](DEVELOPMENT.md), then run:

```bash
npm run db:migrate
npm run db:seed
```

Set `COLLECTION_ENABLED=true` in your local `.env` and restart `npm run dev`. A database URL is mandatory when enabled. The default example stays `false`, which leaves `/api/collect` unregistered. The API stays on loopback.

`db:seed` deliberately ignores `DATABASE_URL` and seeds only the hardcoded isolated development database. Repeating it preserves existing settings. It creates `mediaspace-dev` for `http://localhost:3000` / `http://127.0.0.1:3000` and `static-dev` for the corresponding port 4300 origins. These development projects permit collection, subject to the global flag. No production project or MediaSpace application configuration is changed.

## Request and response

POST `/api/collect` with `Content-Type: application/json` and the browser's `Origin` header. Example shape (replace UUIDs and timestamp with fresh test values):

```json
{
  "version": 1,
  "projectId": "static-dev",
  "events": [{
    "version": 1,
    "projectId": "static-dev",
    "eventId": "621afcc8-e319-4de5-a5ba-2cfdf0393790",
    "sessionId": "bba58e35-d6e0-435a-9c0c-6b5b0e9861b8",
    "occurredAt": "2026-10-02T04:00:00Z",
    "type": "page_view",
    "path": "/videos"
  }]
}
```

Success returns HTTP 202 with `{ "accepted": 1, "duplicates": 0 }`. Validation failure returns 400, unauthorized project/origin returns 403, an encoded body over 65,536 bytes returns 413, unsupported media types return 415, and storage failure returns 503 without database details. Schema and storage work apply to the whole batch: an invalid event rejects the batch; a write error rolls back all its inserts.

## Bounds and privacy

- Exactly version 1; 1–50 events per batch; at most 64 KiB for the complete encoded body.
- Event/session/playback IDs are UUIDs. Project/content IDs use 1–128 letters, digits, underscores or hyphens. Every event must match the batch project.
- Timestamps must be valid date-time strings, at most 24 hours old or five minutes ahead of server time. Store UTC instants plus a separate server receipt time. These provisional skew/retry bounds should be revisited after the tracker prototype.
- Unknown properties and incorrect primitive types are rejected, without coercion or silently stripping fields. Arbitrary user properties are not supported in v1. Paths have a leading slash and at most 1,024 characters, with no query, fragment, whitespace or backslash; referrers are lowercase hostnames only. Host integrations must still sanitize personal path segments and exclude private/admin content before sending.
- Allowed types: page views, content impressions/opens (photo/video), playback starts, cumulative playback progress, and sharing outcomes (`clicked`, `copied`, `handoff`, `cancelled`, `failed`). Shared TypeScript contracts and runtime schemas live together in [contracts](../packages/contracts/src/index.ts).
- Progress has a positive integer sequence, engaged time of 0–86,400 seconds, and known duration above zero up to 86,400 seconds or null. At most 100 sorted, nonoverlapping, positive-length coverage intervals, all within known duration. Unknown duration requires empty coverage and `ended=false`. Repeated playback can legitimately have engaged time exceeding duration.

## Origins and deduplication

Require an exact HTTP(S) origin present in the enabled project's allowlist; missing/opaque `null` origins fail. Unknown and disabled projects return the same response. Origin checks constrain browsers; anonymous clients can forge headers, so this is not authentication. JSON preflight responses allow the requesting HTTP(S) origin without revealing project settings; actual POST checks the project's allowlist and emits CORS headers only on acceptance. No credentialed CORS access is enabled.

Deduplication uses the database primary key `(project_id, event_id)`, including concurrent requests and duplicate IDs inside a batch. First stored payload wins; retrying an ID cannot overwrite it. The same ID may exist in a different project. Deduplication lasts while the raw row exists; eventual retention deletion also removes that boundary. Project rows are locked during collection so disabling a project or changing allowed origins waits for in-flight collection to finish.

Progress events are raw snapshots, not additive watch totals. Different event IDs for older/newer playback sequences are stored as distinct observations. Day 9 reporting must reconcile by project/playback/sequence rather than summing snapshots, and preserve timing for day boundaries. No watch total or completion report is exposed yet.

## Evidence

`npm run check` validates schemas, failure handling, types and builds. `npm run test:db` additionally creates temporary real PostgreSQL, applies/repeats migrations, verifies checksum rejection, then exercises API → database → response: exact stored payloads, retries, concurrent duplicates, project isolation, origin checks, project disable, and rollback on a later write failure. All fixture data is synthetic and the temporary database is removed afterwards.
