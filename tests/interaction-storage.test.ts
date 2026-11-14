import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { postgresStore } from '../apps/api/src/collection.js';
import { engagementReport, sessionTimeline } from '../apps/api/src/engagement.js';
import type { AnalyticsEvent, ScrollEvent } from '@site-analytics/contracts';
test('interaction storage rejects extra data, deduplicates scroll and reports project/date-scoped counts', {skip:!process.env.TEST_DATABASE_URL},async()=>{
  const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const app=createApp(postgresStore(pool));
  const sessionId=randomUUID(),viewId=randomUUID();const occurredAt=new Date().toISOString();
  const base={version:1 as const,projectId:'interaction-a',sessionId,occurredAt,eventId:randomUUID()};
  const scroll:ScrollEvent={...base,type:'scroll',scopeId:'feed',viewId,milestone:50,path:'/public'};
  const send=(events:unknown[],projectId='interaction-a')=>app.inject({method:'POST',url:'/api/collect',headers:{origin:'https://fixture.example'},payload:{version:1,projectId,events}});
  try{
    await pool.query("INSERT INTO projects(id,name,collection_enabled,allowed_origins) VALUES('interaction-a','A',true,ARRAY['https://fixture.example']),('interaction-b','B',true,ARRAY['https://fixture.example'])");
    const events:AnalyticsEvent[]=[scroll,{...base,eventId:randomUUID(),type:'click',name:'play',path:'/public'},{...base,eventId:randomUUID(),type:'custom',name:'filter',path:'/public'}];
    assert.equal((await send(events)).statusCode,202);assert.equal((await send(events)).json().duplicates,3);
    assert.equal((await send([{...scroll,eventId:randomUUID()}])).json().duplicates,1,'same threshold with a fresh event ID still deduplicates');
    assert.equal((await send([{...scroll,eventId:randomUUID(),viewId:randomUUID()}])).json().accepted,1,'new page view can reach the threshold again');
    for(const bad of [{...scroll,milestone:42},{...scroll,path:'/private?token=secret'},{...events[1],name:'private@example.com'},{...events[2],value:'typed text'},{...events[1],path:'/with space'}])assert.equal((await send([bad])).statusCode,400);
    assert.equal((await send([{...scroll,projectId:'interaction-b'}],'interaction-b')).statusCode,202);
    const day=occurredAt.slice(0,10),q={projectId:'interaction-a',startDate:day,endDate:day,timeZone:'UTC'};
    const report=await engagementReport(pool,q);assert.deepEqual(report?.interactions.totals,{clicks:1,custom:1,scroll:2});
    assert.equal(report?.interactions.groups,3);assert.equal(report?.interactions.rows.find(r=>r.type==='scroll')?.events,2);assert.equal(report?.interactions.rows.find(r=>r.type==='scroll')?.sessions,1);
    const timeline=await sessionTimeline(pool,q,sessionId);assert.equal(timeline?.events.length,4);assert(timeline?.events.some(e=>e.scopeId==='feed'&&e.milestone===50));assert(timeline?.events.some(e=>e.name==='filter'));
    assert.deepEqual((await engagementReport(pool,{...q,projectId:'interaction-b'}))?.interactions.totals,{clicks:0,custom:0,scroll:1});
    assert.deepEqual((await engagementReport(pool,{...q,startDate:'2020-01-01',endDate:'2020-01-01'}))?.interactions.totals,{clicks:0,custom:0,scroll:0});
  }finally{await app.close();await pool.query("DELETE FROM events WHERE project_id IN ('interaction-a','interaction-b')");await pool.query("DELETE FROM projects WHERE id IN ('interaction-a','interaction-b')");await pool.end();}
});
