import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1:4300').pathname;
  const tracker = path === '/tracker.js';
  if (!['/', '/one', '/two'].includes(path) && !tracker) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL(tracker ? '../packages/tracker/dist/tracker.js' : '../examples/static/index.html', import.meta.url));
    response.writeHead(200, { 'Content-Type': tracker ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(503).end('Build the tracker first: npm run build -w @site-analytics/tracker'); }
});
server.listen(4300, '127.0.0.1', () => console.log('Consent test site: http://127.0.0.1:4300'));
