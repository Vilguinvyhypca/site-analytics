// Synthetic local baseline only: five clients, ten 10-event batches each.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import pg from 'pg';import {startDatabase} from './database.mjs';import {migrate} from './migrate.mjs';import {createApp} from '../apps/api/src/app.ts';import {postgresStore} from '../apps/api/src/collection.ts';
const dir=await mkdtemp(join(tmpdir(),'site-analytics-pilot-load-'));let db,pool,app;
try{
 db=await startDatabase(join(dir,'pg'),55440);const url='postgresql://analytics_dev:local-development-only@127.0.0.1:55440/site_analytics_dev';await migrate(url);pool=new pg.Pool({connectionString:url,max:5});pool.on('error',()=>{});
 await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('pilot-load','Synthetic pilot',true,ARRAY['http://localhost:4300'])");
 app=createApp(postgresStore(pool));await app.listen({port:0,host:'127.0.0.1'});const base=`http://127.0.0.1:${app.server.address().port}`;
 const before=Number((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes),latencies=[],statuses=[];
 const client=async clientNo=>{for(let batchNo=0;batchNo<10;batchNo++){const events=Array.from({length:10},(_,i)=>({version:1,projectId:'pilot-load',eventId:randomUUID(),sessionId:randomUUID(),occurredAt:new Date().toISOString(),type:'page_view',path:`/synthetic/${clientNo}/${batchNo}/${i}`}));const t=performance.now();const res=await fetch(`${base}/api/collect`,{method:'POST',headers:{origin:'http://localhost:4300','content-type':'application/json'},body:JSON.stringify({version:1,projectId:'pilot-load',events})});latencies.push(performance.now()-t);statuses.push(res.status);await res.arrayBuffer();}};
 const began=performance.now();await Promise.all(Array.from({length:5},(_,i)=>client(i)));const elapsed=performance.now()-began;
 const after=Number((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes),rows=Number((await pool.query("SELECT count(*) FROM events WHERE project_id='pilot-load'")).rows[0].count);latencies.sort((a,b)=>a-b);
 const percentile=p=>Math.round(latencies[Math.ceil(p*latencies.length)-1]*100)/100;
 console.log(JSON.stringify({scenario:'5 clients x 10 batches x 10 events',requests:statuses.length,events:rows,statusCounts:Object.fromEntries([...new Set(statuses)].map(s=>[s,statuses.filter(x=>x===s).length])),elapsedMs:Math.round(elapsed),latencyMs:{median:percentile(.5),p95:percentile(.95),max:Math.round(latencies.at(-1)*100)/100},databaseSizeBeforeBytes:before,databaseSizeAfterBytes:after,databaseSizeGrowthBytes:after-before,scope:'single local Fastify process, temporary PostgreSQL, sequential per-client batches with five concurrent clients; no disk/WAL growth or production capacity claim'}));
 if(statuses.some(s=>s!==202)||rows!==500)process.exitCode=1;
}finally{await app?.close();await pool?.end();await db?.stop();await rm(dir,{recursive:true,force:true});}
