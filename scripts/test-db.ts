import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const directory = await mkdtemp(join(tmpdir(), 'analytics-pg-'));
const postgres = new EmbeddedPostgres({
  databaseDir: directory, port: 55433, user: 'analytics_test',
  password: 'test-only-password', persistent: true, authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1', '-k', directory],
  onLog: () => {}, onError: () => {},
});
let started = false;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  await postgres.createDatabase('site_analytics_test');
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/integration/database.test.ts'], {
      stdio: 'inherit',
      env: { ...process.env, TEST_DATABASE_URL: 'postgresql://analytics_test:test-only-password@127.0.0.1:55433/site_analytics_test' },
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  if (started) await postgres.stop();
  await rm(directory, { recursive: true, force: true });
}
