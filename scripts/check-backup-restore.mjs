// Isolated logical backup/restore rehearsal using synthetic project/event data only.
import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import pg from 'pg';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {startDatabase} from './database.mjs';import {migrate} from './migrate.mjs';import {trafficReport} from '../apps/api/src/reports.ts';
const dir=await mkdtemp(join(tmpdir(),'site-analytics-restore-'));let source,target,a,b;
const url=port=>`postgresql://analytics_dev:local-development-only@127.0.0.1:${port}/site_analytics_dev`;
try{
 source=await startDatabase(join(dir,'source'),55441);await migrate(url(55441));a=new pg.Pool({connectionString:url(55441)});
 await a.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('restore-pilot','Restore pilot',true,ARRAY['http://localhost:4300'])");
 for(let i=0;i<12;i++)await a.query("INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES('restore-pilot',gen_random_uuid(),gen_random_uuid(),1,'page_view',now()-($1*interval '1 hour'),jsonb_build_object('path',$2::text,'type','page_view'))",[i,`/sample/${i%3}`]);
 const before=await trafficReport(a,{projectId:'restore-pilot',startDate:new Date(Date.now()-86400000).toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10),timeZone:'UTC'});
 const file=join(dir,'logical-backup.json');
 const backup=spawnSync(process.execPath,['--import','tsx','scripts/backup-development.mjs',file],{encoding:'utf8',env:{...process.env,DATABASE_URL:url(55441)}});
 assert.equal(backup.status,0,backup.stderr);
 target=await startDatabase(join(dir,'target'),55442);await migrate(url(55442));b=new pg.Pool({connectionString:url(55442)});
 const restored=JSON.parse(await readFile(file,'utf8'));
 for(const p of restored.projects)await b.query('INSERT INTO projects(id,name,collection_enabled,allowed_origins,created_at) VALUES($1,$2,$3,$4,$5)',[p.id,p.name,p.collection_enabled,p.allowed_origins,p.created_at]);
 for(const e of restored.events)await b.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,received_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[e.project_id,e.event_id,e.session_id,e.version,e.type,e.occurred_at,e.received_at,e.payload]);
 const after=await trafficReport(b,{projectId:'restore-pilot',startDate:new Date(Date.now()-86400000).toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10),timeZone:'UTC'});
 const stable=report=>({daily:report.daily,pages:report.pages,totals:report.totals,referrers:report.referrers});
 assert.deepEqual(stable(after),stable(before));console.log(JSON.stringify({pass:true,syntheticEvents:restored.events.length,reportMatches:true,backupBytes:(await readFile(file)).byteLength,method:'logical JSON export/restore of projects and events into isolated PostgreSQL; not pg_dump/WAL/PITR'}));
}finally{await a?.end();await b?.end();await target?.stop();await source?.stop();await rm(dir,{recursive:true,force:true});}
