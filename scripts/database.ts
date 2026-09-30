import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Every migration and its ledger entry commit together on one connection. */
export async function migrate(databaseUrl: string, directory = migrationsDirectory) {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3_000 });
  const applied: string[] = [];
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query('SELECT pg_advisory_xact_lock(73241002)');
    await client.query('CREATE SCHEMA IF NOT EXISTS analytics');
    await client.query(`CREATE TABLE IF NOT EXISTS analytics.schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(`${directory}/${name}`, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM analytics.schema_migrations WHERE version = $1', [name]);
      if (existing.rows.length) {
        if (existing.rows[0]?.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO analytics.schema_migrations(version, checksum) VALUES ($1, $2)', [name, checksum]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
