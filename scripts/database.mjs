import EmbeddedPostgres from 'embedded-postgres';
import { mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export async function startDatabase(directory, port = 55432) {
  await mkdir(directory, { recursive: true });
  const database = new EmbeddedPostgres({ databaseDir: directory, user: 'analytics_dev', password: 'local-development-only', port, persistent: true, postgresFlags: ['-h', '127.0.0.1'] });
  try { await access(`${directory}/PG_VERSION`); } catch { await database.initialise(); }
  await database.start();
  const client = database.getPgClient();
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['site_analytics_dev']);
    if (!exists.rowCount) await database.createDatabase('site_analytics_dev');
  } finally { await client.end(); }
  return database;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const database = await startDatabase(fileURLToPath(new URL('../.local/postgres', import.meta.url)));
  console.log('Development PostgreSQL ready on 127.0.0.1:55432');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await database.stop(); process.exit(0); });
}
