import test from 'node:test';import assert from 'node:assert/strict';import pg from 'pg';
import {deleteExpiredEvents} from '../apps/api/src/retention.js';import {postgresAdminStore} from '../apps/api/src/admin-store.js';
test('retention removes only old rows and project deletion stays project-scoped', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 try{
  const index=(await pool.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='events_received_at'")).rows[0]?.indexdef;
  assert.match(index??'',/USING btree \(received_at\)/);
  await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('retention-a','A',true,ARRAY['http://localhost']),('retention-b','B',true,ARRAY['http://localhost'])");
  await pool.query("INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,received_at,payload) VALUES ('retention-a',gen_random_uuid(),gen_random_uuid(),1,'page_view',now()-interval '40 days',now()-interval '40 days','{}'),('retention-a',gen_random_uuid(),gen_random_uuid(),1,'page_view',now(),now(),'{}'),('retention-b',gen_random_uuid(),gen_random_uuid(),1,'page_view',now()-interval '40 days',now()-interval '40 days','{}')");
  assert.equal(await deleteExpiredEvents(pool,30,1),1);
  assert.equal(Number((await pool.query("SELECT count(*) FROM events WHERE project_id='retention-a'")).rows[0].count),1);
  assert.equal(Number((await pool.query("SELECT count(*) FROM events WHERE project_id='retention-b'")).rows[0].count),1);
  const store=postgresAdminStore(pool);assert.equal(await store.deleteProject('retention-a'),true);
  assert.equal(Number((await pool.query("SELECT count(*) FROM events WHERE project_id='retention-a'")).rows[0].count),0);
  assert.equal(Number((await pool.query("SELECT count(*) FROM events WHERE project_id='retention-b'")).rows[0].count),1);
 }finally{await pool.query("DELETE FROM events WHERE project_id IN ('retention-a','retention-b')");await pool.query("DELETE FROM projects WHERE id IN ('retention-a','retention-b')");await pool.end();}
});
