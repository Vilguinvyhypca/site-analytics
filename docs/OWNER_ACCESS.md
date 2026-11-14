# Day 6 owner access and projects

The dashboard has one password-protected owner account. There is no public signup.
The owner can create up to 100 projects, edit their names and exact allowed website
origins, enable/disable collection, and copy a consent-controlled tracker snippet.
New dashboard-created projects start with collection disabled.

## Development setup

Use the pinned Node runtime from DEVELOPMENT.md. Start the isolated development
PostgreSQL database and migrate it before configuring access:

```bash
npm run db:dev
# In a second terminal:
npm run db:migrate
```

In your ignored local `.env`, configure `DATABASE_URL`, `ADMIN_ORIGIN` and
`AUTH_SECRET`. `ADMIN_ORIGIN` is the exact dashboard address in your browser, such
as `http://127.0.0.1:4200` or `http://127.0.0.1:14200` for the existing SSH tunnel.
Do not add a trailing slash. Generate a random AUTH_SECRET (at least 32 characters),
for example with `openssl rand -hex 32`; keep it private and out of version control.
The secret signs the CSRF cookie and binds CSRF tokens. Keep it stable across
process restarts. Owner session credentials are stored in PostgreSQL as SHA-256
hashes of cryptographically random 32-byte tokens.

Provision the owner using a password of 16–1024 characters. This Bash example reads
it without echoing it or placing it in command arguments/history:

```bash
read -r -s -p 'New owner password: ' analytics_owner_password
printf '%s' "$analytics_owner_password" | npm run owner:set
unset analytics_owner_password
```

`owner:set` uses DATABASE_URL from the process or `.env`. Confirm the target before
running it: the command provisions/replaces the one owner and revokes **all** existing
owner sessions atomically. It never prints the password or hash. Run `npm run dev`,
open the dashboard address matching ADMIN_ORIGIN, and sign in.

COLLECTION_ENABLED stays independently controlled and defaults to false. Owner
access works with collection disabled. A project switch cannot override the global
collection switch. No owner password or secret is generated automatically for the
normal development or production database.

## Recovery and session behavior

Use the same `owner:set` command to recover access or change the password. There
is no email recovery or password-reset web endpoint. Recovery requires trusted
shell/database access. A password change invalidates all old sessions, including
one that raced with login. Login and recovery lock the same owner row in PostgreSQL.

Sessions expire 12 hours after creation, survive an API restart, and are removed
server-side on logout. Login replaces the current browser session and removes
expired rows. Cookies are HttpOnly and SameSite=Strict, with Secure and `__Host-`
names for HTTPS deployments. HTTP owner access is accepted only for loopback
hostnames. The API still binds to 127.0.0.1; deployment routing/HTTPS is Day 14.

All owner mutations require the configured exact Origin and a valid CSRF token
from `/api/auth/session`. Tokens bind to the current session; a pre-login token
cannot mutate authenticated project settings. No admin CORS access is granted.
Owner/auth/report responses use `Cache-Control: no-store`. Sessions, password
hashes and database errors are never returned in API responses.

Login permits five password attempts per minute across the single API process.
The limiter deliberately does not trust forwarded client IPs. It resets with the
process and is not a shared multi-instance limiter; revisit limits for staging and
Day 12. Failed attempts count. A legitimate owner can also be temporarily delayed
by that limit. Hashes use the installed Argon2id implementation's maintained defaults
(19 MiB memory, two passes, one lane).

## Project settings and installation

Origin entries are exact HTTP(S) origins, for example `https://example.com` or
`http://localhost:4300`. Wildcards, URL paths, credentials and duplicate entries
are rejected. Changing the origin list removes access from previous origins.
Project IDs cannot change after creation. Origin checks restrict browser collection;
they are not authentication for the public event collector.

The starter snippet loads `/api/tracker.js` from the current analytics dashboard
origin and targets `/api/collect` there. It is inert until the host calls
`analytics.start()` after consent; withdrawal calls `analytics.stop()`. The default
path allowlist includes only `/`. Extend it only to approved public paths, with
server-verified content visibility for dynamic media. Do not install it in admin
or protected-content pages. For a real deployment, use the reachable HTTPS analytics
origin, not a loopback address or private SSH-forwarded port.

The script route returns 503 until the standalone tracker has been built. Anonymous
`/api/admin/*` and `/api/reports/*` calls are rejected regardless of supplied project
IDs. Authenticated traffic reports use the [reporting API](REPORTING.md); the
Angular reporting screens are available after sign-in.

## Verification

```bash
npm run check
npm run test:db
# Disposable browser environment (uses synthetic credentials, never .env):
node --import tsx scripts/verify-owner-dashboard.mjs
# In another terminal:
node scripts/check-owner-dashboard.mjs
```

The browser environment serves the built Angular dashboard and API together at
`http://127.0.0.1:4302`, with temporary PostgreSQL on port 55435. It provisions only
the temporary database with a clearly synthetic password. Ctrl+C stops it and
removes its temporary database directory. Run the browser checks on a fresh harness.
No production or regular development records are touched. Browser/socket execution
may require sandbox approval.

The database suite verifies login, wrong passwords, CSRF/origin rejection, project
boundaries, disabling collection and removing allowed origins, session expiry,
logout, recovery, session persistence across API instances and login limits.
The browser check exercises login, two project forms, the generated tracker snippet,
consented event storage, disablement, reload, mobile layout and logout against actual
PostgreSQL rows. Screenshots are ignored artifacts under `artifacts/day-six-*`.
