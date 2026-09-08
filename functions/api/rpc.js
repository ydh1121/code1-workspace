import { session, sameOrigin, bridge, json, failure } from '../_shared/security.js';
const actions = new Set(['bootstrap','saveSubmission','getSubmission','review','upload','linkDrive','reviewMedia','media','mediaBatch','deckAssets','saveDeck','questionPolicy.list','questionPolicy.save','mediaUpload.begin','mediaUpload.chunk','mediaUpload.finish','deleteMedia','mediaOrganizer.status','mediaOrganizer.repair']);
export async function onRequestPost({ request, env }) {
  try {
    sameOrigin(request, env); const user = await session(request, env);
    if (Number(request.headers.get('Content-Length')) > 12000000) return json({error:'TOO_LARGE',message:'요청 크기가 너무 큽니다. 고화질 원본은 자동 분할 업로드를 이용해 주세요.'},413);
    const raw = await request.text(); if (raw.length > 12000000) return json({error:'TOO_LARGE'},413);
    const { action, payload } = JSON.parse(raw); if (!actions.has(action)) return json({error:'UNKNOWN_ACTION'},400);
    const data = await bridge(env, user, action, payload || {});
    if (action === 'bootstrap') {
      try { data.questionPolicies = await bridge(env, user, 'questionPolicy.effective', {}); data.questionPolicyReady = true; }
      catch { data.questionPolicies = []; data.questionPolicyReady = false; }
    }
    return json({ data });
  } catch(e) { return failure(e); }
}
