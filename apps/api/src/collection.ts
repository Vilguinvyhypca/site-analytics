import type { Pool } from 'pg';
import type { CollectionBatch, CollectionResponse } from '@site-analytics/contracts';
export interface CollectionStore { collect(batch: CollectionBatch, origin: string): Promise<CollectionResponse | null> }
export function postgresStore(pool: Pool): CollectionStore {
  return { async collect(batch, origin) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lock keeps disable/origin changes from racing an in-flight collection transaction.
      const project = await client.query('SELECT id FROM projects WHERE id = $1 AND collection_enabled AND $2 = ANY(allowed_origins) FOR SHARE', [batch.projectId, origin]);
      if (!project.rowCount) { await client.query('ROLLBACK'); return null; }
      let accepted = 0;
      for (const e of batch.events) {
        const result = await client.query('INSERT INTO events (project_id,event_id,session_id,version,type,occurred_at,payload) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (project_id,event_id) DO NOTHING', [batch.projectId,e.eventId,e.sessionId,e.version,e.type,e.occurredAt,JSON.stringify(e)]);
        accepted += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      return { accepted, duplicates: batch.events.length - accepted };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } };
}
