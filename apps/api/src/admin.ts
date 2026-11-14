import type { FastifyInstance, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminStore, ProjectInput } from './admin-store.js';
import { validUuid, parseTimelineCursor } from './engagement.js';
import { parseReportQuery } from './reports.js';
export interface AdminConfig { store: AdminStore; origin: string; secret: string }
export const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function validOrigin(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && url.origin === value; } catch { return false; }
}
const projectBody = {
  type: 'object', additionalProperties: false, required: ['id', 'name', 'allowedOrigins', 'collectionEnabled'],
  properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' }, name: { type: 'string', minLength: 1, maxLength: 120 },
    allowedOrigins: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: { type: 'string', maxLength: 2048 } }, collectionEnabled: { type: 'boolean' } }
};
export async function registerAdmin(app: FastifyInstance, config: AdminConfig) {
  if (!validOrigin(config.origin) || config.secret.length < 32) throw new Error('ADMIN_ORIGIN and a 32+ character AUTH_SECRET are required');
  const secure = new URL(config.origin).protocol === 'https:';
  if (!secure && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(config.origin).hostname)) throw new Error('Remote administration requires HTTPS');
  const sessionCookie = secure ? '__Host-analytics-owner' : 'analytics-owner';
  const csrfCookie = secure ? '__Host-analytics-csrf' : 'analytics-csrf';
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'strict' as const, secure };
  await app.register(cookie, { secret: config.secret });
  await app.register(csrf, { cookieKey: csrfCookie, cookieOpts: { ...cookieOptions, signed: true },
    csrfOpts: { hmacKey: config.secret, userInfo: true }, getUserInfo: req => req.cookies[sessionCookie] || 'anonymous',
    getToken: req => typeof req.headers['x-csrf-token'] === 'string' ? req.headers['x-csrf-token'] : undefined });
  await app.register(rateLimit, { global: false });
  const dummy = await hash(randomBytes(32));
  const token = (request: FastifyRequest) => request.cookies[sessionCookie] ?? '';
  const authenticated = async (request: FastifyRequest) => /^[a-f0-9]{64}$/.test(token(request)) && config.store.hasSession(sessionHash(token(request)));
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== config.origin) return reply.code(403).send({ error: 'Origin not allowed' });
  });
  app.setErrorHandler((error, _request, reply) => {
    const status = typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 503;
    const code = status >= 400 && status < 500 ? status : 503;
    reply.code(code).send({ error: code === 503 ? 'Administration unavailable' : code === 429 ? 'Too many attempts. Try again later.' : 'Request rejected' });
  });
  app.get('/api/auth/session', async (request, reply) => ({ authenticated: !!(await authenticated(request)), csrfToken: reply.generateCsrf({ userInfo: token(request) || 'anonymous' }) }));
  app.post<{ Body: { password: string } }>('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute', keyGenerator: () => 'owner-login' } },
    onRequest: app.csrfProtection,
    schema: { body: { type: 'object', additionalProperties: false, required: ['password'], properties: { password: { type: 'string', minLength: 1, maxLength: 1024 } } } }
  }, async (request, reply) => {
    const digest = await config.store.passwordHash();
    const correct = await verify(digest ?? dummy, request.body.password);
    if (!digest || !correct) return reply.code(401).send({ error: 'Invalid password' });
    const value = randomBytes(32).toString('hex');
    if (!await config.store.createSession(sessionHash(value), digest, sessionHash(token(request)))) return reply.code(401).send({ error: 'Invalid password' });
    return reply.setCookie(sessionCookie, value, { ...cookieOptions, maxAge: 43200 }).send({ authenticated: true });
  });
  app.post('/api/auth/logout', { onRequest: app.csrfProtection }, async (request, reply) => {
    await config.store.deleteSession(sessionHash(token(request)));
    return reply.clearCookie(sessionCookie, cookieOptions).clearCookie(csrfCookie, cookieOptions).code(204).send();
  });
  await app.register(async protectedApp => {
    protectedApp.addHook('onRequest', async (request, reply) => {
      if (!await authenticated(request)) return reply.code(401).send({ error: 'Owner login required' });
    });
    protectedApp.get('/api/admin/projects', async () => ({ projects: await config.store.projects() }));
    protectedApp.get<{ Params: { id: string } }>('/api/admin/projects/:id', async (request, reply) => {
      const project = await config.store.project(request.params.id);
      return project ?? reply.code(404).send({ error: 'Project not found' });
    });
    for (const method of ['POST', 'PUT'] as const) {
      protectedApp.route<{ Body: ProjectInput; Params: { id?: string } }>({ method, url: method === 'POST' ? '/api/admin/projects' : '/api/admin/projects/:id',
        onRequest: protectedApp.csrfProtection, schema: { body: projectBody },
        handler: async (request, reply) => {
          const p = request.body;
          if (!p.name.trim() || !p.allowedOrigins.every(validOrigin) || (method === 'PUT' && p.id !== request.params.id)) return reply.code(400).send({ error: 'Use a name, exact origins, and matching project ID' });
          const saved = await config.store.saveProject({ ...p, name: p.name.trim() }, method === 'POST');
          if (!saved) return reply.code(method === 'POST' ? 409 : 404).send({ error: method === 'POST' ? 'Project ID exists or limit reached' : 'Project not found' });
          return reply.code(method === 'POST' ? 201 : 200).send({ project: { ...p, name: p.name.trim() } });
        }
      });
    }
    protectedApp.delete<{ Params: { id: string }; Body: { confirm: string } }>('/api/admin/projects/:id', {
      onRequest: protectedApp.csrfProtection,
      schema: { body: { type:'object', additionalProperties:false, required:['confirm'], properties:{confirm:{type:'string',maxLength:128}} } }
    }, async (request,reply) => {
      if(request.body.confirm!==request.params.id) return reply.code(400).send({error:'Confirm deletion by sending the exact project ID'});
      if(!await config.store.deleteProject(request.params.id)) return reply.code(404).send({error:'Project not found'});
      return reply.code(204).send();
    });
    protectedApp.get<{ Querystring: Record<string, unknown> }>('/api/reports/overview', async (request, reply) => {
      const query = parseReportQuery(request.query);
      if (!query) return reply.code(400).send({ error: 'Provide projectId, valid startDate/endDate (maximum 366 days), and an optional IANA timeZone' });
      const report = await config.store.report(query);
      return report ?? reply.code(404).send({ error: 'Project not found' });
    });
    for (const kind of ['engagement', 'sessions', 'timeline'] as const) {
      protectedApp.get<{ Querystring: Record<string, unknown> }>(`/api/reports/${kind}`, async (request, reply) => {
        const { after, sessionId, cursor, ...filters } = request.query;
        const query = parseReportQuery(filters);
        const parsedCursor = cursor === undefined ? undefined : parseTimelineCursor(cursor);
        if (!query || (kind === 'timeline' ? (!validUuid(sessionId) || after !== undefined || parsedCursor === null)
          : (sessionId !== undefined || cursor !== undefined || (after !== undefined && !validUuid(after))))) {
          return reply.code(400).send({ error: 'Invalid report filters or pagination' });
        }
        const report = kind === 'engagement' ? await config.store.engagement(query, after as string | undefined)
          : kind === 'sessions' ? await config.store.sessions(query, after as string | undefined)
          : await config.store.timeline(query, sessionId as string, parsedCursor ?? undefined);
        return report ?? reply.code(404).send({ error: 'Project not found' });
      });
    }
    protectedApp.all('/api/reports/*', async (_request, reply) => reply.code(404).send({ error: 'Unknown report route' }));
    protectedApp.all('/api/admin/*', async (_request, reply) => reply.code(404).send({ error: 'Unknown administration route' }));
  });
}
