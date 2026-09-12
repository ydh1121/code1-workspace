import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {PLANNING_CAPABILITIES,FACT_STATUSES,assertFactTransition,requiredFactCapability} from './planning-contract.mjs';
import {resolveWorkspaceAccess,requireWorkspaceAccess,accessHas} from './workspace-access.mjs';

const esc=encodeURIComponent;
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const validId=value=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(String(value||''));
const requestId=value=>/^[a-f0-9]{32}$/.test(String(value||''));
const nonNegative=(value,field)=>{const n=Number(value??0);if(!Number.isFinite(n)||n<0)throw Error(`INVALID_${field}`);return n;};

export async function hasPlanningCapability(db,actor,capability){
  if(!Object.values(PLANNING_CAPABILITIES).includes(capability))return false;
  const rows=await db.select('account_capabilities',`account_id=eq.${esc(actor.row.account_id)}&capability=eq.${esc(capability)}&effect=eq.ALLOW&select=capability`);
  return !!rows?.length;
}

export async function requirePlanningCapability(db,actor,capability){
  if(!await hasPlanningCapability(db,actor,capability))throw Error('FORBIDDEN');
}

async function requireAnyFactCapability(db,actor){
  for(const capability of [PLANNING_CAPABILITIES.FACT_SUBMIT,PLANNING_CAPABILITIES.FACT_VERIFY,PLANNING_CAPABILITIES.FACT_APPROVE_CURRENT]){
    if(await hasPlanningCapability(db,actor,capability))return;
  }
  throw Error('FORBIDDEN');
}

async function planningContext(env,principal,fetchImpl,capability='PAGE_PLANNING'){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),profile=await resolveWorkspaceAccess(db,actor);
  requireWorkspaceAccess(profile,capability);
  return {db,actor,profile};
}

export async function listFactInbox(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requireAnyFactCapability(db,actor);
  const status=payload.status&&FACT_STATUSES.includes(String(payload.status))?`&status=eq.${esc(payload.status)}`:'';
  const subjectType=payload.subjectType?`&subject_type=eq.${esc(clean(payload.subjectType,80))}`:'';
  const subjectId=payload.subjectId?`&subject_id=eq.${esc(clean(payload.subjectId,160))}`:'';
  const rows=await db.select('fact_inbox',`select=fact_id,domain,subject_type,subject_id,statement,source_type,reported_by,reported_at,evidence_ref,status,verification_note,verification_confidence,external_disclosure_allowed,verified_by,verified_at,approved_current_at,approved_current_by,supersedes_fact_id,created_by,created_at,updated_by,updated_at${status}${subjectType}${subjectId}&order=updated_at.desc&limit=200`);
  return {facts:rows||[]};
}

export async function createFactInboxItem(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requirePlanningCapability(db,actor,PLANNING_CAPABILITIES.FACT_SUBMIT);
  const domain=clean(payload.domain,80),subjectType=clean(payload.subjectType,80),subjectId=clean(payload.subjectId,160),statement=clean(payload.statement,8000),sourceType=clean(payload.sourceType,80),reportedBy=clean(payload.reportedBy,240);
  if(!domain||!subjectType||!subjectId||!statement||!sourceType||!validId(subjectId))throw Error('INVALID_FACT');
  const supersedes=payload.supersedesFactId?clean(payload.supersedesFactId,160):null;if(supersedes&&!validId(supersedes))throw Error('INVALID_FACT');
  const id=`FACT_${crypto.randomUUID().replace(/-/g,'')}`;
  const row={fact_id:id,domain,subject_type:subjectType,subject_id:subjectId,statement,source_type:sourceType,reported_by:reportedBy||actor.row.account_id,reported_at:payload.reportedAt||new Date().toISOString(),evidence_ref:payload.evidenceRef??null,status:'RECEIVED',external_disclosure_allowed:false,supersedes_fact_id:supersedes,created_by:actor.row.account_id,updated_by:actor.row.account_id};
  const saved=(await db.insert('fact_inbox',row,'return=representation'))?.[0]||row;
  await db.insert('fact_events',{fact_id:id,actor_id:actor.row.account_id,event_type:'RECEIVED',to_status:'RECEIVED',request_id:requestId(payload.requestId)?payload.requestId:null,metadata:{sourceType}},'return=minimal');
  return saved;
}

export async function transitionFactInboxItem(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal),id=clean(payload.id,160),toStatus=clean(payload.status,40);
  if(!validId(id)||!FACT_STATUSES.includes(toStatus)||!requestId(payload.requestId))throw Error('INVALID_FACT');
  const current=(await db.select('fact_inbox',`fact_id=eq.${esc(id)}&select=fact_id,status,evidence_ref`))?.[0];if(!current)throw Error('NOT_FOUND');
  assertFactTransition(current.status,toStatus);
  const evidenceRef=payload.evidenceRef??null;
  if(toStatus==='DOCUMENT_RECEIVED'&&evidenceRef===null&&current.evidence_ref==null)throw Error('EVIDENCE_REQUIRED');
  if(['VERIFIED','APPROVED_CURRENT'].includes(toStatus)&&evidenceRef===null&&current.evidence_ref==null)throw Error('EVIDENCE_REQUIRED');
  await requirePlanningCapability(db,actor,requiredFactCapability(toStatus));
  const confidence=payload.confidence===undefined||payload.confidence===null?null:Number(payload.confidence);if(confidence!==null&&(!Number.isFinite(confidence)||confidence<0||confidence>1))throw Error('INVALID_FACT_CONFIDENCE');
  const result=await db.rpc('code1_transition_fact',{p_actor_id:actor.row.account_id,p_fact_id:id,p_to_status:toStatus,p_note:clean(payload.note,2000)||null,p_confidence:confidence,p_evidence_ref:evidenceRef,p_request_id:payload.requestId});
  return result?.[0]||{fact_id:id,status:toStatus};
}

export async function getPublishedExecutiveBrief(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);await requirePlanningCapability(db,actor,PLANNING_CAPABILITIES.EXECUTIVE_BRIEF_VIEW);
  const rows=await db.select('planning_brief_versions','brief_key=eq.EXECUTIVE_CURRENT&status=eq.PUBLISHED&select=brief_key,brief_version,status,source_revision,source_version,content_json,sections,confidentiality,published_at,published_by&limit=1');
  const brief=rows?.[0];if(!brief)throw Error('NOT_FOUND');
  return {brief};
}

async function documentBundle(db,actor,profile,id='EXECUTIVE_CURRENT'){
  if(!validId(id))throw Error('INVALID_PLANNING_DOCUMENT');
  const doc=(await db.select('planning_documents',`document_id=eq.${esc(id)}&status=eq.ACTIVE&select=document_id,title,purpose,status,current_revision,current_revision_id,source_brief_key,source_brief_version,created_by,created_at,updated_by,updated_at`))?.[0];
  if(!doc)throw Error('NOT_FOUND');
  const revision=(await db.select('planning_document_revisions',`document_id=eq.${esc(id)}&revision=eq.${Number(doc.current_revision)}&select=revision_id,document_id,revision,title,purpose,sections,summary,created_by,created_at,request_id`))?.[0];
  if(!revision)throw Error('NOT_FOUND');
  const [feedback,revisions,accounts]=await Promise.all([
    db.select('planning_feedback',`document_id=eq.${esc(id)}&order=created_at.desc&select=feedback_id,document_id,revision,section_id,actor_id,body,status,created_at,resolved_at,resolved_by`),
    db.select('planning_document_revisions',`document_id=eq.${esc(id)}&order=revision.desc&limit=50&select=revision_id,revision,title,summary,created_by,created_at`),
    db.select('workspace_accounts','archived_at=is.null&select=account_id,username,display_name,role')
  ]);
  const labels=Object.fromEntries((accounts||[]).map(a=>[a.account_id,{username:a.username,displayName:a.display_name,role:a.role}]));
  return {
    document:doc,
    revision,
    revisions:revisions||[],
    feedback:(feedback||[]).map(f=>({...f,actor:labels[f.actor_id]||null,resolvedBy:labels[f.resolved_by]||null})),
    access:{
      canEdit:accessHas(profile,'PLANNING_EDIT'),
      canFeedback:accessHas(profile,'PLANNING_FEEDBACK'),
      canFactSubmit:await hasPlanningCapability(db,actor,PLANNING_CAPABILITIES.FACT_SUBMIT),
      canFactVerify:await hasPlanningCapability(db,actor,PLANNING_CAPABILITIES.FACT_VERIFY),
      canFactApprove:await hasPlanningCapability(db,actor,PLANNING_CAPABILITIES.FACT_APPROVE_CURRENT)
    }
  };
}

export async function getPlanningDocument(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl);
  return documentBundle(db,actor,profile,clean(payload.id||'EXECUTIVE_CURRENT',160));
}

export async function savePlanningDocument(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl,'PLANNING_EDIT');
  const id=clean(payload.id||'EXECUTIVE_CURRENT',160),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid)||!Number.isInteger(Number(payload.baseRevision))||!Array.isArray(payload.sections))throw Error('INVALID_PLANNING_DOCUMENT');
  await db.rpc('code1_save_planning_document',{
    p_actor_id:actor.row.account_id,p_document_id:id,p_base_revision:Number(payload.baseRevision),
    p_title:clean(payload.title,240),p_purpose:clean(payload.purpose,4000),p_sections:payload.sections,
    p_summary:clean(payload.summary,2000),p_request_id:rid
  });
  return documentBundle(db,actor,profile,id);
}

export async function addPlanningFeedback(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl,'PLANNING_FEEDBACK');
  const id=clean(payload.id||'EXECUTIVE_CURRENT',160),rid=String(payload.requestId||''),revision=Number(payload.revision),body=clean(payload.body,8000),sectionId=clean(payload.sectionId,160);
  if(!validId(id)||!requestId(rid)||!Number.isInteger(revision)||revision<1||!body)throw Error('INVALID_FEEDBACK');
  await db.rpc('code1_add_planning_feedback',{p_actor_id:actor.row.account_id,p_document_id:id,p_revision:revision,p_section_id:sectionId||null,p_body:body,p_request_id:rid});
  return documentBundle(db,actor,profile,id);
}

export async function resolvePlanningFeedback(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl,'PLANNING_EDIT');
  const feedbackId=clean(payload.feedbackId,160),rid=String(payload.requestId||'');
  if(!validId(feedbackId)||!requestId(rid))throw Error('INVALID_FEEDBACK');
  const row=(await db.select('planning_feedback',`feedback_id=eq.${esc(feedbackId)}&select=document_id`))?.[0];if(!row)throw Error('NOT_FOUND');
  await db.rpc('code1_resolve_planning_feedback',{p_actor_id:actor.row.account_id,p_feedback_id:feedbackId,p_request_id:rid});
  return documentBundle(db,actor,profile,row.document_id);
}

async function productProfitBundle(db,profile){
  const rows=await db.select('planning_product_profit_models','status=eq.ACTIVE&order=updated_at.desc&select=model_id,product_name,unit_name,sales_channel,sale_price,purchase_cost,package_cost,shipping_cost,sales_fee,other_cost,monthly_units,note,current_revision,created_at,updated_at');
  return {models:rows||[],access:{canEdit:accessHas(profile,'PLANNING_EDIT')}};
}

export async function listProductProfitModels(env,principal,payload={},fetchImpl=fetch){
  const {db,profile}=await planningContext(env,principal,fetchImpl);
  return productProfitBundle(db,profile);
}

export async function saveProductProfitModel(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl,'PLANNING_EDIT');
  const rid=String(payload.requestId||''),modelId=clean(payload.id,160),productName=clean(payload.productName,160);
  const baseRevision=Number(payload.baseRevision??0),monthlyUnits=nonNegative(payload.monthlyUnits,'PRODUCT_PROFIT');
  if(!requestId(rid)||!productName||!Number.isInteger(baseRevision)||baseRevision<0||!Number.isInteger(monthlyUnits))throw Error('INVALID_PRODUCT_PROFIT');
  if(modelId&&!validId(modelId))throw Error('INVALID_PRODUCT_PROFIT');
  await db.rpc('code1_save_product_profit_model',{
    p_actor_id:actor.row.account_id,p_model_id:modelId||null,p_base_revision:baseRevision,
    p_product_name:productName,p_unit_name:clean(payload.unitName,80),p_sales_channel:clean(payload.salesChannel,160),
    p_sale_price:nonNegative(payload.salePrice,'PRODUCT_PROFIT'),p_purchase_cost:nonNegative(payload.purchaseCost,'PRODUCT_PROFIT'),
    p_package_cost:nonNegative(payload.packageCost,'PRODUCT_PROFIT'),p_shipping_cost:nonNegative(payload.shippingCost,'PRODUCT_PROFIT'),
    p_sales_fee:nonNegative(payload.salesFee,'PRODUCT_PROFIT'),p_other_cost:nonNegative(payload.otherCost,'PRODUCT_PROFIT'),
    p_monthly_units:monthlyUnits,p_note:clean(payload.note,4000),p_request_id:rid
  });
  return productProfitBundle(db,profile);
}

export async function archiveProductProfitModel(env,principal,payload={},fetchImpl=fetch){
  const {db,actor,profile}=await planningContext(env,principal,fetchImpl,'PLANNING_EDIT');
  const id=clean(payload.id,160),rid=String(payload.requestId||'');
  if(!validId(id)||!requestId(rid))throw Error('INVALID_PRODUCT_PROFIT');
  await db.rpc('code1_archive_product_profit_model',{p_actor_id:actor.row.account_id,p_model_id:id,p_request_id:rid});
  return productProfitBundle(db,profile);
}

export async function dispatchPlanningApi(env,principal,action,payload={},fetchImpl=fetch){
  switch(action){
    case 'factInbox.list':return listFactInbox(env,principal,payload,fetchImpl);
    case 'factInbox.create':return createFactInboxItem(env,principal,payload,fetchImpl);
    case 'factInbox.transition':return transitionFactInboxItem(env,principal,payload,fetchImpl);
    case 'executiveBrief.current':return getPublishedExecutiveBrief(env,principal,fetchImpl);
    case 'planning.document.current':return getPlanningDocument(env,principal,payload,fetchImpl);
    case 'planning.document.save':return savePlanningDocument(env,principal,payload,fetchImpl);
    case 'planning.feedback.add':return addPlanningFeedback(env,principal,payload,fetchImpl);
    case 'planning.feedback.resolve':return resolvePlanningFeedback(env,principal,payload,fetchImpl);
    case 'planning.profit.list':return listProductProfitModels(env,principal,payload,fetchImpl);
    case 'planning.profit.save':return saveProductProfitModel(env,principal,payload,fetchImpl);
    case 'planning.profit.archive':return archiveProductProfitModel(env,principal,payload,fetchImpl);
    default:throw Error('PLANNING_ACTION_NOT_IMPLEMENTED');
  }
}
