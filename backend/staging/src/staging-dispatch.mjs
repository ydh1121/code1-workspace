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

// WO-20260912-CODING-DECK-001 requires read-path proof before any STAGING Deck write is enabled.
// This gate is deliberately code-locked for the read-cutover deployment and is opened only after
// live Preview deckBootstrap/deckAssets + private R2 read verification passes.
export const DECK_WRITE_GATE_OPEN=false;

function isDeckAuxWrite(action,payload={}){
  return (action==='upload'||action==='linkDrive')&&payload?.kind==='DECK';
}

async function dispatchDeckAction(env,principal,action,payload,fetchImpl){
  switch(action){
    case 'deckAssets': return deckAssets(env,principal,fetchImpl);
    case 'deckBootstrap': return deckBootstrap(env,principal,fetchImpl);
    case 'saveDeck':
      if(!DECK_WRITE_GATE_OPEN)throw Error('DECK_WRITE_GATE_CLOSED');
      return saveDeck(env,principal,payload,fetchImpl);
    default: throw Error('STAGING_DECK_ACTION_NOT_IMPLEMENTED');
  }
}

export async function dispatchCode1Staging(env,principal,action,payload={},fetchImpl=fetch){
  if(isDeckAuxWrite(action,payload))throw Error('DECK_WRITE_GATE_CLOSED');
  if(PLANNING_ACTIONS.has(action))return dispatchPlanningApi(env,principal,action,payload,fetchImpl);
  if(DECK_ACTIONS.has(action))return dispatchDeckAction(env,principal,action,payload,fetchImpl);
  if(isMediaUploadAction(action,payload))return dispatchMediaUpload(env,principal,action,payload,fetchImpl);
  return dispatchStagingRpc(env,principal,action,payload,fetchImpl);
}

export function isPlanningAction(action){return PLANNING_ACTIONS.has(action);}
export function isDeckAction(action){return DECK_ACTIONS.has(action);}
export function isDeckAuxiliaryWrite(action,payload={}){return isDeckAuxWrite(action,payload);}
