import {createApp} from '../apps/api/src/app.ts';
const app=createApp({async collect(batch){return {accepted:batch.events.length,duplicates:0};}});
await app.listen({port:0,host:'127.0.0.1'});
const address=app.server.address(),url=`http://127.0.0.1:${address.port}`;
const event=()=>({version:1,projectId:'pilot',eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),occurredAt:new Date().toISOString(),type:'page_view',path:'/'});
const started=performance.now(), statuses=[];
for(let i=0;i<121;i++){
 const response=await fetch(url+'/api/collect',{method:'POST',headers:{origin:'http://localhost:4300','content-type':'application/json'},body:JSON.stringify({version:1,projectId:'pilot',events:[event()]})});statuses.push(response.status);await response.arrayBuffer();
}
await app.close();
const accepted=statuses.filter(s=>s===202).length,limited=statuses.filter(s=>s===429).length;
console.log(JSON.stringify({requests:121,accepted,rateLimited:limited,elapsedMs:Math.round(performance.now()-started),scope:'single process, single client IP, sequential burst; mock store; not database capacity'}));
if(accepted!==120||limited!==1)process.exitCode=1;
