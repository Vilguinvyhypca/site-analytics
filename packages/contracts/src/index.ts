export * from './events.js';
export const schemaVersion = 1;

export interface HealthResponse {
  status: 'ok';
  service: 'site-analytics';
  collectionEnabled: false;
}

export interface ReadinessResponse {
  status: 'ready' | 'unavailable';
  database: 'ready' | 'unavailable';
}
