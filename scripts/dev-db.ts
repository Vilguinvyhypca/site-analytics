import { access, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { readConfig } from '../apps/api/src/config.js';

const databaseUrl = new URL(readConfig().databaseUrl);
if (databaseUrl.hostname !== '127.0.0.1' || databaseUrl.port !== '55432'
  || databaseUrl.pathname !== '/site_analytics_dev' || databaseUrl.username !== 'analytics_dev'
  || databaseUrl.password !== 'local-development-only' || databaseUrl.search || databaseUrl.hash) {
  throw new Error('db:dev only starts the isolated database from .env.example.');
}
const directory = fileURLToPath(new URL('../.local/postgres/', import.meta.url));
await mkdir(directory, { recursive: true, mode: 0o700 });
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'analytics_dev', password: 'local-development-only', port: 55432,
  persistent: true, authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', directory],
  onLog: () => {}, onError: () => {},
});
let started = false;
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  if (started) await postgres.stop();
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void stop(); });
try {
  const initialized = await access(`${directory}/PG_VERSION`).then(() => true, () => false);
  if (!initialized) await postgres.initialise();
  await postgres.start();
  started = true;
  const client = postgres.getPgClient();
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['site_analytics_dev']);
    if (!existing.rowCount) await client.query('CREATE DATABASE site_analytics_dev');
  } finally { await client.end(); }
  console.log('Development PostgreSQL ready on 127.0.0.1:55432. Ctrl+C stops it; data stays in .local/postgres.');
} catch {
  console.error('Development PostgreSQL could not start. Check port 55432 and .local/postgres permissions.');
  await stop();
  process.exitCode = 1;
}
