import Fastify from 'fastify';
import { collectionSchema, validBatch, type CollectionBatch, type HealthResponse } from '@site-analytics/contracts';
import type { CollectionStore } from './collection.js';
export function createApp(store?: CollectionStore) {
  const app = Fastify({ bodyLimit: 65536, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok', service: 'site-analytics', collectionEnabled: !!store }));
  if (store) {
    app.options('/api/collect', async (request, reply) => {
      // Preflight exposes no data. Actual collection checks the project's exact origin.
      const origin = request.headers.origin;
      if (!validOrigin(origin)) return reply.code(403).send({ error: 'Origin required' });
      return reply.header('Vary', 'Origin').header('Access-Control-Allow-Origin', origin).header('Access-Control-Allow-Methods', 'POST').header('Access-Control-Allow-Headers', 'Content-Type').code(204).send();
    });
    app.post<{ Body: CollectionBatch }>('/api/collect', { schema: { body: collectionSchema } }, async (request, reply) => {
      const origin = request.headers.origin;
      if (!validOrigin(origin)) return reply.code(403).send({ error: 'Origin required' });
      if (!validBatch(request.body)) return reply.code(400).send({ error: 'Invalid event bounds' });
      try {
        const result = await store.collect(request.body, origin);
        if (!result) return reply.code(403).send({ error: 'Collection not permitted' });
        return reply.header('Vary', 'Origin').header('Access-Control-Allow-Origin', origin).code(202).send(result);
      } catch {
        // Do not return database details or log event payloads.
        return reply.code(503).send({ error: 'Collection unavailable' });
      }
    });
  }
  return app;
}
function validOrigin(origin: string | undefined): origin is string {
  if (!origin) return false;
  try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && url.origin === origin; } catch { return false; }
}
