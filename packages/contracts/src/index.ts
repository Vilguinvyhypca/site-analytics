/** Design baseline; runtime collection validation is added in Day 3. */
export const CONTRACT_VERSION = 1 as const;
export interface HealthResponse { status: 'ok'; service: 'site-analytics'; collectionEnabled: false }
export interface EventEnvelope { version: 1; eventId: string; projectId: string; sessionId: string; occurredAt: string }
export interface PlaybackProgress extends EventEnvelope {
  type: 'playback_progress'; contentId: string; playbackId: string; sequence: number;
  engagedSeconds: number; durationSeconds: number | null;
  coveredIntervals: [number, number][]; ended: boolean;
}
export interface TrackerOptions { projectId: string; collectionUrl: string }
