const str=v=>String(v??'').trim();
const bool=v=>['TRUE','Y','YES','1',true,1].includes(typeof v==='string'?v.toUpperCase():v);
const date=v=>str(v)||null;
const timestamp=v=>{
  if(v===undefined||v===null||v==='')return null;
  const n=Number(v);
  if(Number.isFinite(n)&&n>100000000000)return new Date(n).toISOString();
  return str(v)||null;
};
function parseOptions(v){if(Array.isArray(v))return v;if(!v)return null;try{const x=JSON.parse(v);return Array.isArray(x)?x:null;}catch{return null;}}
function parseJson(value,fallback){if(value&&typeof value==='object')return value;try{return value?JSON.parse(value):fallback;}catch{return fallback;}}
function parseCellValue(row){
  if(row.value_boolean!==undefined&&row.value_boolean!==null&&str(row.value_boolean)!=='')return row.value_boolean;
  if(row.value_number!==undefined&&row.value_number!==null&&str(row.value_number)!=='')return Number(row.value_number);
  if(str(row.value_date))return row.value_date;
  const raw=row.value_text;
  if(raw===undefined||raw===null)return null;
  if(typeof raw!=='string')return raw;
  try{return JSON.parse(raw);}catch{return raw;}
}
function auditTarget(action){
  if(action.startsWith('media.'))return 'MEDIA';
  if(action.startsWith('question-policy.'))return 'QUESTION_POLICY';
  if(action.startsWith('account.')||action.startsWith('login.'))return 'ACCOUNT';
  return 'LEGACY_RUNTIME';
}

export function normalizeSource(source){
  const warnings=[],errors=[];
  const accounts=(source.accounts||[]).filter(r=>r.account_id).map(r=>({account_id:str(r.account_id),username:str(r.username).toLowerCase(),display_name:str(r.display_name),email:str(r.email)||null,role:str(r.role),status:str(r.status),permissions_json:parseJson(r.permissions_json,{}),password_salt:str(r.password_salt)||null,password_hash:str(r.password_hash)||null,password_iterations:r.password_iterations?Number(r.password_iterations):null,password_scheme:str(r.password_scheme)||null,session_version:Number(r.session_version||1),created_at:date(r.created_at),updated_at:date(r.updated_at)}));
  const farms=(source.farms||[]).filter(r=>r.farm_id).map(r=>({farm_id:str(r.farm_id),internal_name:str(r['내부 농가명'])||null,public_name:str(r['공개 농가명'])||null,onboarding_status:str(r['상태'])||'자료요청',origin_cohort:bool(r['Origin_12']),region_province:str(r['시도'])||null,region_district:str(r['시군구'])||null,public_region_label:str(r['공개 지역 범위'])||null}));
  const questions=(source.questionCatalog||[]).filter(r=>r.item_key).map(r=>({item_key:str(r.item_key),sort_order:Number(r.sort_order),section_code:str(r.section_code),section_name:str(r.section_name),item_label:str(r.item_label),plain_question:str(r.plain_question)||str(r.item_label),why_needed:str(r.why_needed)||null,input_type:str(r.input_type),required_level:str(r.required_level),options:parseOptions(r.options),evidence_required:bool(r.evidence_required),evidence_hint:str(r.evidence_hint)||null,target_sheet:str(r.target_sheet)||null,target_column:str(r.target_column)||null,help_text:str(r.help_text)||null,active:!['FALSE','N','0'].includes(str(r.active).toUpperCase())}));

  const bySubmission=new Map(),answers=[];let commitSentinels=0;
  for(const row of source.submissionQueue||[]){
    const id=str(row.submission_id);if(!id)continue;
    const rev=Number(row.revision||0);if(!Number.isInteger(rev)||rev<1){errors.push(`invalid revision ${id}`);continue;}
    let s=bySubmission.get(id);if(!s){s={submission_id:id,farm_id:str(row.farm_id)||null,farm_name_snapshot:str(row.farm_name),status:str(row.status)||'DRAFT',current_revision:0,created_at:date(row.submitted_at),updated_at:date(row.submitted_at),latest_request_id:str(row.request_id)||null,created_by:null,last_edited_by:null};bySubmission.set(id,s);}
    if(rev>=s.current_revision){s.current_revision=rev;s.status=str(row.status)||s.status;s.updated_at=date(row.submitted_at)||s.updated_at;s.latest_request_id=str(row.request_id)||s.latest_request_id;}
    if(str(row.item_key)==='__COMMIT__'){commitSentinels++;continue;}
    answers.push({submission_id:id,item_key:str(row.item_key),revision:rev,input_type:str(row.input_type)||'text',value_jsonb:parseCellValue(row),evidence_required:bool(row.evidence_required),source_note:str(row.source_note)||null,request_id:str(row.request_id)||null,recorded_at:date(row.submitted_at),edited_by:null,source_edited_by:str(row.edited_by)||str(row.submitted_by)||null});
  }

  const media=(source.mediaQueue||[]).filter(r=>r.upload_id).map(r=>({media_id:str(r.media_id)||str(r.upload_id),upload_id:str(r.upload_id),submission_id:str(r.submission_id)||null,farm_id:str(r.farm_id)||null,media_group:str(r.media_group)||'PHOTO',shot_code:str(r.shot_code)||null,shot_label:str(r.shot_label)||null,original_file_name:str(r.file_name)||'original',object_key:null,mime_type:str(r.mime_type)||null,file_size_bytes:r.file_size_bytes?Number(r.file_size_bytes):null,caption:str(r.caption)||null,taken_at:date(r.taken_at),photographer:str(r.photographer)||null,rights_owner:str(r.rights_owner)||null,face_present:str(r.face_present)||null,face_consent:str(r.face_consent)||null,privacy_present:str(r.privacy_present)||null,privacy_checked:str(r.privacy_checked)||null,web_use:str(r.web_use)||null,magazine_use:str(r.magazine_use)||null,sns_use:str(r.sns_use)||null,b2b_use:str(r.b2b_use)||null,ad_use:str(r.ad_use)||null,edit_allowed:str(r.edit_allowed)||null,ai_edit_allowed:str(r.ai_edit_allowed)||null,status:str(r.status)||'REVIEW_REQUIRED',review_note:str(r.review_note)||null,request_id:str(r.request_id)||null,uploaded_at:date(r.submitted_at),source_drive_file_id:str(r.drive_file_id)||null,source_drive_url:str(r.drive_url)||null,source_storage:'GOOGLE_DRIVE_LEGACY'}));
  const deckMedia=media.filter(m=>m.media_group==='DECK'||m.submission_id==='DECK');
  const deckIds=new Set(deckMedia.map(m=>m.media_id));
  const farmMedia=media.filter(m=>!deckIds.has(m.media_id));
  if(deckMedia.length)warnings.push(`${deckMedia.length} DECK media rows excluded from farm runtime cutover`);

  const questionPolicies=(source.questionPolicies||[]).filter(r=>r.policy_id).map(r=>({policy_id:str(r.policy_id),scope:str(r.scope),farm_id:str(r.farm_id)||null,item_key:str(r.item_key),mode:str(r.mode),reason_code:str(r.reason_code)||null,reason_note:str(r.reason_note)||null,version:Number(r.version),status:str(r.status)||'active',updated_by:str(r.updated_by)||null,updated_at:date(r.updated_at),request_id:str(r.request_id)||null}));
  const questionPolicyHistory=(source.questionPolicyHistory||[]).filter(r=>r.policy_id).map(r=>({at:timestamp(r.at),actor_id:str(r.actor_id)||null,policy_id:str(r.policy_id),scope:str(r.scope),farm_id:str(r.farm_id)||null,item_key:str(r.item_key),before_mode:str(r.before_mode)||null,after_mode:str(r.after_mode),reason_code:str(r.reason_code)||null,reason_note:str(r.reason_note)||null,version:Number(r.version||0),request_id:str(r.request_id)||null,before_json:parseJson(r.before_json,null),after_json:parseJson(r.after_json,null)}));
  const auditLog=(source.accessLog||[])
    .map((r,index)=>({r,sourceRow:index+2}))
    .filter(({r})=>r.action)
    .map(({r,sourceRow})=>({at:timestamp(r.at),actor_id:str(r.actor_id)||null,action:str(r.action),target_type:auditTarget(str(r.action)),target_id:str(r.target_id)||null,detail:str(r.detail)||null,request_id:null,metadata:{source:'20_WEB_ACCESS_LOG',source_row:sourceRow}}));
  const loginGuard=(source.loginGuard||[]).filter(r=>r.key).map(r=>({guard_key:str(r.key),window_start:timestamp(r.window_start),attempts:Number(r.attempts||0),updated_at:timestamp(r.window_start)}));
  const mediaEvents=(source.mediaHistory||[])
    .map((r,index)=>({r,sourceRow:index+2}))
    .filter(({r})=>r.upload_id&&!deckIds.has(str(r.upload_id)))
    .map(({r,sourceRow})=>({at:timestamp(r.at),actor_id:str(r.actor_id)||null,media_id:str(r.upload_id),event_type:`LEGACY_${str(r.status)||'EVENT'}`,from_status:null,to_status:str(r.status)||null,object_key:null,detail:str(r.detail)||null,request_id:null,metadata:{source:'24_WEB_미디어정리_이력',source_row:sourceRow,source_drive_file_id:str(r.drive_file_id)||null,media_type:str(r.media_type)||null,category:str(r.category)||null,shot_code:str(r.shot_code)||null,shot_label:str(r.shot_label)||null,original_file_name:str(r.original_file_name)||null,stored_file_name:str(r.stored_file_name)||null,folder_path:str(r.folder_path)||null,legacy_version:Number(r.version||0)}}));

  return {accounts,farms,questions,submissions:[...bySubmission.values()],answers,media:farmMedia,excluded:{deckMedia,commitSentinels},questionPolicies,questionPolicyHistory,auditLog,loginGuard,mediaEvents,warnings,errors};
}

export function verifyNormalized(n){
  const errors=[...(n.errors||[])],warnings=[...(n.warnings||[])];
  unique(n.accounts,'account_id',errors);unique(n.farms,'farm_id',errors);unique(n.questions,'item_key',errors);unique(n.submissions,'submission_id',errors);unique(n.media,'media_id',errors);unique(n.loginGuard||[],'guard_key',errors);
  const farmIds=new Set(n.farms.map(x=>x.farm_id)),questionIds=new Set(n.questions.map(x=>x.item_key)),subIds=new Set(n.submissions.map(x=>x.submission_id)),mediaIds=new Set(n.media.map(x=>x.media_id));
  for(const s of n.submissions)if(s.farm_id&&!farmIds.has(s.farm_id))warnings.push(`submission ${s.submission_id} has non-master farm ${s.farm_id}`);
  for(const a of n.answers){if(!subIds.has(a.submission_id))errors.push(`answer orphan submission ${a.submission_id}`);if(!questionIds.has(a.item_key))errors.push(`answer unknown item ${a.item_key}`);}
  for(const m of n.media){if(m.submission_id&&!subIds.has(m.submission_id))warnings.push(`media ${m.media_id} references missing submission ${m.submission_id}`);if(m.farm_id&&!farmIds.has(m.farm_id))warnings.push(`media ${m.media_id} references non-master farm ${m.farm_id}`);}
  for(const h of n.questionPolicyHistory||[])if(!questionIds.has(h.item_key))warnings.push(`policy history unknown item ${h.item_key}`);
  for(const e of n.mediaEvents||[])if(!mediaIds.has(e.media_id))errors.push(`media event orphan media ${e.media_id}`);
  for(const g of n.loginGuard||[]){if(!g.window_start||!Number.isInteger(g.attempts)||g.attempts<0)errors.push(`invalid login guard ${g.guard_key}`);}
  return {ok:errors.length===0,errors,warnings,counts:{accounts:n.accounts.length,farms:n.farms.length,questions:n.questions.length,submissions:n.submissions.length,answerVersions:n.answers.length,commitSentinels:n.excluded?.commitSentinels||0,media:n.media.length,excludedDeckMedia:n.excluded?.deckMedia?.length||0,questionPolicies:n.questionPolicies.length,questionPolicyHistory:n.questionPolicyHistory?.length||0,auditLog:n.auditLog?.length||0,loginGuard:n.loginGuard?.length||0,mediaEvents:n.mediaEvents?.length||0}};
}
function unique(rows,key,errors){const s=new Set();for(const r of rows){if(!r[key])errors.push(`missing ${key}`);else if(s.has(r[key]))errors.push(`duplicate ${key}:${r[key]}`);else s.add(r[key]);}}
