import Fastify from 'fastify';
import type { HealthResponse, ReadinessResponse } from '@site-analytics/contracts';

export function createApp(checkDatabase: () => Promise<void>, logger = false) {
  const app = Fastify({ logger, bodyLimit: 16_384, requestTimeout: 5_000 });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok', service: 'site-analytics', collectionEnabled: false,
  }));
  app.get('/ready', async (_request, reply): Promise<ReadinessResponse> => {
    try {
      await checkDatabase();
      return { status: 'ready', database: 'ready' };
    } catch {
      reply.code(503);
      return { status: 'unavailable', database: 'unavailable' };
    }
  });
  // No ingestion or reporting routes exist before their planned validation/auth work.
  return app;
}
