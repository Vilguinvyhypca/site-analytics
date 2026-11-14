import { extname, relative, resolve, sep } from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

export function registerDashboard(app: FastifyInstance, directory: string) {
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return reply.code(404).send({ error: 'Not found' });
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { return reply.code(400).send({ error: 'Invalid path' }); }
    if (pathname === '/api' || pathname.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });

    const root = await realpath(directory).catch(() => null);
    if (!root) return reply.code(503).send({ error: 'Dashboard assets unavailable' });
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (requested.includes('\\') || requested.includes('\0')) return reply.code(400).send({ error: 'Invalid path' });
    let file = resolve(root, requested);
    const rel = relative(root, file);
    if (rel === '..' || rel.startsWith(`..${sep}`) || rel.startsWith(sep)) return reply.code(400).send({ error: 'Invalid path' });

    let actual = await realpath(file).catch(() => null);
    if (actual) {
      const actualRel = relative(root, actual);
      if (actualRel === '..' || actualRel.startsWith(`..${sep}`) || actualRel.startsWith(sep)) return reply.code(404).send({ error: 'Not found' });
      file = actual;
    } else {
      if (extname(requested)) return reply.code(404).send({ error: 'Not found' });
      file = resolve(root, 'index.html');
      actual = await realpath(file).catch(() => null);
      if (!actual || !actual.startsWith(`${root}${sep}`)) return reply.code(503).send({ error: 'Dashboard assets unavailable' });
      file = actual;
    }

    try {
      const body = await readFile(file);
      const type = contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream';
      return reply.type(type)
        .header('Cache-Control', extname(file).toLowerCase() === '.html' ? 'no-cache' : 'public, max-age=300')
        .header('X-Content-Type-Options', 'nosniff')
        .send(body);
    } catch { return reply.code(404).send({ error: 'Not found' }); }
  });
}
