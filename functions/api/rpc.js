import { session, sameOrigin, bridge, json, failure } from '../_shared/security.js';
import { dispatchCode1Staging } from '../../backend/staging/src/staging-dispatch.mjs';
import { useSupabaseStaging } from '../../backend/staging/src/runtime-mode.mjs';

const actions = new Set([
  'bootstrap','saveSubmission','getSubmission','review','upload','linkDrive','reviewMedia','media','mediaBatch',
  'deckAssets','deckBootstrap','saveDeck','deckMigration.importSource20260912','questionPolicy.list','questionPolicy.save',
  'mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair',
  'factInbox.list','factInbox.create','factInbox.transition','executiveBrief.current'
]);
const legacyDeckActions=new Set(['deckAssets','deckBootstrap','saveDeck']);

function stagingOwns(action,payload){
  if(legacyDeckActions.has(action))return false;
  if((action==='upload'||action==='linkDrive')&&payload?.kind==='DECK')return false;
  return true;
}

export async function onRequestPost({ request, env }) {
  try {
    sameOrigin(request, env); const user = await session(request, env);
    if (Number(request.headers.get('Content-Length')) > 12000000) return json({error:'TOO_LARGE',message:'요청 크기가 너무 큽니다. 고화질 원본은 직접 원본 업로드를 이용해 주세요.'},413);
    const raw = await request.text(); if (raw.length > 12000000) return json({error:'TOO_LARGE'},413);
    const { action, payload } = JSON.parse(raw); if (!actions.has(action)) return json({error:'UNKNOWN_ACTION'},400);
    const body=payload||{};
    let data;
    if(useSupabaseStaging(env)&&stagingOwns(action,body)){
      // No farm-runtime fallback here. Once the isolated staging flag is enabled,
      // a missing staging action must fail instead of silently dual-writing to Sheets.
      data=await dispatchCode1Staging(env,user,action,body);
    }else{
      // Deck editing remains on the existing isolated legacy domain until source import/readback closes.
      data=await bridge(env, user, action, body);
    }
    return json({ data });
  } catch(e) { return failure(e); }
}
