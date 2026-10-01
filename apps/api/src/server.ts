import { createApp } from './app.js';
const app = createApp();
const port = Number(process.env.API_PORT ?? 3100);
await app.listen({ port, host: '127.0.0.1' });
console.log(`Site Analytics API: http://127.0.0.1:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
