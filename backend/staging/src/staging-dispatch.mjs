import {dispatchStagingRpc} from './rpc-adapter.mjs';
import {dispatchPlanningApi} from './planning-api.mjs';
import {dispatchMediaUpload,isMediaUploadAction} from './media-upload-runtime.mjs';
import {deckBootstrap,deckAssets,saveDeck} from './deck-runtime.mjs';

const PLANNING_ACTIONS=new Set([
  'factInbox.list',
  'factInbox.create',
  'factInbox.transition',
  'executiveBrief.current'
]);

const DECK_ACTIONS=new Set([
  'deckAssets',
  'deckBootstrap',
  'saveDeck'
]);

async function dispatchDeckAction(env,principal,action,payload,fetchImpl){
  switch(action){
    case 'deckAssets': return deckAssets(env,principal,fetchImpl);
    case 'deckBootstrap': return deckBootstrap(env,principal,fetchImpl);
    case 'saveDeck': return saveDeck(env,principal,payload,fetchImpl);
    default: throw Error('STAGING_DECK_ACTION_NOT_IMPLEMENTED');
  }
}

export async function dispatchCode1Staging(env,principal,action,payload={},fetchImpl=fetch){
  if(PLANNING_ACTIONS.has(action))return dispatchPlanningApi(env,principal,action,payload,fetchImpl);
  if(DECK_ACTIONS.has(action))return dispatchDeckAction(env,principal,action,payload,fetchImpl);
  if(isMediaUploadAction(action,payload))return dispatchMediaUpload(env,principal,action,payload,fetchImpl);
  return dispatchStagingRpc(env,principal,action,payload,fetchImpl);
}

export function isPlanningAction(action){return PLANNING_ACTIONS.has(action);}
export function isDeckAction(action){return DECK_ACTIONS.has(action);}
