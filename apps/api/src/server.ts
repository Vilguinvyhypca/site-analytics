import pg from 'pg';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { postgresStore } from './collection.js';
import { postgresAdminStore } from './admin-store.js';
import { deleteExpiredEvents } from './retention.js';
const enabled = process.env.COLLECTION_ENABLED === 'true';
if (enabled && !process.env.DATABASE_URL) throw new Error('DATABASE_URL required when collection is enabled');
const adminEnabled = !!(process.env.AUTH_SECRET || process.env.ADMIN_ORIGIN);
if (adminEnabled && (!process.env.AUTH_SECRET || !process.env.ADMIN_ORIGIN || !process.env.DATABASE_URL)) throw new Error('Owner access requires DATABASE_URL, AUTH_SECRET and ADMIN_ORIGIN');
const pool = enabled || adminEnabled ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 }) : undefined;
const retentionDays=Number(process.env.RETENTION_DAYS??30);
if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>3650)throw new Error('RETENTION_DAYS must be an integer from 1 to 3650');
let retentionTimer: ReturnType<typeof setInterval> | undefined;
if(pool){retentionTimer=setInterval(()=>{void deleteExpiredEvents(pool,retentionDays).catch(()=>{});},86400000);retentionTimer.unref();}
const app = createApp(enabled && pool ? postgresStore(pool) : undefined, adminEnabled && pool ? {
  store: postgresAdminStore(pool), origin: process.env.ADMIN_ORIGIN!, secret: process.env.AUTH_SECRET!
} : undefined, {
  dashboardDirectory: process.env.DASHBOARD_DIR ? resolve(process.env.DASHBOARD_DIR) : undefined,
  databaseReady: pool ? async () => { await pool.query('SELECT 1'); } : undefined
});
if (pool) app.addHook('onClose', async () => { if(retentionTimer)clearInterval(retentionTimer); await pool.end(); });
const port = Number(process.env.API_PORT ?? 3100);
await app.listen({ port, host: '127.0.0.1' });
console.log(`Site Analytics API: http://127.0.0.1:${port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
