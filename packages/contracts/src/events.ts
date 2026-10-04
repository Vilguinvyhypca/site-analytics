/** Version 1 accepts bounded, intentionally small analytics records. */
export interface AnalyticsEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  name: string;
  path: string;
  properties: Record<string, string | number | boolean>;
}
export interface EventBatch { version: 1; projectId: string; events: AnalyticsEvent[] }
export const maxBatchBytes = 32_768;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasControl = (value: string) => [...value].some((character) => character.charCodeAt(0) < 32);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}
export function validProjectId(value: unknown): value is string {
  return typeof value === 'string' && uuid.test(value);
}
export function parseBatch(value: unknown, now = Date.now()): EventBatch | null {
  if (!record(value) || !keys(value, ['version', 'projectId', 'events']) || value.version !== 1 ||
      !validProjectId(value.projectId) || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 50) return null;
  for (const event of value.events) {
    if (!record(event) || !keys(event, ['id', 'sessionId', 'timestamp', 'name', 'path', 'properties']) ||
        !validProjectId(event.id) || !validProjectId(event.sessionId) ||
        typeof event.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp) ||
        typeof event.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(event.name) ||
        typeof event.path !== 'string' || event.path.length > 512 || !event.path.startsWith('/') ||
        /[?#\\\s%]/.test(event.path) || hasControl(event.path) || event.path.startsWith('//') ||
        !record(event.properties) || Object.keys(event.properties).length > 16) return null;
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== event.timestamp || timestamp < now - 86_400_000 || timestamp > now + 300_000) return null;
    for (const [key, property] of Object.entries(event.properties)) {
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !(typeof property === 'boolean' || (typeof property === 'number' && Number.isFinite(property)) ||
            (typeof property === 'string' && property.length <= 128 && !hasControl(property)))) return null;
    }
  }
  return value as unknown as EventBatch;
}
