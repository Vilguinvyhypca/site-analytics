# Release readiness

Status: core MVP implementation and local verification are substantially
complete. This is a readiness record, not an approval to deploy. The project is
not ready for production rollout until the open browser and staging items below
are closed and the owner reviews the release candidate.

## Acceptance evidence

| Area | Status | Evidence |
| --- | --- | --- |
| Consent-aware tracker, bounded collection, sanitization and retries | Verified locally | [Tracker contract](TRACKER.md), `tests/tracker.test.ts`, `tests/collection.test.ts` |
| Owner login, project isolation and collection controls | Verified locally | [Owner access](OWNER_ACCESS.md), `tests/admin.test.ts`, `scripts/check-owner-dashboard.mjs` |
| Traffic and engagement reports | Verified locally | [Reporting](REPORTING.md), [engagement reports](ENGAGEMENT_REPORTS.md), database suite |
| Native playback, sharing, overlays and feed scrolling | Verified with synthetic browser/database journeys | [Native video](NATIVE_VIDEO.md), [content actions](CONTENT_ACTIONS.md), [progress evidence](PROGRESS.md), `tests/native-video.test.ts` |
| Retention, project deletion, backup/restore helper and query index | Verified locally | [Daily plan](DAILY_PLAN.md), `scripts/check-backup-restore.mjs`, database suite |
| Small-pilot limits and overload response | Verified locally; capacity ceiling is not a production guarantee | [Daily plan](DAILY_PLAN.md), [progress measurements](PROGRESS.md) |
| Browser/device compatibility | Partial | [Browser verification matrix](BROWSER_VERIFICATION.md) |
| Linux boot-time service, HTTPS and operational recovery | Documented, not installed or rehearsed | [Staging and recovery](STAGING_RECOVERY.md), [systemd template](../deploy/linux/site-analytics-staging.service.example) |

## Open release blockers

1. Complete the desktop/mobile browser matrix. WebKit could not launch in the
   current Linux environment because system libraries are missing; this is not
   Safari verification. Physical mobile-device coverage is also open.
2. Identify the staging MacBook's Linux distribution/version and CPU
   architecture, select its system-wide Node 24.21.0 path, and create the
   service account. Validate the actual unit and install it with administrator
   access.
3. Configure the staging PostgreSQL database, HTTPS/private access path and
   reverse proxy. Apply migrations, provision the owner, and complete the
   service restart, collection-disable, rollback, encrypted off-host backup and
   isolated restore rehearsals.
4. Set an independent service owner, alert destination and external uptime
   monitor. Verify the actual public routing and alert path from outside the
   host.
5. Revisit the measured operating ceiling on the actual staging hardware before
   any production expansion. Current rate/concurrency limits are per process;
   they do not establish multi-process capacity or cap the number of visitors.

## Release boundaries

- Keep collection disabled outside an explicitly approved, isolated pilot.
- MediaSpace integration evidence uses synthetic fixtures in an isolated
  development checkout. It is not a production deployment or live visitor
  measurement.
- Native HTML video is the supported MVP integration. Mux production integration
  remains deferred; the Mux prototype is not a release dependency.
- Session replay, billing/load-triggered fees, public signup and multi-instance
  scale are outside the first release.
- All repository changes remain local and uncommitted. No staging service,
  production service, production database or live-site tracker was changed.

## Decision

Do not call this a production-ready release candidate yet. The core feature set
has repeatable local evidence, but Day 11 browser coverage and Day 14 staging,
backup and recovery exercises remain incomplete. Revisit this decision after the
staging host has been configured and the owner has reviewed the exact release
commit, production configuration and rollout/rollback procedure.
