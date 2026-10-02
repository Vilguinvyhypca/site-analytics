import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { startDatabase } from './database.mjs';
import { migrate } from './migrate.mjs';
const directory = await mkdtemp(join(tmpdir(), 'site-analytics-test-'));
let database;
try {
  database = await startDatabase(directory, 55433);
  const url = 'postgresql://analytics_dev:local-development-only@127.0.0.1:55433/site_analytics_dev';
  await migrate(url);
  await migrate(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    assert.equal((await client.query('SELECT count(*)::int AS count FROM schema_migrations')).rows[0].count, 2);
    assert.equal((await client.query('SELECT value FROM workspace_metadata WHERE key = $1', ['schema_stage'])).rows[0].value, 'day-two-workspace');
    const tests = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', 'tests/collection.test.ts'], { stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url } });
    assert.equal(tests.status, 0, 'PostgreSQL collection integration tests');
    await client.query("UPDATE schema_migrations SET checksum = 'changed'");
    await assert.rejects(migrate(url), /checksum mismatch/);
    assert.equal((await client.query('SELECT count(*)::int AS count FROM workspace_metadata')).rows[0].count, 1);
  } finally { await client.end(); }
  console.log('Database initialization, repeat migration, checksum rejection: PASS');
} finally { if (database) await database.stop(); await rm(directory, { recursive: true, force: true }); }
