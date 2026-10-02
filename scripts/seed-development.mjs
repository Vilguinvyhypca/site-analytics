import pg from 'pg';
import { developmentUrl } from './migrate.mjs';
// Deliberately ignores DATABASE_URL: this command seeds only the isolated local database.
const client = new pg.Client({ connectionString: developmentUrl });
await client.connect();
try {
  await client.query(`INSERT INTO projects (id, name, collection_enabled, allowed_origins) VALUES
    ('mediaspace-dev', 'MediaSpace development', true, ARRAY['http://127.0.0.1:3000','http://localhost:3000']),
    ('static-dev', 'Static test website', true, ARRAY['http://127.0.0.1:4300','http://localhost:4300'])
    ON CONFLICT (id) DO NOTHING`);
  console.log('Local development projects seeded (existing settings preserved)');
} finally { await client.end(); }
