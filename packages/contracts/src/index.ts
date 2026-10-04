export const CONTRACT_VERSION = 1 as const;
export interface HealthResponse { status: 'ok'; service: 'site-analytics'; collectionEnabled: boolean }
export interface EventEnvelope { version: 1; eventId: string; projectId: string; sessionId: string; occurredAt: string }
export interface PageView extends EventEnvelope { type: 'page_view'; path: string; referrerHost?: string }
export interface ContentEvent extends EventEnvelope { type: 'content_open' | 'content_impression'; contentId: string; contentType: 'photo' | 'video' }
export interface PlaybackStart extends EventEnvelope { type: 'playback_start'; contentId: string; playbackId: string; autoplay: boolean }
export interface PlaybackProgress extends EventEnvelope {
  type: 'playback_progress'; contentId: string; playbackId: string; sequence: number;
  engagedSeconds: number; durationSeconds: number | null;
  coveredIntervals: [number, number][]; ended: boolean;
}
export interface ShareEvent extends EventEnvelope { type: 'share'; contentId: string; outcome: 'clicked' | 'copied' | 'handoff' | 'cancelled' | 'failed' }
export type AnalyticsEvent = PageView | ContentEvent | PlaybackStart | PlaybackProgress | ShareEvent;
export interface CollectionBatch { version: 1; projectId: string; events: AnalyticsEvent[] }
export interface CollectionResponse { accepted: number; duplicates: number }
export interface TrackerOptions {
  projectId: string; collectionUrl: string;
  /** Return a sanitized public path, or null to exclude the page. */
  publicPath: (url: URL) => string | null;
}

const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9_-]+$' };
const uuid = { type: 'string', format: 'uuid' };
const seconds = { type: 'number', minimum: 0, maximum: 86400 };
const base = { version: { const: 1 }, eventId: uuid, projectId: id, sessionId: uuid, occurredAt: { type: 'string', format: 'date-time', maxLength: 40 } };
function event(type: string, properties: Record<string, unknown>, required: string[] = Object.keys(properties)) {
  return { type: 'object', additionalProperties: false, required: [...Object.keys(base), 'type', ...required], properties: { ...base, type: { const: type }, ...properties } };
}
export const collectionSchema = {
  type: 'object', additionalProperties: false, required: ['version', 'projectId', 'events'],
  properties: { version: { const: 1 }, projectId: id, events: { type: 'array', minItems: 1, maxItems: 50, items: { oneOf: [
    event('page_view', { path: { type: 'string', maxLength: 1024, pattern: '^/(?!/)[^?#\\\\\\u0000-\\u0020]*$' }, referrerHost: { type: 'string', maxLength: 253, pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)*$' } }, ['path']),
    ...['content_open', 'content_impression'].map(type => event(type, { contentId: id, contentType: { enum: ['photo', 'video'] } })),
    event('playback_start', { contentId: id, playbackId: uuid, autoplay: { type: 'boolean' } }),
    event('playback_progress', { contentId: id, playbackId: uuid, sequence: { type: 'integer', minimum: 1, maximum: 2147483647 }, engagedSeconds: seconds, durationSeconds: { ...seconds, type: ['number', 'null'], exclusiveMinimum: 0 }, coveredIntervals: { type: 'array', maxItems: 100, items: { type: 'array', minItems: 2, maxItems: 2, items: seconds } }, ended: { type: 'boolean' } }),
    event('share', { contentId: id, outcome: { enum: ['clicked', 'copied', 'handoff', 'cancelled', 'failed'] } })
  ] } } }
};
/** Structural validation runs first. A rejected event rejects the entire batch. */
export function validBatch(batch: CollectionBatch, now = Date.now()): boolean {
  return batch.events.every(e => {
    const time = Date.parse(e.occurredAt);
    if (e.projectId !== batch.projectId || !Number.isFinite(time) || time < now - 86400000 || time > now + 300000) return false;
    if (e.type !== 'playback_progress') return true;
    if (e.durationSeconds === null && (e.coveredIntervals.length > 0 || e.ended)) return false;
    let previous = -1;
    return e.coveredIntervals.every(([start, end]) => {
      const valid = start >= previous && end > start && end <= (e.durationSeconds ?? 0);
      previous = end;
      return valid;
    });
  });
}
