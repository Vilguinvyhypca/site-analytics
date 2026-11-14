// Disposable full-stack Day 6 environment, with synthetic credentials only.
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { startDatabase } from './database.mjs';
import { migrate } from './migrate.mjs';
import { setOwner } from './set-owner.mjs';
import { createApp } from '../apps/api/src/app.ts';
import { postgresStore } from '../apps/api/src/collection.ts';
import { postgresAdminStore } from '../apps/api/src/admin-store.ts';
const directory = await mkdtemp(join(tmpdir(), 'analytics-owner-browser-'));
let database, pool, app;
async function close() {
  await app?.close(); await pool?.end(); await database?.stop();
  await rm(directory, { recursive: true, force: true });
}
try {
  database = await startDatabase(directory, 55435);
  const url = 'postgresql://analytics_dev:local-development-only@127.0.0.1:55435/site_analytics_dev';
  await migrate(url);
  pool = new pg.Pool({ connectionString: url });
  // The browser may leave a short-lived keepalive request while Ctrl+C triggers
  // fixture teardown; consume expected late socket errors during pool shutdown.
  pool.on('error', () => {});
  await setOwner(pool, 'synthetic-owner-browser-password');
  app = createApp(postgresStore(pool), { store: postgresAdminStore(pool), origin: 'http://127.0.0.1:4302', secret: randomBytes(32).toString('hex') });
  app.get('/*', async (request, reply) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^[A-Za-z0-9_.-]+\.(?:html|js|css)$/.test(name)) return reply.code(404).send();
    try {
      const body = await readFile(new URL(`../apps/dashboard/dist/dashboard/browser/${name}`, import.meta.url));
      return reply.type(name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html').header('Cache-Control', 'no-store').send(body);
    } catch { return reply.code(404).send(); }
  });
  await app.listen({ port: 4302, host: '127.0.0.1' });
  console.log('Disposable owner dashboard: http://127.0.0.1:4302; database port 55435');
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async () => { await close(); process.exit(0); });
} catch (error) { await close(); throw error; }
