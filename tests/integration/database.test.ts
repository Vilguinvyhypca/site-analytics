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

test('HTTP ingestion validates batches, isolates projects, and deduplicates in PostgreSQL', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL!;
  assert.match(new URL(databaseUrl).pathname, /_test$/);
  await migrate(databaseUrl);
  const { createApp } = await import('../../apps/api/src/app.js');
  const { postgresCollector } = await import('../../apps/api/src/collection.js');
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const app = createApp(async () => {}, false, postgresCollector(pool));
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';
  const origin = 'http://localhost:4300';
  const event = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', timestamp: new Date().toISOString(), name: 'page_view', path: '/', properties: {} };
  const send = (projectId: string, events: unknown[] = [event], requestOrigin = origin) => app.inject({ method: 'POST', url: `/v1/collect/${projectId}`, headers: { origin: requestOrigin }, payload: { version: 1, projectId, events } });
  try {
    await pool.query('INSERT INTO analytics.projects(id, name, allowed_origins) VALUES ($1, $3, $4), ($2, $3, $4)', [first, second, 'Ingestion fixture', [origin]]);
    assert.equal((await send(first)).statusCode, 403);
    assert.equal((await send('33333333-3333-4333-8333-333333333333')).statusCode, 403);
    await pool.query('UPDATE analytics.projects SET collection_enabled = true WHERE id = ANY($1::uuid[])', [[first, second]]);
    assert.equal((await send(first, [event], 'https://wrong.example')).statusCode, 403);
    assert.equal((await send(first, [event], '')).statusCode, 403);
    const preflight = await app.inject({ method: 'OPTIONS', url: `/v1/collect/${first}`, headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], origin);
    for (const invalid of [{ ...event, path: '/?token=secret' }, { ...event, timestamp: '2000-01-01T00:00:00.000Z' }, { ...event, properties: { nested: {} } }, { ...event, unexpected: true }]) {
      assert.equal((await send(first, [event, invalid])).statusCode, 400);
    }
    assert.equal((await send(first, Array(51).fill(event))).statusCode, 400);
    assert.equal((await send(first, [{ ...event, properties: { huge: 'x'.repeat(40_000) } }])).statusCode, 413);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM analytics.events')).rows[0].count, 0);
    const results = await Promise.all([send(first), send(first)]);
    assert.ok(results.every((result) => result.statusCode === 202));
    assert.equal(results.reduce((sum, result) => sum + result.json().accepted, 0), 1);
    assert.deepEqual((await send(first)).json(), { accepted: 0, duplicates: 1 });
    assert.deepEqual((await send(second)).json(), { accepted: 1, duplicates: 0 });
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM analytics.events')).rows[0].count, 2);
    await pool.query('UPDATE analytics.projects SET collection_enabled = false WHERE id = $1', [first]);
    assert.equal((await send(first)).statusCode, 403);
  } finally { await app.close(); await pool.end(); }
});
