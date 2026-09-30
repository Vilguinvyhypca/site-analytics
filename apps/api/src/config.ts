export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.API_PORT ?? '4100');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1024 and 65535.');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required; copy .env.example to .env for local development.');
  const database = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  return { port, databaseUrl: env.DATABASE_URL };
}
