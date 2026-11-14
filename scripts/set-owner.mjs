import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { pathToFileURL } from 'node:url';
/** Provision/recover exactly one owner and revoke all sessions atomically. */
export async function setOwner(pool, password) {
  if (password.length < 16 || password.length > 1024) throw new Error('Use an owner password of 16–1024 characters');
  const digest = await hash(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO owner_account(singleton,password_hash) VALUES (true,$1) ON CONFLICT(singleton) DO UPDATE SET password_hash=$1, updated_at=now()', [digest]);
    await client.query('DELETE FROM owner_sessions');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the intended analytics database and migrate first');
  if (process.stdin.isTTY) throw new Error('Read the password privately and pipe it to stdin; see docs/OWNER_ACCESS.md');
  let password = '';
  for await (const chunk of process.stdin) {
    password += chunk.toString();
    if (password.length > 1026) throw new Error('Password input is too long');
  }
  password = password.replace(/\r?\n$/, '');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try { await setOwner(pool, password); console.log('Owner password set. All previous owner sessions revoked.'); }
  finally { password = ''; await pool.end(); }
}
