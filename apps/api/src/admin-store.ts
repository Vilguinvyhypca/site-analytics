import type { Pool } from 'pg';
import type { TrafficReport, TrafficReportQuery, EngagementReport, SessionList, SessionTimeline } from '@site-analytics/contracts';
import { engagementReport, sessionList, sessionTimeline, type TimelineCursor } from './engagement.js';
import { trafficReport } from './reports.js';
import type { ProjectConfiguration as ProjectInput } from '@site-analytics/contracts';
export type { ProjectConfiguration as ProjectInput } from '@site-analytics/contracts';
export interface AdminStore {
  engagement(query: TrafficReportQuery, after?: string): Promise<EngagementReport | null>;
  sessions(query: TrafficReportQuery, after?: string): Promise<SessionList | null>;
  timeline(query: TrafficReportQuery, sessionId: string, cursor?: TimelineCursor): Promise<SessionTimeline | null>;
  report(query: TrafficReportQuery): Promise<TrafficReport | null>;
  passwordHash(): Promise<string | null>;
  createSession(tokenHash: string, passwordHash: string, previousHash?: string): Promise<boolean>;
  hasSession(tokenHash: string): Promise<boolean>;
  deleteSession(tokenHash: string): Promise<void>;
  projects(): Promise<ProjectInput[]>;
  project(id: string): Promise<ProjectInput | null>;
  saveProject(project: ProjectInput, create: boolean): Promise<boolean>;
  deleteProject(id: string): Promise<boolean>;
}
const columns = 'id, name, allowed_origins AS "allowedOrigins", collection_enabled AS "collectionEnabled"';
export function postgresAdminStore(pool: Pool): AdminStore {
  return {
    engagement: (query, after) => engagementReport(pool, query, after),
    sessions: (query, after) => sessionList(pool, query, after),
    timeline: (query, sessionId, cursor) => sessionTimeline(pool, query, sessionId, cursor),
    report: query => trafficReport(pool, query),
    async passwordHash() { return (await pool.query('SELECT password_hash FROM owner_account WHERE singleton')).rows[0]?.password_hash ?? null; },
    async createSession(tokenHash, passwordHash, previousHash) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize login with password recovery; a stale hash cannot create a new session.
        const owner = await client.query('SELECT singleton FROM owner_account WHERE singleton AND password_hash=$1 FOR SHARE', [passwordHash]);
        if (!owner.rowCount) { await client.query('ROLLBACK'); return false; }
        await client.query('DELETE FROM owner_sessions WHERE expires_at <= now() OR token_hash=$1', [previousHash ?? '']);
        await client.query("INSERT INTO owner_sessions(token_hash, expires_at) VALUES ($1, now() + interval '12 hours')", [tokenHash]);
        await client.query('COMMIT'); return true;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async hasSession(tokenHash) { return !!(await pool.query('SELECT 1 FROM owner_sessions WHERE token_hash=$1 AND expires_at > now()', [tokenHash])).rowCount; },
    async deleteSession(tokenHash) { await pool.query('DELETE FROM owner_sessions WHERE token_hash=$1', [tokenHash]); },
    async projects() { return (await pool.query<ProjectInput>(`SELECT ${columns} FROM projects ORDER BY created_at, id LIMIT 101`)).rows; },
    async project(id) { return (await pool.query<ProjectInput>(`SELECT ${columns} FROM projects WHERE id=$1`, [id])).rows[0] ?? null; },
    async saveProject(project, create) {
      const values = [project.id, project.name, project.allowedOrigins, project.collectionEnabled];
      if (!create) return !!(await pool.query('UPDATE projects SET name=$2, allowed_origins=$3, collection_enabled=$4 WHERE id=$1', values)).rowCount;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(724019322)');
        const count = (await client.query('SELECT count(*)::int AS count FROM projects')).rows[0].count;
        if (count >= 100) { await client.query('ROLLBACK'); return false; }
        const result = await client.query('INSERT INTO projects(id,name,allowed_origins,collection_enabled) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', values);
        await client.query('COMMIT'); return !!result.rowCount;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async deleteProject(id) {
      const client=await pool.connect();
      try { await client.query('BEGIN'); await client.query('DELETE FROM events WHERE project_id=$1',[id]);
        const result=await client.query('DELETE FROM projects WHERE id=$1',[id]); await client.query('COMMIT'); return !!result.rowCount;
      } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  };
}
