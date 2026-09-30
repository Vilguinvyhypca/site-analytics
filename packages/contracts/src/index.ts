/** Shared status contract. Event validation and ingestion are Day 3 work. */
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
