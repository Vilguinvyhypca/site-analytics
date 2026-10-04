// Temporary isolated database and opt-in collector for manual agent-browser verification.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { startDatabase } from './database.mjs';
import { migrate } from './migrate.mjs';
import { createApp } from '../apps/api/src/app.ts';
import { postgresStore } from '../apps/api/src/collection.ts';
const directory = await mkdtemp(join(tmpdir(), 'analytics-browser-'));
const database = await startDatabase(directory, 55434);
const url = 'postgresql://analytics_dev:local-development-only@127.0.0.1:55434/site_analytics_dev';
await migrate(url);
const pool = new pg.Pool({ connectionString: url });
await pool.query("INSERT INTO projects (id,name,collection_enabled,allowed_origins) VALUES ('static-dev','Browser test',true,ARRAY['http://127.0.0.1:4300'])");
const app = createApp(postgresStore(pool));
await app.listen({ port: 3101, host: '127.0.0.1' });
await import('./static-test-site.mjs');
console.log('Isolated browser collector ready; temporary database port 55434');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await app.close(); await pool.end(); await database.stop(); await rm(directory, { recursive: true, force: true }); process.exit(0);
});
