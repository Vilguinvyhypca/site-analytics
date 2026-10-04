import pg from 'pg';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { postgresCollector } from './collection.js';

const config = readConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5, connectionTimeoutMillis: 2_000, statement_timeout: 2_000 });
pool.on('error', () => console.error('Database connection unavailable.'));
const app = createApp(async () => {
  await pool.query('SELECT version FROM analytics.schema_migrations LIMIT 1');
}, true, postgresCollector(pool));
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
try {
  await app.listen({ host: '127.0.0.1', port: config.port });
} catch {
  console.error('API startup failed. Check the local port and database configuration.');
  await app.close();
  process.exitCode = 1;
}
