const origin=String(process.env.PLANNING_MATERIAL_PREVIEW_ORIGIN||'').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9-]+\.code1-workspace\.pages\.dev$/.test(origin))throw Error('PLANNING_MATERIAL_PREVIEW_ORIGIN_REQUIRED');

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

await must('/',{contains:['/assets/accounts.js','CODE1 Internal Workspace']});
await must('/assets/accounts.js',{contains:['loadMaterialModule','/assets/planning-materials.js','/assets/planning-materials.css','PARTNER','MATERIAL_UPLOAD_ASSIGNED']});
await must('/assets/planning-materials.js',{contains:[
  '상세페이지 및 제안서 파일',
  'planning.material.bootstrap',
  'planning.material.upload.begin',
  'planning.material.upload.chunk',
  'planning.material.upload.finish',
  'planning.material.template.publish',
  'responseKind',
  "kind==='FILE'",
  "kind==='TEXT_FILE'",
  '초안 미리보기',
  '게시 전에는 실제 제출자에게 노출되지 않습니다',
  '자료 제출'
]});
await must('/assets/planning-materials.css',{contains:['@media(max-width:390px)','overflow-x:hidden','.material-workspace','.material-upload-zone','.material-review-panel']});
const session=await fetch(origin+'/api/session',{redirect:'follow'});const sj=await session.json();
if(session.status!==200||new URL(session.url).origin!==origin||sj.configured!==true||sj.authenticated!==false)throw Error(`session gate mismatch: ${session.status} ${JSON.stringify(sj)}`);
console.log('PASS GET /api/session configured=true authenticated=false');
await unauthRpc('planning.material.bootstrap',{});
await unauthRpc('planning.material.request.get',{materialRequestId:'PMR_READONLY_SMOKE'});
await unauthRpc('planning.material.upload.begin',{requestItemId:'PMI_READONLY_SMOKE'});
await unauthRpc('planning.material.request.submit',{materialRequestId:'PMR_READONLY_SMOKE',targetStatus:'SUBMITTED'});
await unauthRpc('planning.material.template.publish',{templateId:'PMT_READONLY_SMOKE',revision:1});
console.log(JSON.stringify({origin,staticRoutes:'PASS',fieldTypeBundleContract:'PASS',draftPublishBundleContract:'PASS',dynamicLoaderContract:'PASS',sessionGate:'PASS',unauthenticatedRpcFailClosed:'PASS',remoteMutation:'NONE'},null,2));
