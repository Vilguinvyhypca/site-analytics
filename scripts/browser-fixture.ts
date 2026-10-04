/** Disposable, loopback-only browser -> API -> PostgreSQL verification fixture. */
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { postgresCollector } from '../apps/api/src/collection.js';
import { migrate } from './database.js';

const directory = await mkdtemp(join(tmpdir(), 'analytics-browser-'));
const postgres = new EmbeddedPostgres({ databaseDir: directory, port: 55435, user: 'browser_test', password: 'disposable-test-only', persistent: false, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1', '-k', directory], onLog: (message) => console.log(message), onError: (message) => console.error(message) });
let started = false;
const databaseUrl = 'postgresql://browser_test:disposable-test-only@127.0.0.1:55435/site_analytics_browser_test';
const pool = new pg.Pool({ connectionString: databaseUrl });
// The embedded database also handles signals; absorb idle-client shutdown errors.
pool.on('error', () => { if (!stopping) console.error('Fixture database connection unavailable.'); });
const app = createApp(async () => { await pool.query('SELECT 1'); }, false, postgresCollector(pool));
let failCollection = false;
let loseNextResponse = false;
const attempts: { ids: string[]; status: number; result: unknown }[] = [];
app.addHook('onSend', async (request, reply, payload) => {
  if (request.method !== 'POST' || !request.url.startsWith('/v1/collect/')) return payload;
  const body = request.body as { events?: { id: string }[] } | undefined;
  if (loseNextResponse && reply.statusCode === 202) { loseNextResponse = false; reply.code(503); }
  attempts.push({ ids: body?.events?.map(event => event.id) ?? [], status: reply.statusCode, result: typeof payload === 'string' ? JSON.parse(payload) : null });
  return payload;
});
app.addHook('onRequest', async (request, reply) => {
  if (request.method === 'POST' && failCollection) return reply.header('Access-Control-Allow-Origin', 'http://localhost:4302').code(503).send({ error: 'Simulated fixture outage' });
});
const bundle = await build({ entryPoints: ['packages/tracker/src/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'SiteAnalytics' });
const server = createServer(async (request, response) => {
  try {
    // Reject foreign Host headers and cross-origin requests to the test controls.
    if (!['localhost:4302', '127.0.0.1:4302'].includes(request.headers.host ?? '')) { response.writeHead(403).end(); return; }
    const path = new URL(request.url!, 'http://localhost:4302').pathname;
    if (path.startsWith('/__test/')) {
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== 'http://localhost:4302')) { response.writeHead(403).end(); return; }
      response.setHeader('Cache-Control', 'no-store');
      if (path === '/__test/lost-response' && request.method === 'POST') { loseNextResponse = true; response.end('{}'); return; }
      if (path === '/__test/attempts' && request.method === 'GET') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(attempts)); return; }
      if (path === '/__test/failure' && request.method === 'POST') { failCollection = !failCollection; response.end(JSON.stringify({ failCollection })); return; }
      if (path === '/__test/events' && request.method === 'GET') {
        const rows = (await pool.query('SELECT id, session_id, name, path, properties FROM analytics.events ORDER BY received_at, id')).rows;
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(rows)); return;
      }
      response.writeHead(404).end(); return;
    }
    if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
    if (path === '/tracker.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0]!.text); return; }
    if (path === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile('tests/fixtures/browser/fixture.js')); return; }
    if (!['/', '/gallery', '/admin'].includes(path)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', 'text/html'); response.end(await readFile('tests/fixtures/browser/index.html'));
  } catch { response.writeHead(500).end('Fixture unavailable'); }
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  await app.close(); await pool.end();
  if (started) await postgres.stop();
  await rm(directory, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void stop(); });
try {
  await postgres.initialise(); await postgres.start(); started = true;
  await postgres.createDatabase('site_analytics_browser_test'); await migrate(databaseUrl);
  await pool.query("INSERT INTO analytics.projects(id, name, allowed_origins, collection_enabled) VALUES ('22222222-2222-4222-8222-222222222222', 'Disposable browser fixture', ARRAY['http://localhost:4302'], true)");
  await app.listen({ host: '127.0.0.1', port: 4102 });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(4302, '127.0.0.1', resolve); });
  console.log('Browser fixture ready: http://localhost:4302 (API 4102, disposable PostgreSQL 55435). Ctrl+C removes test data.');
} catch (error) { console.error(error); await stop(); process.exitCode = 1; }
