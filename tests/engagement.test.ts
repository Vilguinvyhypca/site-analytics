import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../apps/api/src/app.js';
import { postgresAdminStore } from '../apps/api/src/admin-store.js';
import { parseTimelineCursor } from '../apps/api/src/engagement.js';
import { sessionHash } from '../apps/api/src/admin.js';
import type { EngagementReport, SessionList, SessionTimeline } from '@site-analytics/contracts';

test('timeline cursor rejects impossible dates and preserves microseconds', () => {
  const id=randomUUID();
  const encode=(at:string)=>Buffer.from(JSON.stringify({at,id})).toString('base64url');
  for(const at of ['2026-02-30T12:00:00Z','2026-03-08T25:00:00Z','2026-03-08T12:61:00Z','invalid']) assert.equal(parseTimelineCursor(encode(at)),null);
  assert.deepEqual(parseTimelineCursor(encode('2026-03-08T01:00:00.123456-04:00')),{at:'2026-03-08T01:00:00.123456-04:00',id});
});

test('engagement cohorts, action dates, private access and stable session pagination', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const store = postgresAdminStore(pool);
  const config = { store, origin:'http://127.0.0.1:4200',secret:randomBytes(32).toString('hex') };
  const app = createApp(undefined, config);
  const token = randomBytes(32).toString('hex');
  const headers = { cookie:`analytics-owner=${token}` };
  const query = { projectId:'engagement-a',startDate:'2026-03-08',endDate:'2026-03-09',timeZone:'America/New_York' };
  const url = (route: string, patch: Record<string,string> = {}) => `/api/reports/${route}?${new URLSearchParams({...query,...patch})}`;
  const get = async <T>(route: string, patch: Record<string,string> = {}): Promise<T> => {
    const r=await app.inject({url:url(route,patch),headers});assert.equal(r.statusCode,200,r.body);assert.equal(r.headers['cache-control'],'no-store');return r.json<T>();
  };
  const sessionId=randomUUID(), playbackId=randomUUID(), missingStart=randomUUID(), prior=randomUUID(), startOnly=randomUUID();
  const insert=async(type:string,time:string,payload:object,project='engagement-a',session=sessionId)=>{
    const id=randomUUID();
    await pool.query('INSERT INTO events(project_id,event_id,session_id,version,type,occurred_at,payload) VALUES($1,$2,$3,1,$4,$5,$6)',[project,id,session,type,time,JSON.stringify(payload)]);return id;
  };
  const start=(id:string)=>({contentId:'video-a',playbackId:id,autoplay:false});
  const progress=(id:string,sequence:number,seconds:number,duration:number|null=10)=>({...start(id),sequence,engagedSeconds:seconds,durationSeconds:duration,coveredIntervals:duration===null?[]:[[0,Math.min(seconds,duration)]],ended:duration!==null&&seconds>=duration});
  try {
    await pool.query("INSERT INTO owner_account(singleton,password_hash) VALUES(true,'synthetic-only') ON CONFLICT DO NOTHING");
    await pool.query("INSERT INTO owner_sessions(token_hash,expires_at) VALUES($1,now()+interval '1 hour')",[sessionHash(token)]);
    await pool.query("INSERT INTO projects(id,name) VALUES('engagement-a','A'),('engagement-b','B'),('engagement-empty','Empty')");
    await insert('playback_start','2026-03-08T05:00:00Z',start(playbackId));
    await insert('playback_progress','2026-03-08T06:00:00Z',progress(playbackId,1,4));
    await insert('playback_progress','2026-03-11T12:00:00Z',progress(playbackId,2,12));
    await insert('playback_progress','2026-03-09T04:00:00Z',progress(missingStart,1,6,null));
    await insert('playback_start','2026-03-08T04:59:59Z',start(prior));
    await insert('playback_progress','2026-03-08T12:00:00Z',progress(prior,1,10));
    await insert('playback_start','2026-03-09T23:00:00Z',start(startOnly));
    await insert('content_open','2026-03-08T04:59:59Z',{contentId:'outside',contentType:'video'});
    await insert('content_open','2026-03-08T05:00:00Z',{contentId:'video-a',contentType:'video'});
    await insert('content_open','2026-03-09T14:00:00Z',{contentId:'photo-a',contentType:'photo'});
    for (const outcome of ['clicked','copied','handoff','cancelled','failed']) await insert('share','2026-03-09T15:00:00Z',{contentId:'video-a',outcome});
    await insert('playback_start','2026-03-08T05:00:00Z',start(playbackId),'engagement-b');
    await insert('playback_progress','2026-03-08T06:00:00Z',progress(playbackId,1,100),'engagement-b');
    for(const route of ['engagement','sessions','timeline']) assert.equal((await app.inject(url(route,{sessionId}))).statusCode,401);
    const r=await get<EngagementReport>('engagement');
    assert.deepEqual(r.totals,{opens:2,attempts:3,starts:2,engagedSeconds:18,completed:1,completionEligible:1});
    assert.deepEqual(r.distribution,{zero:1,under10:1,under60:1,atLeast60:0});
    assert.equal(r.contents[0].contentId,'video-a');assert.equal(r.contents[0].coverage25,1);assert.equal(r.contents[0].coverage75,1);
    assert.deepEqual(r.contents[0].shares,{clicked:1,copied:1,handoff:1,cancelled:1,failed:1});
    assert.equal(r.contents[1].contentId,'photo-a');assert.equal(r.playbacks.length,3);assert(!r.playbacks.some(p=>p.playbackId===prior));
    assert.equal(r.playbacks.find(p=>p.playbackId===missingStart)?.coverage,null);
    assert.equal((await get<EngagementReport>('engagement',{projectId:'engagement-b'})).totals.engagedSeconds,100);
    assert.equal((await get<EngagementReport>('engagement',{startDate:'2026-03-09'})).totals.engagedSeconds,6);
    assert.equal((await get<EngagementReport>('engagement',{timeZone:'UTC'})).totals.engagedSeconds,28,'UTC includes attempt just before New York midnight');
    const empty=await get<EngagementReport>('engagement',{projectId:'engagement-empty'});assert.equal(empty.totals.attempts,0);assert.deepEqual(empty.contents,[]);
    for(const route of ['engagement','sessions','timeline']) {
      const extras: Record<string,string>=route==='timeline'?{sessionId}:{};
      assert.equal((await app.inject({url:url(route,{...extras,projectId:'missing'}),headers})).statusCode,404);
      assert.equal((await app.inject({url:url(route,{...extras,startDate:'invalid'}),headers})).statusCode,400);
    }
    assert.equal((await app.inject({url:url('timeline',{sessionId,cursor:'bad'}),headers})).statusCode,400);
    assert.equal((await app.inject({url:url('sessions',{after:'bad'}),headers})).statusCode,400);
    assert.equal((await app.inject({url:url('engagement')+'&after='+randomUUID()+'&after='+randomUUID(),headers})).statusCode,400);
    const timeline=await get<SessionTimeline>('timeline',{sessionId});
    assert(!timeline.events.some(e=>e.engagedSeconds===12),'timeline respects event dates even when cohort summary includes later updates');
    assert(!timeline.events.some(e=>e.engagedSeconds===100),'session IDs shared by two projects remain isolated');
    assert.equal((await get<SessionTimeline>('timeline',{sessionId:randomUUID()})).events.length,0);
    // Timestamp ties and microseconds must survive pagination without duplicates or omissions.
    const pagedSession=randomUUID();const expected:string[]=[];
    for(let i=0;i<57;i++)expected.push(await insert('page_view','2026-03-08T05:00:00.123456Z',{path:'/page'},'engagement-a',pagedSession));
    const page1=await get<SessionTimeline>('timeline',{sessionId:pagedSession});assert.equal(page1.events.length,50);assert(page1.nextCursor);
    const page2=await get<SessionTimeline>('timeline',{sessionId:pagedSession,cursor:page1.nextCursor});assert.equal(page2.events.length,7);assert.equal(page2.nextCursor,null);
    assert.deepEqual([...page1.events,...page2.events].map(e=>e.eventId),expected.sort());
    for(let i=0;i<52;i++)await insert('playback_start','2026-03-08T05:00:00Z',start(randomUUID()),'engagement-a',randomUUID());
    const sessions=await get<SessionList>('sessions');assert.equal(sessions.sessions.length,50);assert(sessions.nextSession);
    const next=await get<SessionList>('sessions',{after:sessions.nextSession});assert.equal(next.sessions.length,4);assert.equal(next.nextSession,null);
    assert.equal(new Set([...sessions.sessions,...next.sessions].map(s=>s.sessionId)).size,54);
    const plays=await get<EngagementReport>('engagement');assert.equal(plays.playbacks.length,50);assert(plays.nextPlayback);
    const plays2=await get<EngagementReport>('engagement',{after:plays.nextPlayback});assert.equal(plays2.playbacks.length,5);assert.equal(plays2.nextPlayback,null);
    assert.deepEqual(plays.totals,plays2.totals,'pagination does not change full-cohort totals');
    assert.equal(new Set([...plays.playbacks,...plays2.playbacks].map(p=>p.playbackId)).size,55);
    const failing=createApp(undefined,{...config,store:{...store,engagement:async()=>{throw Error('private data');}}});
    try{const response=await failing.inject({url:url('engagement'),headers});assert.equal(response.statusCode,503);assert(!response.body.includes('private data'));}finally{await failing.close();}
    await store.deleteSession(sessionHash(token));assert.equal((await app.inject({url:url('engagement'),headers})).statusCode,401);
  } finally {
    await app.close();await pool.query("DELETE FROM events WHERE project_id IN ('engagement-a','engagement-b','engagement-empty')");
    await pool.query("DELETE FROM projects WHERE id IN ('engagement-a','engagement-b','engagement-empty')");await store.deleteSession(sessionHash(token));await pool.end();
  }
});
