import type { Pool } from 'pg';

/** Delete a bounded page of expired raw events; callers schedule repeated runs. */
export async function deleteExpiredEvents(pool: Pool, retentionDays = 30, batchSize = 5000) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new RangeError('retentionDays must be between 1 and 3650');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50000) throw new RangeError('batchSize must be between 1 and 50000');
  const result = await pool.query(`WITH expired AS (
    SELECT ctid FROM events WHERE received_at < now() - ($1 * interval '1 day')
    ORDER BY received_at LIMIT $2
  ) DELETE FROM events e USING expired WHERE e.ctid=expired.ctid`, [retentionDays, batchSize]);
  return result.rowCount ?? 0;
}
