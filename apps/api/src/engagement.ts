import type { Pool } from 'pg';
import type { EngagementReport, TrafficReportQuery, SessionList, SessionTimeline } from '@site-analytics/contracts';
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const bounds = `SELECT $2::date::timestamp AT TIME ZONE $4 AS start_at, ($3::date+1)::timestamp AT TIME ZONE $4 AS end_at`;
const values = (q: TrafficReportQuery) => [q.projectId,q.startDate,q.endDate,q.timeZone];
// Playback cohorts use first observed activity in the selected dates; summaries
// retain all observed lifetime progress. Content/share actions use occurrence time.
export async function engagementReport(pool: Pool, q: TrafficReportQuery, after?: string): Promise<EngagementReport | null> {
  const r = await pool.query<{ report: EngagementReport }>(`WITH bounds AS (${bounds}),
    interactions AS MATERIALIZED (SELECT type,payload->>'path' AS path,coalesce(payload->>'name',payload->>'scopeId') AS name,
      (payload->>'milestone')::integer AS milestone,session_id FROM events,bounds
      WHERE project_id=$1 AND occurred_at>=start_at AND occurred_at<end_at AND type IN ('click','custom','scroll')),
    interaction_groups AS (SELECT type,name,path,milestone,count(*) AS events,count(DISTINCT session_id) AS sessions
      FROM interactions GROUP BY type,name,path,milestone),
    actions AS MATERIALIZED (SELECT * FROM events,bounds WHERE project_id=$1 AND occurred_at>=start_at AND occurred_at<end_at AND type IN ('content_open','content_impression','share')),
    plays AS MATERIALIZED (SELECT * FROM playback_summaries,bounds WHERE project_id=$1 AND first_observed_at>=start_at AND first_observed_at<end_at),
    ids AS (SELECT payload->>'contentId' AS id FROM actions UNION SELECT content_id FROM plays),
    content AS (SELECT id AS "contentId",
      (SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND type='content_open') AS opens,
      (SELECT count(*) FROM plays WHERE content_id=id AND started) AS starts,
      (SELECT count(*) FROM plays WHERE content_id=id) AS attempts,
      (SELECT coalesce(sum(engaged_seconds),0) FROM plays WHERE content_id=id) AS "engagedSeconds",
      (SELECT count(*) FROM plays WHERE content_id=id AND completed) AS completed,
      (SELECT count(*) FROM plays WHERE content_id=id AND started AND duration_seconds IS NOT NULL) AS "completionEligible",
      (SELECT count(*) FROM plays WHERE content_id=id AND coverage>=0.25) AS "coverage25",
      (SELECT count(*) FROM plays WHERE content_id=id AND coverage>=0.5) AS "coverage50",
      (SELECT count(*) FROM plays WHERE content_id=id AND coverage>=0.75) AS "coverage75",
      jsonb_build_object('clicked',(SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND payload->>'outcome'='clicked' AND type='share'),
        'copied',(SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND payload->>'outcome'='copied' AND type='share'),
        'handoff',(SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND payload->>'outcome'='handoff' AND type='share'),
        'cancelled',(SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND payload->>'outcome'='cancelled' AND type='share'),
        'failed',(SELECT count(*) FROM actions WHERE payload->>'contentId'=id AND payload->>'outcome'='failed' AND type='share')) AS shares
      FROM ids),
    page AS (SELECT * FROM plays WHERE ($5::text IS NULL OR playback_id>$5) ORDER BY playback_id LIMIT 51),
    shown AS (SELECT * FROM page ORDER BY playback_id LIMIT 50)
    SELECT jsonb_build_object('generatedAt',statement_timestamp(),
      'interactions',jsonb_build_object('totals',jsonb_build_object(
        'clicks',(SELECT count(*) FROM interactions WHERE type='click'),
        'custom',(SELECT count(*) FROM interactions WHERE type='custom'),
        'scroll',(SELECT count(*) FROM interactions WHERE type='scroll')),
        'groups',(SELECT count(*) FROM interaction_groups),
        'rows',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY events DESC,type,name COLLATE "C",path COLLATE "C",milestone NULLS FIRST)
          FROM (SELECT * FROM interaction_groups ORDER BY events DESC,type,name COLLATE "C",path COLLATE "C",milestone NULLS FIRST LIMIT 100)g),'[]'::jsonb)),
      'totals',jsonb_build_object('opens',(SELECT count(*) FROM actions WHERE type='content_open'),
        'attempts',(SELECT count(*) FROM plays),'starts',(SELECT count(*) FROM plays WHERE started),
        'engagedSeconds',(SELECT coalesce(sum(engaged_seconds),0) FROM plays),
        'completed',(SELECT count(*) FROM plays WHERE completed),
        'completionEligible',(SELECT count(*) FROM plays WHERE started AND duration_seconds IS NOT NULL)),
      'distribution',jsonb_build_object('zero',(SELECT count(*) FROM plays WHERE engaged_seconds=0),
        'under10',(SELECT count(*) FROM plays WHERE engaged_seconds>0 AND engaged_seconds<10),
        'under60',(SELECT count(*) FROM plays WHERE engaged_seconds>=10 AND engaged_seconds<60),
        'atLeast60',(SELECT count(*) FROM plays WHERE engaged_seconds>=60)),
      'contents',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY "engagedSeconds" DESC,"contentId" COLLATE "C") FROM (SELECT * FROM content ORDER BY "engagedSeconds" DESC,"contentId" COLLATE "C" LIMIT 100)c),'[]'::jsonb),
      'contentGroups',(SELECT count(*) FROM ids),
      'playbacks',coalesce((SELECT jsonb_agg(jsonb_build_object('playbackId',playback_id,'contentId',content_id,'sessionId',session_id,
        'firstObservedAt',first_observed_at,'lastObservedAt',last_observed_at,'started',started,'engagedSeconds',engaged_seconds,
        'durationSeconds',duration_seconds,'coverage',coverage,'completed',completed,'ended',ended,'sequence',sequence) ORDER BY playback_id) FROM shown),'[]'::jsonb),
      'nextPlayback',CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT max(playback_id) FROM shown) ELSE NULL END
    ) AS report WHERE EXISTS(SELECT 1 FROM projects WHERE id=$1)`, [...values(q),after??null]);
  return r.rows[0]?.report ?? null;
}
export async function sessionList(pool: Pool, q: TrafficReportQuery, after?: string): Promise<SessionList | null> {
  const r = await pool.query<{report: SessionList}>(`WITH bounds AS (${bounds}),
    page AS (SELECT session_id,min(occurred_at) AS first_at,max(occurred_at) AS last_at,count(*) AS events
      FROM events,bounds WHERE project_id=$1 AND occurred_at>=start_at AND occurred_at<end_at
      AND ($5::uuid IS NULL OR session_id>$5) GROUP BY session_id ORDER BY session_id LIMIT 51),
    shown AS (SELECT * FROM page ORDER BY session_id LIMIT 50)
    SELECT jsonb_build_object('sessions',coalesce((SELECT jsonb_agg(jsonb_build_object('sessionId',session_id,'firstAt',first_at,'lastAt',last_at,'events',events) ORDER BY session_id) FROM shown),'[]'::jsonb),
      'nextSession',CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT session_id::text FROM shown ORDER BY session_id DESC LIMIT 1) ELSE NULL END)
    AS report WHERE EXISTS(SELECT 1 FROM projects WHERE id=$1)`,[...values(q),after??null]);
  return r.rows[0]?.report??null;
}
export interface TimelineCursor { at: string; id: string }
export function parseTimelineCursor(value: unknown): TimelineCursor | null {
  if (typeof value !== 'string' || value.length>300 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const c = JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if (!c || Object.keys(c).sort().join(',')!=='at,id' || !validUuid(c.id) || typeof c.at!=='string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5]):[0-5]\d)$/.test(c.at) || !Number.isFinite(Date.parse(c.at))) return null;
    const day = c.at.slice(0,10);
    if (!Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day) return null;
    return c;
  } catch { return null; }
}
export async function sessionTimeline(pool: Pool, q: TrafficReportQuery, sessionId: string, cursor?: TimelineCursor): Promise<SessionTimeline | null> {
  const r = await pool.query<{report: SessionTimeline}>(`WITH bounds AS (${bounds}),
    page AS (SELECT * FROM events,bounds WHERE project_id=$1 AND session_id=$5
      AND occurred_at>=start_at AND occurred_at<end_at AND ($6::timestamptz IS NULL OR (occurred_at,event_id)>($6::timestamptz,$7::uuid))
      ORDER BY occurred_at,event_id LIMIT 51), shown AS (SELECT * FROM page ORDER BY occurred_at,event_id LIMIT 50)
    SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg(jsonb_build_object('eventId',event_id,'occurredAt',occurred_at,'type',type,
      'name',payload->>'name','scopeId',payload->>'scopeId','milestone',payload->'milestone',
      'contentId',payload->>'contentId','path',payload->>'path','outcome',payload->>'outcome','playbackId',payload->>'playbackId',
      'sequence',payload->'sequence','engagedSeconds',payload->'engagedSeconds') ORDER BY occurred_at,event_id) FROM shown),'[]'::jsonb),
      'next',CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT jsonb_build_object('at',occurred_at,'id',event_id) FROM shown ORDER BY occurred_at DESC,event_id DESC LIMIT 1) ELSE NULL END)
      AS report WHERE EXISTS(SELECT 1 FROM projects WHERE id=$1)`,[...values(q),sessionId,cursor?.at??null,cursor?.id??null]);
  if (!r.rows[0]) return null;
  const report = r.rows[0].report as unknown as { events: SessionTimeline['events']; next: TimelineCursor|null };
  return { events:report.events, nextCursor:report.next?Buffer.from(JSON.stringify(report.next)).toString('base64url'):null };
}
