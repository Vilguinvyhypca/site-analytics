// Development-only logical export. This is not a physical PostgreSQL backup.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import pg from 'pg';
import {migrate} from './migrate.mjs';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('Set DATABASE_URL for the development database');
const target=new URL(connectionString);
if(!['127.0.0.1','localhost','::1'].includes(target.hostname))throw new Error('Development backup refuses non-local database hosts');
const output=resolve(process.argv[2]??`site-analytics-${new Date().toISOString().replaceAll(':','-')}.json`);
const pool=new pg.Pool({connectionString,max:1});
try{
 await migrate(connectionString);
 const client=await pool.connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const snapshot={format:'site-analytics-logical-v1',createdAt:new Date().toISOString(),
   projects:(await client.query('SELECT * FROM projects ORDER BY id')).rows,
   events:(await client.query('SELECT * FROM events ORDER BY project_id,event_id')).rows,
   ownerAccount:(await client.query('SELECT * FROM owner_account')).rows,
   ownerSessions:(await client.query('SELECT * FROM owner_sessions')).rows};
  await client.query('COMMIT');
  await writeFile(output,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});
  console.log(`Development logical backup written: ${output}; projects=${snapshot.projects.length}, events=${snapshot.events.length}`);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}finally{await pool.end();}
