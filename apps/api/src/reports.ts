import type { Pool } from 'pg';
import type { TrafficReport, TrafficReportQuery } from '@site-analytics/contracts';

export function parseReportQuery(input: Record<string, unknown>): TrafficReportQuery | null {
  if (Object.keys(input).some(key => !['projectId', 'startDate', 'endDate', 'timeZone'].includes(key))) return null;
  const { projectId, startDate, endDate } = input;
  if (typeof projectId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) return null;
  const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '2000-01-01' && value <= '9998-12-31' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!date(startDate) || !date(endDate)) return null;
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
  if (days < 1 || days > 366) return null;
  const zone = input.timeZone ?? 'America/New_York';
  if (typeof zone !== 'string' || zone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(zone)) return null;
  try {
    const timeZone = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
    return { projectId, startDate, endDate, timeZone };
  } catch { return null; }
}

// One statement gives every metric the same PostgreSQL snapshot. Calendar-day
// arithmetic happens before conversion to UTC, so DST days need not be 24 hours.
export async function trafficReport(pool: Pool, query: TrafficReportQuery): Promise<TrafficReport | null> {
  const result = await pool.query<{ report: TrafficReport }>(`
    WITH bounds AS (
      SELECT $2::date::timestamp AT TIME ZONE $4 AS start_at,
        ($3::date + 1)::timestamp AT TIME ZONE $4 AS end_at
    ), selected AS MATERIALIZED (
      SELECT session_id, occurred_at, received_at, payload->>'path' AS path,
        nullif(payload->>'referrerHost', '') AS referrer_host
      FROM events, bounds
      WHERE project_id=$1 AND type='page_view' AND occurred_at >= start_at AND occurred_at < end_at
    ), daily AS (
      SELECT (occurred_at AT TIME ZONE $4)::date AS day, count(*) AS views, count(DISTINCT session_id) AS sessions
      FROM selected GROUP BY 1
    ), pages AS (
      SELECT path, count(*) AS views, count(DISTINCT session_id) AS sessions FROM selected GROUP BY path
    ), referrers AS (
      SELECT referrer_host, count(*) AS views, count(DISTINCT session_id) AS sessions FROM selected GROUP BY referrer_host
    )
    SELECT jsonb_build_object(
      'projectId', $1::text, 'startDate', $2::text, 'endDate', $3::text, 'timeZone', $4::text,
      'startAt', bounds.start_at, 'endAtExclusive', bounds.end_at,
      'generatedAt', statement_timestamp(), 'latestReceivedAt', (SELECT max(received_at) FROM selected),
      'totals', (SELECT jsonb_build_object('pageViews', count(*), 'sessions', count(DISTINCT session_id)) FROM selected),
      'daily', (SELECT jsonb_agg(jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'),
        'pageViews', coalesce(daily.views, 0), 'sessions', coalesce(daily.sessions, 0)) ORDER BY d.day)
        FROM (SELECT $2::date + n AS day FROM generate_series(0, $3::date - $2::date) n) d LEFT JOIN daily USING(day)),
      'pages', coalesce((SELECT jsonb_agg(jsonb_build_object('path', path, 'pageViews', views, 'sessions', sessions) ORDER BY views DESC, path COLLATE "C")
        FROM (SELECT * FROM pages ORDER BY views DESC, path COLLATE "C" LIMIT 100) p), '[]'::jsonb),
      'pageGroups', (SELECT count(*) FROM pages),
      'referrers', coalesce((SELECT jsonb_agg(jsonb_build_object('host', referrer_host, 'label', coalesce(referrer_host, 'Unknown'), 'pageViews', views, 'sessions', sessions) ORDER BY views DESC, referrer_host COLLATE "C" NULLS LAST)
        FROM (SELECT * FROM referrers ORDER BY views DESC, referrer_host COLLATE "C" NULLS LAST LIMIT 100) r), '[]'::jsonb),
      'referrerGroups', (SELECT count(*) FROM referrers), 'groupLimit', 100
    ) AS report FROM bounds WHERE EXISTS (SELECT 1 FROM projects WHERE id=$1)
  `, [query.projectId, query.startDate, query.endDate, query.timeZone]);
  return result.rows[0]?.report ?? null;
}
