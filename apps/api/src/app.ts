import { PlaybackConflict } from './playback.js';
import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { collectionSchema, validBatch, type CollectionBatch, type HealthResponse } from '@site-analytics/contracts';
import type { CollectionStore } from './collection.js';
import { registerAdmin, type AdminConfig } from './admin.js';
import { registerDashboard } from './dashboard.js';
export interface AppOptions { dashboardDirectory?: string; databaseReady?: () => Promise<void> }
export function createApp(store?: CollectionStore, admin?: AdminConfig, options: AppOptions = {}) {
  const app = Fastify({ bodyLimit: 65536, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
  const collectionWindows = new Map<string, { start: number; count: number }>();
  let activeCollections = 0;
  app.get('/api/tracker.js', async (_request, reply) => {
    try { return reply.type('application/javascript').header('Cache-Control', 'public, max-age=300').header('X-Content-Type-Options', 'nosniff').send(await readFile(new URL('../../../packages/tracker/dist/tracker.js', import.meta.url))); }
    catch { return reply.code(503).send({ error: 'Build the tracker before installing it' }); }
  });
  if (admin) app.register(async scope => registerAdmin(scope, admin));
  else app.get('/api/auth/session', async (_request, reply) => reply.header('Cache-Control', 'no-store').code(503).send({ error: 'Owner access is not configured. See docs/OWNER_ACCESS.md.' }));
  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok', service: 'site-analytics', collectionEnabled: !!store }));
  app.get('/api/ready', async (_request, reply) => {
    if (!options.databaseReady) return reply.code(503).send({ status: 'not_ready', service: 'site-analytics' });
    try { await options.databaseReady(); return { status: 'ready', service: 'site-analytics' }; }
    catch { return reply.code(503).send({ status: 'unavailable', service: 'site-analytics' }); }
  });
  if (options.dashboardDirectory) registerDashboard(app, options.dashboardDirectory);
  if (store) {
    app.options('/api/collect', async (request, reply) => {
      // Preflight exposes no data. Actual collection checks the project's exact origin.
      const origin = request.headers.origin;
      if (!validOrigin(origin)) return reply.code(403).send({ error: 'Origin required' });
      return reply.header('Vary', 'Origin').header('Access-Control-Allow-Origin', origin).header('Access-Control-Allow-Methods', 'POST').header('Access-Control-Allow-Headers', 'Content-Type').code(204).send();
    });
    app.post<{ Body: CollectionBatch }>('/api/collect', { schema: { body: collectionSchema }, preHandler: async (request, reply) => {
      const now = Date.now(), key = request.ip;
      let window = collectionWindows.get(key);
      if (!window || now - window.start >= 60000) {
        if (collectionWindows.size >= 10000) {
          for (const [ip, value] of collectionWindows) if (now - value.start >= 60000) collectionWindows.delete(ip);
          if (collectionWindows.size >= 10000) return reply.code(503).send({ error: 'Collector temporarily busy' });
        }
        window = { start: now, count: 0 }; collectionWindows.set(key, window);
      }
      if (window.count >= 120) return reply.header('Retry-After', String(Math.max(1, Math.ceil((60000 - (now - window.start)) / 1000)))).code(429).send({ error: 'Too many collection requests' });
      window.count++;
      if (activeCollections >= 5) return reply.header('Retry-After', '2').code(503).send({ error: 'Collector temporarily busy' });
      activeCollections++;
      reply.raw.once('close', () => { activeCollections = Math.max(0, activeCollections - 1); });
    } }, async (request, reply) => {
      const origin = request.headers.origin;
      if (!validOrigin(origin)) return reply.code(403).send({ error: 'Origin required' });
      if (!validBatch(request.body)) return reply.code(400).send({ error: 'Invalid event bounds' });
      try {
        const result = await store.collect(request.body, origin);
        if (!result) return reply.code(403).send({ error: 'Collection not permitted' });
        return reply.header('Vary', 'Origin').header('Access-Control-Allow-Origin', origin).code(202).send(result);
      } catch (error) {
        if (error instanceof PlaybackConflict) return reply.header('Vary', 'Origin').header('Access-Control-Allow-Origin', origin).code(409).send({ error: 'Conflicting playback update' });
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
