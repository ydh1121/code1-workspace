import {normalizeSource,verifyNormalized} from './source-normalizer.mjs';
import {normalizePlanningSource,verifyPlanningNormalized} from './planning-source-normalizer.mjs';

const str=v=>String(v??'').trim();
const chunks=(rows,size=100)=>{const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out;};

function actorResolver(accounts){
  const map=new Map();
  for(const a of accounts){
    for(const value of [a.account_id,a.username,a.email]){
      const key=str(value).toLowerCase();if(key)map.set(key,a.account_id);
    }
  }
  return value=>map.get(str(value).toLowerCase())||null;
}

function latestRowsBySubmission(rows){
  const grouped=new Map();
  for(const row of rows||[]){
    const id=str(row?.submission_id);if(!id)continue;
    if(!grouped.has(id))grouped.set(id,[]);
    grouped.get(id).push(row);
  }
  for(const rows of grouped.values())rows.sort((a,b)=>Number(a?.revision||0)-Number(b?.revision||0));
  return grouped;
}

export function prepareSourceImport(source){
  const runtime=normalizeSource(source);
  const planning=normalizePlanningSource(source);
  const runtimeCheck=verifyNormalized(runtime);
  const planningCheck=verifyPlanningNormalized(planning);
  if(!runtimeCheck.ok||!planningCheck.ok){
    const e=Error('SOURCE_NORMALIZATION_FAILED');
    e.details={runtime:runtimeCheck,planning:planningCheck};
    throw e;
  }

  const resolveActor=actorResolver(runtime.accounts);
  const submissionRows=latestRowsBySubmission(source?.submissionQueue||[]);
  for(const s of runtime.submissions){
    const rows=submissionRows.get(s.submission_id)||[];
    const first=rows[0]||{};const last=rows.at(-1)||{};
    s.created_by=resolveActor(first.edited_by||first.submitted_by);
    s.last_edited_by=resolveActor(last.edited_by||last.submitted_by);
    s.reviewer_id=resolveActor(last.reviewer);
  }
  for(const a of runtime.answers){a.edited_by=resolveActor(a.source_edited_by);delete a.source_edited_by;}

  const mediaSource=new Map((source?.mediaQueue||[]).map(row=>[str(row?.upload_id),row]));
  const latestTrash=new Map();
  for(const event of runtime.mediaEvents||[]){
    event.actor_id=resolveActor(event.actor_id);
    if(event.to_status==='TRASHED')latestTrash.set(event.media_id,event.at);
  }
  for(const m of runtime.media){
    const row=mediaSource.get(m.upload_id)||{};
    m.uploaded_by=resolveActor(row.submitted_by);
    m.reviewed_by=resolveActor(row.reviewed_by);
    m.reviewed_at=str(row.reviewed_at)||null;
    m.deleted_at=m.status==='DELETED'?(latestTrash.get(m.media_id)||null):null;
  }
  for(const p of runtime.questionPolicies||[])p.updated_by=resolveActor(p.updated_by);
  for(const h of runtime.questionPolicyHistory||[])h.actor_id=resolveActor(h.actor_id);
  for(const a of runtime.auditLog||[]){
    const raw=a.actor_id;a.actor_id=resolveActor(raw)||raw||null;
  }

  const migrationRegistry=[];
  const add=(entityType,rows,key,sourceRef)=>{
    for(const row of rows||[])if(row?.[key])migrationRegistry.push({source_system:'GOOGLE_SHEET',entity_type:entityType,stable_id:String(row[key]),source_ref:sourceRef,source_hash:null});
  };
  add('ACCOUNT',runtime.accounts,'account_id','19_WEB_ACCOUNTS');
  add('FARM',runtime.farms,'farm_id','01_농가_Master');
  add('QUESTION',runtime.questions,'item_key','13_WEB_질문카탈로그');
  add('SUBMISSION',runtime.submissions,'submission_id','11_WEB_제출큐');
  add('MEDIA',runtime.media,'media_id','12_WEB_미디어큐');
  add('HOUSING_ENVIRONMENT',planning.housingEnvironmentRecords,'record_id','01_농가_Master.사육환경번호');
  for(const a of runtime.answers)migrationRegistry.push({source_system:'GOOGLE_SHEET',entity_type:'ANSWER_VERSION',stable_id:`${a.submission_id}:${a.item_key}:r${a.revision}`,source_ref:'11_WEB_제출큐',source_hash:null});

  return {runtime,planning,migrationRegistry,checks:{runtime:runtimeCheck,planning:planningCheck}};
}

async function upsert(db,table,rows,onConflict){
  if(!rows?.length)return 0;
  let total=0;
  for(const batch of chunks(rows)){
    const query=onConflict?`?on_conflict=${encodeURIComponent(onConflict)}`:'';
    await db.request(`/rest/v1/${table}${query}`,{method:'POST',body:batch,headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
    total+=batch.length;
  }
  return total;
}

async function existingSourceRows(db,table,source){
  const query=`select=metadata&metadata-%3E%3Esource=eq.${encodeURIComponent(source)}`;
  const rows=await db.select(table,query);
  return new Set((rows||[]).map(r=>Number(r?.metadata?.source_row)).filter(Number.isFinite));
}

async function appendHistoryRows(db,table,rows,source){
  if(!rows?.length)return 0;
  const existing=await existingSourceRows(db,table,source);
  const pending=rows.filter(r=>!existing.has(Number(r?.metadata?.source_row)));
  for(const batch of chunks(pending))await db.insert(table,batch,'return=minimal');
  return pending.length;
}

export async function applyPreparedImport(db,prepared,{confirmRef,expectedRef}={}){
  if(!expectedRef||confirmRef!==expectedRef)throw Error('IMPORT_CONFIRM_REF_MISMATCH');
  const n=prepared.runtime,p=prepared.planning;
  const counts={};
  counts.accounts=await upsert(db,'workspace_accounts',n.accounts,'account_id');
  counts.farms=await upsert(db,'farms',n.farms,'farm_id');
  counts.questions=await upsert(db,'question_catalog',n.questions,'item_key');
  counts.submissions=await upsert(db,'intake_submissions',n.submissions,'submission_id');
  counts.answerVersions=await upsert(db,'submission_answers',n.answers,'submission_id,item_key,revision');
  counts.media=await upsert(db,'media_assets',n.media,'media_id');
  counts.questionPolicies=await upsert(db,'question_policies',n.questionPolicies,'policy_id');
  counts.questionPolicyHistory=0;
  if(n.questionPolicyHistory?.length)throw Error('POLICY_HISTORY_IMPORT_REQUIRES_DEDUP_CONTRACT');
  counts.housingEnvironment=await upsert(db,'housing_environment_records',p.housingEnvironmentRecords,'record_id');
  counts.mediaEvents=await appendHistoryRows(db,'media_events',n.mediaEvents,'24_WEB_미디어정리_이력');
  counts.auditLog=await appendHistoryRows(db,'audit_log',n.auditLog,'20_WEB_ACCESS_LOG');
  counts.loginGuard=await upsert(db,'login_guard',n.loginGuard,'guard_key');
  counts.migrationRegistry=await upsert(db,'migration_registry',prepared.migrationRegistry,'source_system,entity_type,stable_id');
  return counts;
}

export async function readImportedCounts(db){
  const specs={
    accounts:['workspace_accounts','account_id'],farms:['farms','farm_id'],questions:['question_catalog','item_key'],
    submissions:['intake_submissions','submission_id'],answerVersions:['submission_answers','submission_id,item_key,revision'],
    media:['media_assets','media_id'],mediaEvents:['media_events','event_id'],auditLog:['audit_log','audit_id'],
    loginGuard:['login_guard','guard_key'],housingEnvironment:['housing_environment_records','record_id'],
    questionPolicies:['question_policies','policy_id'],questionPolicyHistory:['question_policy_history','history_id'],
    planningCapabilities:['account_capabilities','account_id,capability'],planningBriefVersions:['planning_brief_versions','brief_key,brief_version'],
    planningSourceArtifacts:['planning_source_artifacts','artifact_id']
  };
  const out={};
  for(const [name,[table,columns]] of Object.entries(specs))out[name]=(await db.select(table,`select=${columns}`)||[]).length;
  return out;
}
