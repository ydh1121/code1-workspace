export const PLANNING_DELTA_SEQ='20260910-001';

export const PLANNING_CAPABILITIES=Object.freeze({
  EXECUTIVE_BRIEF_VIEW:'EXECUTIVE_BRIEF_VIEW',
  FACT_SUBMIT:'FACT_SUBMIT',
  FACT_VERIFY:'FACT_VERIFY',
  FACT_APPROVE_CURRENT:'FACT_APPROVE_CURRENT'
});

export const FACT_STATUSES=Object.freeze([
  'RECEIVED','USER_REPORTED','PARTNER_REPORTED','EVIDENCE_REQUESTED',
  'DOCUMENT_RECEIVED','VERIFIED','APPROVED_CURRENT'
]);

const transitions=Object.freeze({
  RECEIVED:new Set(['USER_REPORTED','PARTNER_REPORTED']),
  USER_REPORTED:new Set(['EVIDENCE_REQUESTED']),
  PARTNER_REPORTED:new Set(['EVIDENCE_REQUESTED']),
  EVIDENCE_REQUESTED:new Set(['DOCUMENT_RECEIVED']),
  DOCUMENT_RECEIVED:new Set(['VERIFIED']),
  VERIFIED:new Set(['APPROVED_CURRENT']),
  APPROVED_CURRENT:new Set()
});

export function assertFactTransition(from,to){
  if(!transitions[from]?.has(to))throw Error('INVALID_FACT_TRANSITION');
  return true;
}

export function requiredFactCapability(toStatus){
  if(toStatus==='APPROVED_CURRENT')return PLANNING_CAPABILITIES.FACT_APPROVE_CURRENT;
  if(['EVIDENCE_REQUESTED','DOCUMENT_RECEIVED','VERIFIED'].includes(toStatus))return PLANNING_CAPABILITIES.FACT_VERIFY;
  return PLANNING_CAPABILITIES.FACT_SUBMIT;
}

export function normalizeHousingEnvironmentCode(value){
  const text=String(value??'').trim();
  if(!/^[1-4]$/.test(text))return null;
  return Number(text);
}

export function housingEnvironmentSourceRecord(farm){
  const sourceValue=String(farm?.['사육환경번호']??'').trim();
  return {
    record_id:`HER_FARM_${String(farm?.farm_id||'').trim()}`,
    farm_id:String(farm?.farm_id||'').trim(),
    subject_type:'FARM',
    subject_id:String(farm?.farm_id||'').trim(),
    housing_environment_code:normalizeHousingEnvironmentCode(sourceValue),
    source_value:sourceValue||null,
    verification_status:'UNCONFIRMED',
    evidence_ref:null,
    source_system:'GOOGLE_SHEET',
    source_ref:'01_농가_Master.사육환경번호',
    is_current:true
  };
}

function safeSegment(value,fallback='artifact'){
  const text=String(value||fallback).normalize('NFKC').replace(/[\\/\u0000-\u001f]/g,'-').replace(/\.\.+/g,'.').trim();
  return (text||fallback).slice(0,180);
}

export function privatePlanningObjectKey(artifactId,fileName){
  return `private/planning/${safeSegment(artifactId,'artifact')}/${safeSegment(fileName,'source')}`;
}

export function assertPrivatePlanningArtifact(artifact){
  if(artifact?.public_delivery_allowed===true)throw Error('CONFIDENTIAL_PUBLIC_DELIVERY_FORBIDDEN');
  if(artifact?.object_key&&!String(artifact.object_key).startsWith('private/planning/'))throw Error('CONFIDENTIAL_OBJECT_KEY_REQUIRED');
  return true;
}
