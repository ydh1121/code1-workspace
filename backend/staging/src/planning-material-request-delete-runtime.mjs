import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';

const ridPattern=/^[a-f0-9]{32}$/;

export async function deletePlanningMaterialRequest(env,principal,payload={},fetchImpl=fetch){
  const db=createDb(env,fetchImpl);
  const actor=await loadActor(db,principal);
  if(actor?.row?.role!=='SUPER_ADMIN')throw Error('FORBIDDEN');
  const materialRequestId=String(payload.materialRequestId||'').trim();
  const confirmTitle=String(payload.confirmTitle||'').trim();
  const requestId=String(payload.requestId||'');
  if(!materialRequestId||!confirmTitle||!ridPattern.test(requestId))throw Error('INVALID_REQUEST');
  const result=await db.rpc('code1_material_delete_request',{
    p_actor_id:actor.row.account_id,
    p_material_request_id:materialRequestId,
    p_confirm_title:confirmTitle,
    p_request_id:requestId
  });
  return Array.isArray(result)?result[0]:result;
}

export function isPlanningMaterialRequestDeleteAction(action){
  return action==='planning.material.request.delete';
}
