import { session, sameOrigin, bridge, json, failure } from '../_shared/security.js';
import { dispatchCode1Staging } from '../../backend/staging/src/staging-dispatch.mjs';
import { useSupabaseStaging } from '../../backend/staging/src/runtime-mode.mjs';

const materialActions=[
  'planning.material.bootstrap','planning.material.request.get','planning.material.template.save','planning.material.template.publish',
  'planning.material.request.create','planning.material.request.delete','planning.material.request.assign','planning.material.item.update',
  'planning.material.review','planning.material.request.submit','planning.material.manifest',
  'planning.material.upload.begin','planning.material.upload.chunk','planning.material.upload.finish','planning.material.file.read'
];
const actions = new Set([
  'bootstrap','saveSubmission','getSubmission','review','upload','linkDrive','reviewMedia','media','mediaBatch',
  'deckAssets','deckBootstrap','saveDeck','questionPolicy.list','questionPolicy.save',
  'mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair',
  'factInbox.list','factInbox.create','factInbox.transition','executiveBrief.current',
  'planning.document.current','planning.document.save','planning.feedback.add','planning.feedback.resolve',
  'planning.profit.list','planning.profit.save','planning.profit.archive',
  'admin.overview','admin.audit','admin.access.list','admin.access.save','admin.farm.delete','admin.account.delete',
  'admin.ops.events','admin.ops.review','admin.ops.capacity.report','admin.ops.retention.dryRun','admin.ops.qa.fixture.create','admin.ops.qa.fixture.cleanup',
  ...materialActions
]);
const stagingOnlyActions=new Set([
  'admin.ops.capacity.report','admin.ops.retention.dryRun','admin.ops.qa.fixture.create','admin.ops.qa.fixture.cleanup',
  ...materialActions
]);

function stagingOwns(){return true;}

export async function onRequestPost({ request, env }) {
  try {
    sameOrigin(request, env); const user = await session(request, env);
    if (Number(request.headers.get('Content-Length')) > 12000000) return json({error:'TOO_LARGE',message:'요청 크기가 너무 큽니다. 고화질 원본은 분할 업로드를 이용해 주세요.'},413);
    const raw = await request.text(); if (raw.length > 12000000) return json({error:'TOO_LARGE'},413);
    const { action, payload } = JSON.parse(raw); if (!actions.has(action)) return json({error:'UNKNOWN_ACTION'},400);
    const body=payload||{};
    if(stagingOnlyActions.has(action)&&!useSupabaseStaging(env)){
      if(action.startsWith('planning.material.'))throw Error('PLANNING_MATERIAL_STAGING_ONLY');
      throw Error(action.startsWith('admin.ops.qa.')?'OWNER_QA_STAGING_ONLY':'OPS_RETENTION_STAGING_ONLY');
    }
    let data;
    // No farm-runtime fallback here: Supabase STAGING owns its selected runtime path and fails closed.
    if(useSupabaseStaging(env)&&stagingOwns(action,body))data=await dispatchCode1Staging(env,user,action,body);
    else data=await bridge(env, user, action, body);
    return json({ data });
  } catch(e) { return failure(e); }
}
