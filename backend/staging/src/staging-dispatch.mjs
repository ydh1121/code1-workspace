import {dispatchStagingRpc} from './rpc-adapter.mjs';
import {dispatchPlanningApi} from './planning-api.mjs';
import {dispatchMediaUpload,isMediaUploadAction} from './media-upload-runtime.mjs';

const PLANNING_ACTIONS=new Set([
  'factInbox.list',
  'factInbox.create',
  'factInbox.transition',
  'executiveBrief.current'
]);

export async function dispatchCode1Staging(env,principal,action,payload={},fetchImpl=fetch){
  if(PLANNING_ACTIONS.has(action))return dispatchPlanningApi(env,principal,action,payload,fetchImpl);
  if(isMediaUploadAction(action,payload))return dispatchMediaUpload(env,principal,action,payload,fetchImpl);
  return dispatchStagingRpc(env,principal,action,payload,fetchImpl);
}

export function isPlanningAction(action){return PLANNING_ACTIONS.has(action);}
