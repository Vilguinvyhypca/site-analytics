import Fastify from 'fastify';
import type { HealthResponse } from '@site-analytics/contracts';
export function createApp() {
  const app = Fastify({ bodyLimit: 65536 });
  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok', service: 'site-analytics', collectionEnabled: false }));
  return app;
}
