const origin=String(process.env.OPS_RELAY_PREVIEW_ORIGIN||'').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\.code1-workspace\.pages\.dev$/.test(origin))throw Error('OPS_PREVIEW_ORIGIN_REQUIRED');
const must=async(path,{status=200,contains=[]}={})=>{
  const r=await fetch(origin+path,{redirect:'follow'});const text=await r.text();
  if(r.status!==status)throw Error(`${path}: expected ${status}, got ${r.status}`);
  if(new URL(r.url).origin!==origin)throw Error(`${path}: unexpected cross-origin redirect ${r.url}`);
  for(const value of contains)if(!text.includes(value))throw Error(`${path}: missing ${value}`);
  console.log(`PASS GET ${path} ${r.status}`);return {r,text};
};
const unauthRpc=async(action,payload={})=>{
  const rpc=await fetch(origin+'/api/rpc',{method:'POST',redirect:'follow',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload})});let body={};try{body=await rpc.json();}catch{}
  if(rpc.status!==401||new URL(rpc.url).origin!==origin||body.error!=='UNAUTHENTICATED')throw Error(`${action} fail-closed mismatch: ${rpc.status} ${JSON.stringify(body)}`);
  console.log(`PASS POST /api/rpc ${action} -> 401 UNAUTHENTICATED`);
};
await must('/ops-relay.html',{contains:['OPS Change Relay','Planning 필요','Incident','실패','완료','Planning SSOT가 아닙니다','QA 이벤트 준비','QA 이벤트 정리']});
await must('/assets/ops-relay.js',{contains:['admin.ops.events','admin.ops.review','admin.ops.qa.fixture.create','admin.ops.qa.fixture.cleanup','기획 검토 필요','correlationId','attemptCount']});
await must('/assets/ops-relay.css',{contains:['.event-card','.qa-actions','@media(max-width:900px)','@media(max-width:560px)']});
const session=await fetch(origin+'/api/session',{redirect:'follow'});const sj=await session.json();
if(session.status!==200||new URL(session.url).origin!==origin||sj.configured!==true||sj.authenticated!==false)throw Error(`session gate mismatch: ${session.status} ${JSON.stringify(sj)}`);
console.log('PASS GET /api/session configured=true authenticated=false');
await unauthRpc('admin.ops.events',{limit:1});
await unauthRpc('admin.ops.capacity.report',{});
await unauthRpc('admin.ops.retention.dryRun',{});
await unauthRpc('admin.ops.qa.fixture.create',{});
await unauthRpc('admin.ops.qa.fixture.cleanup',{});
console.log(JSON.stringify({origin,staticRoutes:'PASS',sessionGate:'PASS',unauthenticatedRpcFailClosed:'PASS',retentionReportUnauthenticatedFailClosed:'PASS',qaFixtureUnauthenticatedFailClosed:'PASS',remoteMutation:'NONE'},null,2));
