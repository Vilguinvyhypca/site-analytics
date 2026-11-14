import type { PoolClient } from 'pg';
import type { PlaybackProgress, PlaybackStart } from '@site-analytics/contracts';
export class PlaybackConflict extends Error {}
/** Called under a per-project/playback transaction lock, after the raw insert. */
export async function validatePlayback(client: PoolClient, event: PlaybackProgress | PlaybackStart) {
  const identity = await client.query(`SELECT 1 FROM events
    WHERE project_id=$1 AND payload->>'playbackId'=$2 AND type IN ('playback_start','playback_progress')
      AND event_id<>$3 AND (payload->>'contentId' IS DISTINCT FROM $4 OR session_id<>$5) LIMIT 1`,
  [event.projectId, event.playbackId, event.eventId, event.contentId, event.sessionId]);
  if (identity.rowCount) throw new PlaybackConflict('Playback identity conflict');
  // Compare in PostgreSQL instead of fetching every historical interval into Node.
  const conflict = event.type === 'playback_start'
    ? await client.query(`SELECT 1 FROM events WHERE project_id=$1 AND payload->>'playbackId'=$2
        AND type='playback_start' AND event_id<>$3 AND (payload->>'autoplay')::boolean IS DISTINCT FROM $4 LIMIT 1`,
      [event.projectId, event.playbackId, event.eventId, event.autoplay])
    : await client.query(`SELECT 1 FROM events WHERE project_id=$1 AND payload->>'playbackId'=$2
        AND type='playback_progress' AND event_id<>$3 AND (
          ((payload->>'sequence')::integer=$4 AND jsonb_build_array(payload->'engagedSeconds',payload->'durationSeconds',payload->'coveredIntervals',payload->'ended')<>$6::jsonb)
          OR ((payload->>'sequence')::integer<$4 AND (payload->>'engagedSeconds')::double precision>$5)
          OR ((payload->>'sequence')::integer>$4 AND (payload->>'engagedSeconds')::double precision<$5)
        ) LIMIT 1`, [event.projectId, event.playbackId, event.eventId, event.sequence, event.engagedSeconds,
      JSON.stringify([event.engagedSeconds, event.durationSeconds, event.coveredIntervals, event.ended])]);
  if (conflict.rowCount) throw new PlaybackConflict('Conflicting playback snapshot');
}
