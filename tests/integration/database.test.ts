import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { migrate, migrationsDirectory } from '../../scripts/database.js';

test('real PostgreSQL migration is repeatable, detects edits, and rolls back failures', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  assert.ok(databaseUrl, 'Set TEST_DATABASE_URL to a disposable database ending in _test.');
  const url = new URL(databaseUrl);
  assert.match(url.pathname, /_test$/, 'Integration tests require a disposable *_test database.');
  const client = new pg.Client({ connectionString: databaseUrl });
  const directory = await mkdtemp(join(tmpdir(), 'site-analytics-migrations-'));
  await client.connect();
  try {
    const schema = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = 'analytics'");
    assert.equal(schema.rowCount, 0, 'Use an empty test database; existing schemas are never removed.');
    const sql = await readFile(join(migrationsDirectory, '001_projects.sql'), 'utf8');
    await writeFile(join(directory, '001_projects.sql'), sql);
    assert.deepEqual(await migrate(databaseUrl, directory), ['001_projects.sql']);
    assert.deepEqual(await migrate(databaseUrl, directory), []);
    const created = await client.query("INSERT INTO analytics.projects(name) VALUES ('Fixture site') RETURNING collection_enabled");
    assert.equal(created.rows[0].collection_enabled, false);
    await writeFile(join(directory, '001_projects.sql'), `${sql}\n-- changed`);
    await assert.rejects(migrate(databaseUrl, directory), /Applied migration changed/);
    await writeFile(join(directory, '001_projects.sql'), sql);
    await writeFile(join(directory, '002_failure.sql'), 'CREATE TABLE analytics.must_rollback (id int); SELECT missing_column;');
    await assert.rejects(migrate(databaseUrl, directory));
    const rollback = await client.query("SELECT to_regclass('analytics.must_rollback') AS table_name");
    assert.equal(rollback.rows[0].table_name, null);
    const ledger = await client.query('SELECT count(*)::int AS count FROM analytics.schema_migrations');
    assert.equal(ledger.rows[0].count, 1);
  } finally {
    await client.end();
    await rm(directory, { recursive: true, force: true });
  }
});
