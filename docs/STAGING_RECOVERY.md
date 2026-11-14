# Staging and recovery readiness

This is a preparation checklist, not a deployment record. The owner selected a
separate MacBook Pro running Ubuntu 24.04 LTS on x86_64, with systemd 255, as
the staging host. Node.js is not installed yet. Network/reverse-proxy setup,
staging database, external backup destination, and uptime monitor are not
configured or verified. Keep collection off until the owner approves a separate
pilot. Do not point this service at MediaSpace or enable tracking on a live site
as part of this rehearsal.

## Verified application behavior

- The Node API binds to `127.0.0.1` and defaults to port `3100`; it needs a
  separately managed HTTPS reverse proxy before remote dashboard access or
  browser collection is possible.
- `GET /api/health` is a liveness response. It says the process can answer HTTP
  and whether collection was enabled at startup. `GET /api/ready` checks the
  configured database with `SELECT 1`; it returns 503 when the database is
  unconfigured or unavailable and does not expose database errors. Neither
  endpoint checks proxy/TLS routing or tracker-asset delivery.
- `GET /api/tracker.js` is publicly cached for five minutes. Owner and report
  responses are marked `no-store`.
- The tracker and collector currently share contract version 1. Build and
  deploy them from the same release so a newly served tracker matches the API.
  Browsers, proxies, or extensions may retain a cached tracker beyond its
  advertised cache lifetime, so keep accepting contract v1 during compatible
  updates. For a breaking contract change, introduce a separately versioned
  tracker/collector route and preserve the old route for cached clients; do not
  silently change the meaning of v1.
- Fastify request logging is currently off. Collector errors return generic
  responses and do not include event payloads in the response. There is no
  production log sink or alerting configuration yet.
- The development logical JSON export is localhost-only and mode `0600`. It is
  useful for synthetic restore tests, but is not an operational backup: it does
  not include PostgreSQL roles, extensions, WAL, or point-in-time recovery.
- Migrations are ordered SQL files applied transactionally under an advisory
  lock. Their SHA-256 checksums are enforced. There are no down migrations; do
  not edit an applied migration to attempt rollback.

## Staging package status

`npm run build` produces the API bundle at `apps/api/dist/server.js`, Angular
browser assets under `apps/dashboard/dist/dashboard/browser`, and the tracker
bundle at `packages/tracker/dist/tracker.js`. The API build leaves the workspace
contracts package as a runtime dependency, so deploy the repository workspace
structure rather than copying only `apps/api/dist/server.js`. The API can now
optionally serve the Angular assets and client-side routes from `DASHBOARD_DIR`,
on the same origin as the API and tracker. `npm start` is the production API entry point; it reads
the optional `.env` and expects the workspace build to have completed first.
Leave `COLLECTION_ENABLED=false` unless running an approved isolated staging
journey. Point `DASHBOARD_DIR` at the Angular `browser` output directory.

`npm run dev` remains the two-process API plus Angular development server. The
same-origin serving path passed API injection tests, a full local build, and
a brief run of the built API with collection disabled; an Angular client route
was served successfully. It has not yet been run as a supervised service on the
MacBook. Staging still needs its HTTPS/reverse-proxy setup and a restart/recovery
rehearsal on the Linux MacBook Pro. Verify that dashboard and collector share
the expected HTTPS origin before using any generated tracker snippet.

### Initial source-based release procedure

Until a slim artifact builder is added, prepare staging from a clean checkout of
the reviewed release commit and retain the workspace layout. Build and verify it
with the pinned Node/npm versions before removing development-only packages:

```bash
git checkout <reviewed-release-commit>
npm ci
npm run check
npm run test:db
npm prune --omit=dev
```

Keep the clean workspace checkout, including all package manifests, source,
migrations, scripts, and lockfile, together with generated `dist` assets and
production `node_modules` under `/opt/site-analytics`. The service only needs
read access to this release tree. Run the disposable database suite on the
verified development/build machine; its embedded PostgreSQL binary is
architecture-specific and is not the staging database. Record the commit and
release checksum before copying the tree to the host. This source-based
procedure has not yet been rehearsed end to end, and no artifact has been copied
to the MacBook.

## Linux host setup (MacBook Pro)

The small-pilot app does not need a high-end computer. Use a Linux distribution
that still receives security updates; 16 GB RAM and wired networking are
practical preferences, not application requirements. Keep the laptop on power
and configure it to stay awake during the staging window.

Install or prepare:

- Git from the selected Linux distribution or the official Git project.
- Node.js **24.22.3** and its bundled npm to match `.nvmrc`. This is the
  official security-patched x64 Linux release for this Ubuntu host. Download
  [`node-v24.22.3-linux-x64.tar.xz`](https://nodejs.org/dist/v24.22.3/node-v24.22.3-linux-x64.tar.xz)
  and verify SHA-256
  `4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb`
  against the signed
  [Node.js release checksums](https://nodejs.org/en/blog/release/v24.22.3).
  Extract to `/opt/node-v24.22.3-linux-x64` so the runtime is outside `/home`
  and accessible with `ProtectHome=true`.
- PostgreSQL **18** for version consistency with the project's database tests.
  Use the selected Linux distribution's supported package source. Bind
  PostgreSQL to loopback and use a dedicated staging database/role.
- The project source and a built release artifact. The initial runbook may build
  from source, but the eventual staging service should run only the files and
  runtime dependencies it needs.
- A systemd service, so the app starts at boot without waiting for a user login.

No Docker installation is required. The repository's embedded PostgreSQL test
binary is Linux x64-specific; do not use `npm run db:dev` as the staging database.
Install a normal PostgreSQL 18 service for the laptop's Linux architecture.
Automated browser tooling is for the test operator's machine and does not need to
run on the staging host.

### Draft boot-time systemd service

[`site-analytics-staging.service.example`](../deploy/linux/site-analytics-staging.service.example)
is a template, not an installed service. It runs at boot as the dedicated,
unprivileged `siteanalytics` account and restarts on failure. Install Node
24.22.3 at `/opt/node-v24.22.3-linux-x64` as described above, and confirm the
app build and database are accessible read-only to that account. Install the
release files under `/opt/site-analytics`
owned by root and readable by the service group; keep runtime-writable data
outside the release tree. Create `/etc/site-analytics/staging.env` with
`COLLECTION_ENABLED=false`, the absolute `DASHBOARD_DIR`, `DATABASE_URL`,
`ADMIN_ORIGIN`, and `AUTH_SECRET`. Keep secrets out of the repository and make
the environment file root-owned with mode `0600`; systemd reads it before
launching the service.

Installing the unit requires administrator access to create the service account,
install the file under `/etc/systemd/system`, and set root ownership/mode. Copy
the example into the deployment workspace, review the paths, then validate the
copy before installing it. For example, from the repository root:

```bash
cp deploy/linux/site-analytics-staging.service.example /tmp/site-analytics-staging.service
${EDITOR:-vi} /tmp/site-analytics-staging.service
sudo useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin siteanalytics
systemd-analyze verify /tmp/site-analytics-staging.service
sudo install -d -o root -g root -m 0755 /etc/site-analytics
sudoedit /etc/site-analytics/staging.env
sudo chown root:root /etc/site-analytics/staging.env
sudo chmod 0600 /etc/site-analytics/staging.env
sudo install -o root -g root -m 0644 /tmp/site-analytics-staging.service /etc/systemd/system/site-analytics-staging.service
sudo systemctl daemon-reload
sudo systemctl enable --now site-analytics-staging
sudo systemctl status site-analytics-staging
journalctl -u site-analytics-staging
curl --fail http://127.0.0.1:3100/api/health
curl --fail http://127.0.0.1:3100/api/ready
sudo systemctl disable --now site-analytics-staging
```

Create the `siteanalytics` system account and install the release tree before
enabling the unit. Confirm that the environment file includes the variables
above, a unique strong owner secret, and a database URL restricted to the local
staging database. Apply migrations and provision the owner before starting the
web service. Run these one-shot commands as an administrator from the release
directory, substituting the actual system-wide Node path:

```bash
sudo systemd-run --wait --pipe --collect --uid=siteanalytics --working-directory=/opt/site-analytics --property=EnvironmentFile=/etc/site-analytics/staging.env /usr/local/bin/node scripts/migrate.mjs
read -r -s -p 'New staging owner password: ' analytics_owner_password
printf '%s' "$analytics_owner_password" | sudo systemd-run --wait --pipe --collect --uid=siteanalytics --working-directory=/opt/site-analytics --property=EnvironmentFile=/etc/site-analytics/staging.env /usr/local/bin/node scripts/set-owner.mjs
unset analytics_owner_password
```

The one-shot units run with the staging environment but do not persist as
services. The password is read without echo and passed to the owner utility over
stdin; never place it in a command argument or saved shell history. Keep the unit
and environment file out of shared logs or screenshots. If health or readiness
fails, inspect the service status and journal, correct the configuration, and
repeat the local checks before adding HTTPS or remote access.

These commands have not been run on the staging Linux laptop. Its Ubuntu 24.04
x86_64 distribution, systemd 255, and absence of Node.js are confirmed; the
administrator account, service-account creation, database installation, and
network/access setup still need to be completed there.

Install current Linux security updates, enable the firewall, use the dedicated
non-admin service account for the app, and keep staging secrets out of the
repository. Configure an encrypted off-device backup and a separate alert
destination. Do not expose PostgreSQL to the internet. Select HTTPS/reverse-proxy
or private-network access after deciding who needs to reach staging; the API
itself remains bound to loopback.

## Before a staging rehearsal

Record the Linux distribution/version and CPU architecture, service owner,
HTTPS/reverse-proxy and network access plan, process supervisor, PostgreSQL
version and access policy,
encrypted backup destination and retention, independent alert recipient, and how
an operator can reach the host if the application or tunnel is unavailable. Keep
secrets in the chosen host's secret manager/environment, not in `.env` committed
to the repository.
Restrict PostgreSQL to the API host and backup/restore operator; do not expose its
port publicly. Store backups off-host and encrypt them.

Build a release artifact with the pinned Node runtime and run `npm run check` and
`npm run test:db` before installation. Configure a fresh staging database, apply
migrations, provision a unique owner password and stable random `AUTH_SECRET`,
set the exact HTTPS `ADMIN_ORIGIN`, and leave `COLLECTION_ENABLED=false`. Keep
staging credentials and data separate from development and any live service.

After installation, verify the HTTPS dashboard, owner login/logout, project
settings while collection is disabled, `/api/health`, and the tracker asset's
content type/cache header. Check reverse-proxy logs and application logs for
secrets or request bodies. Restart the managed process and repeat the checks.
Use `/api/health` for process liveness and `/api/ready` for database readiness.
Monitor HTTPS/proxy routing and tracker-asset delivery separately; these checks
do not cover those components.

## Migration, rollback, and restore rehearsal

1. Take and verify an encrypted off-host PostgreSQL backup before applying a
   schema migration. The staging backup procedure must be selected and tested;
   the local JSON helper is not a substitute.
2. Record the currently deployed artifact/version and migration list. Apply the
   new artifact and its forward-only migrations to staging, then run the smoke
   checks above and a synthetic consented collector journey if collection is
   intentionally enabled for that isolated test project.
3. For an application-only failure, disable collection, restore the previous
   application artifact, and keep the database at its newer compatible schema.
   This is safe only when the old code is compatible with the applied schema;
   establish that compatibility for each release before rollout.
4. If data/schema recovery is needed, restore the database backup into a separate
   isolated instance first. Verify owner login and aggregate report totals before
   changing any service connection. A restore overwrites data if directed at the
   wrong database, so never rehearse by restoring over a live database.
5. Confirm collection can be disabled independently with
   `COLLECTION_ENABLED=false`, restart the service, and verify the public
   collector route no longer accepts events. Re-enable only after the operator
   confirms service and database health.

Day 14 is not complete until the actual host-specific steps, backup/restore,
restart, collection-disable, and application rollback have been exercised and
recorded. No external monitor or staging service has been configured by this
document.
