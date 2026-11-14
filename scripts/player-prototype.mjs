// Local-only Day 5 harness. No collector or production configuration is loaded.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
const port = Number(process.env.PLAYER_TEST_PORT ?? 4301);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PLAYER_TEST_PORT');
const bundlePath = process.env.MUX_PLAYER_BUNDLE;
if (!bundlePath) throw new Error('Set MUX_PLAYER_BUNDLE to an installed @mux/mux-player/dist/mux-player.mjs');
const mux = await readFile(bundlePath);
console.log('Mux bundle SHA-256:', createHash('sha256').update(mux).digest('hex'));
await mkdir('artifacts', { recursive: true });
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30', '-t', '12', '-c:v', 'libvpx', '-threads', '2', '-b:v', '250k', '-an', 'artifacts/player-fixture.webm']);
const code = await build({ entryPoints: ['experiments/player/measurement.ts'], bundle: true, format: 'iife', globalName: 'PlayerPrototype', write: false });
const routes = new Map([
  ['/', ['text/html', await readFile('experiments/player/index.html')]],
  ['/prototype.js', ['text/javascript', code.outputFiles[0].contents]],
  ['/mux-player.mjs', ['text/javascript', mux]],
  ['/fixture.webm', ['video/webm', await readFile('artifacts/player-fixture.webm')]]
]);
const server = createServer((request, response) => {
  const entry = routes.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!entry) { response.writeHead(404).end(); return; }
  if (entry[0] === 'video/webm') {
    const size = entry[1].length;
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    response.writeHead(range ? 206 : 200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1, ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {})
    }).end(entry[1].subarray(start, end + 1));
    return;
  }
  response.writeHead(200, { 'Content-Type': entry[0], 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:" }).end(entry[1]);
});
server.listen(port, '127.0.0.1', () => console.log(`Player prototype ready: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
