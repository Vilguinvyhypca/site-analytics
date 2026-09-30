import { readConfig } from '../apps/api/src/config.js';
import { migrate } from './database.js';

try {
  const applied = await migrate(readConfig().databaseUrl);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
}
