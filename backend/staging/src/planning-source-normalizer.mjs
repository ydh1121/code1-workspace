import {housingEnvironmentSourceRecord} from './planning-contract.mjs';

export function normalizePlanningSource(source){
  const farms=(source?.farms||[]).filter(row=>String(row?.farm_id||'').trim());
  const housingEnvironmentRecords=farms.map(housingEnvironmentSourceRecord);
  return {
    housingEnvironmentRecords,
    facts:[],
    planningBriefVersions:[],
    planningSourceArtifacts:[]
  };
}

export function verifyPlanningNormalized(normalized){
  const errors=[];
  const ids=new Set();
  for(const row of normalized?.housingEnvironmentRecords||[]){
    if(!row.record_id||!row.farm_id||!row.subject_id)errors.push('housing environment record missing stable identity');
    if(ids.has(row.record_id))errors.push(`duplicate housing environment record ${row.record_id}`);
    ids.add(row.record_id);
    if(row.housing_environment_code!==null&&![1,2,3,4].includes(row.housing_environment_code))errors.push(`invalid housing environment code ${row.record_id}`);
    if(row.verification_status!=='UNCONFIRMED')errors.push(`source migration must not auto-verify ${row.record_id}`);
  }
  return {ok:errors.length===0,errors,counts:{housingEnvironmentRecords:normalized?.housingEnvironmentRecords?.length||0,facts:normalized?.facts?.length||0,planningBriefVersions:normalized?.planningBriefVersions?.length||0,planningSourceArtifacts:normalized?.planningSourceArtifacts?.length||0}};
}
