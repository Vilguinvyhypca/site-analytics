import Fastify from 'fastify';
import type { HealthResponse, ReadinessResponse } from '@site-analytics/contracts';
import { maxBatchBytes, parseBatch, validProjectId } from '@site-analytics/contracts';
import type { Collector } from './collection.js';

export function createApp(checkDatabase: () => Promise<void>, logger = false, collector?: Collector) {
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
  if (collector) {
    app.options<{ Params: { projectId: string } }>('/v1/collect/:projectId', async (request, reply) => {
      reply.header('Vary', 'Origin');
      const origin = request.headers.origin;
      if (!validProjectId(request.params.projectId) || !origin || request.headers['access-control-request-method'] !== 'POST') return reply.code(403).send({ error: 'Collection denied' });
      const headers = request.headers['access-control-request-headers'];
      if (headers && (typeof headers !== 'string' || headers.split(',').some((header) => header.trim().toLowerCase() !== 'content-type'))) return reply.code(403).send({ error: 'Collection denied' });
      try {
        if (!await collector.allowed(request.params.projectId, origin)) return reply.code(403).send({ error: 'Collection denied' });
        return reply.header('Access-Control-Allow-Origin', origin).header('Access-Control-Allow-Methods', 'POST').header('Access-Control-Allow-Headers', 'Content-Type').code(204).send();
      } catch { return reply.code(503).send({ error: 'Collection unavailable' }); }
    });
    app.post<{ Params: { projectId: string } }>('/v1/collect/:projectId', { bodyLimit: maxBatchBytes }, async (request, reply) => {
      reply.header('Vary', 'Origin');
      const batch = parseBatch(request.body);
      if (!batch || batch.projectId.toLowerCase() !== request.params.projectId.toLowerCase()) return reply.code(400).send({ error: 'Invalid event batch' });
      const origin = request.headers.origin;
      if (!origin) return reply.code(403).send({ error: 'Collection denied' });
      try {
        const inserted = await collector.save(batch, origin);
        if (inserted === null) return reply.code(403).send({ error: 'Collection denied' });
        return reply.header('Access-Control-Allow-Origin', origin).code(202).send({ accepted: inserted, duplicates: batch.events.length - inserted });
      } catch { return reply.code(503).send({ error: 'Collection unavailable' }); }
    });
  }
  return app;
}
