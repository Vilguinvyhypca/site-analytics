import pg from 'pg';
import { readConfig } from '../apps/api/src/config.js';
const config = readConfig();
const url = new URL(config.databaseUrl);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/site_analytics_dev') {
  throw new Error('Fixtures require the loopback site_analytics_dev database.');
}
const pool = new pg.Pool({ connectionString: config.databaseUrl });
try {
  await pool.query(`INSERT INTO analytics.projects(id, name, allowed_origins) VALUES
    ('11111111-1111-4111-8111-111111111111', 'MediaSpace development', ARRAY['http://localhost:3001']),
    ('22222222-2222-4222-8222-222222222222', 'Static fixture', ARRAY['http://localhost:4300'])
    ON CONFLICT (id) DO NOTHING`);
  console.log('Development projects seeded; existing collection settings preserved. New projects are disabled.');
} finally { await pool.end(); }
