-- Read through stored events: no separate mutable totals to drift or backfill.
CREATE INDEX events_playback_lookup ON events(project_id, (payload->>'playbackId'))
  WHERE type IN ('playback_start','playback_progress');
CREATE VIEW playback_summaries AS
WITH identity AS (
  SELECT DISTINCT ON (project_id, payload->>'playbackId')
    project_id, payload->>'playbackId' AS playback_id,
    session_id, payload->>'contentId' AS content_id
  FROM events WHERE type IN ('playback_start','playback_progress')
  ORDER BY project_id, payload->>'playbackId', received_at, event_id
), matching AS (
  SELECT e.*, i.playback_id, i.content_id
  FROM identity i JOIN events e ON e.project_id=i.project_id
    AND e.payload->>'playbackId'=i.playback_id AND e.session_id=i.session_id
    AND e.payload->>'contentId'=i.content_id
  WHERE e.type IN ('playback_start','playback_progress')
), latest AS (
  SELECT DISTINCT ON (project_id, playback_id) project_id, playback_id, payload
  FROM matching WHERE type='playback_progress'
  ORDER BY project_id, playback_id, (payload->>'sequence')::integer DESC, received_at, event_id
), facts AS (
  SELECT project_id, playback_id, session_id, content_id,
    min(occurred_at) AS first_observed_at, max(occurred_at) AS last_observed_at,
    max(received_at) AS latest_received_at, bool_or(type='playback_start') AS started,
    min(occurred_at) FILTER (WHERE type='playback_start') AS started_at,
    bool_or((payload->>'autoplay')::boolean) FILTER (WHERE type='playback_start') AS autoplay
  FROM matching GROUP BY project_id,playback_id,session_id,content_id
), summary AS (
  SELECT f.*, coalesce((l.payload->>'sequence')::integer,0) AS sequence,
    coalesce((l.payload->>'engagedSeconds')::double precision,0) AS engaged_seconds,
    (l.payload->>'durationSeconds')::double precision AS duration_seconds,
    coalesce(l.payload->'coveredIntervals','[]'::jsonb) AS covered_intervals,
    coalesce((l.payload->>'ended')::boolean,false) AS ended,
    coalesce((SELECT sum((segment->>1)::double precision-(segment->>0)::double precision)
      FROM jsonb_array_elements(l.payload->'coveredIntervals') segment),0) AS covered_seconds
  FROM facts f LEFT JOIN latest l USING(project_id,playback_id)
)
SELECT *, CASE WHEN duration_seconds > 0 THEN least(1,covered_seconds/duration_seconds) ELSE NULL END AS coverage,
  (started AND ended AND coalesce(covered_seconds/duration_seconds >= 0.95,false)) AS completed
FROM summary;
