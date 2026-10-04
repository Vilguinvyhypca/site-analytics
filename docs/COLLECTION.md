# Version 1 collection contract

`POST /v1/collect/:projectId` accepts JSON with `version: 1`, a matching UUID
`projectId`, and 1–50 events. Maximum request size is 32 KiB. Unknown fields
are rejected; a malformed event rejects the entire batch before storage.

Each event requires UUID `id` and `sessionId`, canonical UTC `timestamp`
(`2026-09-30T01:00:00.000Z` format), `name`, `path`, and `properties`.
Timestamps may be at most 24 hours old or five minutes ahead of server time.
Names are 1–64 lowercase letters/digits/underscores, starting with a letter.
Paths start with one slash, have at most 512 characters, and reject query,
fragment, percent escapes, whitespace, control characters, and backslashes.
This conservative v1 path policy requires the tracker to produce safe paths;
it does not yet support encoded international paths.

Properties allow at most 16 keys (lowercase identifier, maximum 32 characters)
and scalar booleans, finite numbers, or strings up to 128 characters without
control characters. Nested values and prototype-related keys are rejected.
These bounds are not automatic PII detection: the tracker must use explicit
safe property names/values and omit sensitive path segments and identifiers.
No request IP, user-agent, or arbitrary request header is stored with events.

The project must exist, be enabled, and exactly match the request `Origin`
in its configured allowlist. Missing origins are denied. OPTIONS preflight
uses the same project checks and permits POST with Content-Type only.
Origins are a browser boundary, not authentication: non-browser clients can
forge them. Abuse controls and authenticated project management remain later work.

Success returns 202 with `{ accepted, duplicates }`; duplicate means the
(project ID, event ID) already exists or repeats in this batch. First write
wins; a retry never changes the stored payload. Different projects may reuse
an event ID. Insertion is atomic and holds a shared project lock until commit,
so a project disable update waits for already accepted transactions.
Invalid input returns 400, denied projects/origins 403, oversized requests 413,
and database failures a generic 503. Unsupported media types return 415.

After `npm run db:migrate`, `npm run db:seed:dev` creates two disabled projects
only in a loopback database named `site_analytics_dev`:

| ID | Name | Allowed origin |
| --- | --- | --- |
| `11111111-1111-4111-8111-111111111111` | MediaSpace development | `http://localhost:3001` |
| `22222222-2222-4222-8222-222222222222` | Static fixture | `http://localhost:4300` |

Seeding preserves existing settings. Tests enable fixtures only in disposable
PostgreSQL. No browser tracker or production integration is activated here.
