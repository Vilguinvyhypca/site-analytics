import type pg from 'pg';
import type { EventBatch } from '@site-analytics/contracts';

export interface Collector {
  allowed(projectId: string, origin: string): Promise<boolean>;
  save(batch: EventBatch, origin: string): Promise<number | null>;
}
export function postgresCollector(pool: pg.Pool): Collector {
  return {
    async allowed(projectId, origin) {
      const result = await pool.query('SELECT 1 FROM analytics.projects WHERE id = $1 AND collection_enabled AND $2 = ANY(allowed_origins)', [projectId, origin]);
      return result.rowCount === 1;
    },
    async save(batch, origin) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Hold the project lock through insertion so disabling collection has a defined boundary.
        const project = await client.query('SELECT 1 FROM analytics.projects WHERE id = $1 AND collection_enabled AND $2 = ANY(allowed_origins) FOR SHARE', [batch.projectId, origin]);
        if (!project.rowCount) { await client.query('ROLLBACK'); return null; }
        const result = await client.query(`INSERT INTO analytics.events
          (project_id, id, session_id, schema_version, occurred_at, name, path, properties)
          SELECT $1::uuid, e.id::uuid, e."sessionId"::uuid, 1, e.timestamp::timestamptz, e.name, e.path, e.properties
          FROM jsonb_to_recordset($2::jsonb) AS e(id text, "sessionId" text, timestamp text, name text, path text, properties jsonb)
          ON CONFLICT (project_id, id) DO NOTHING`, [batch.projectId, JSON.stringify(batch.events)]);
        await client.query('COMMIT');
        return result.rowCount ?? 0;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
  };
}
