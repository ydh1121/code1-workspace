import {dispatchStagingRpc} from './rpc-adapter.mjs';
import {dispatchPlanningApi} from './planning-api.mjs';
import {dispatchAdminOps} from './admin-ops.mjs';
import {dispatchMediaUpload,isMediaUploadAction} from './media-upload-runtime.mjs';
import {deckBootstrap,deckAssets,saveDeck} from './deck-runtime.mjs';
import {uploadDeckAsset,getDeckMediaMaybe} from './deck-media-runtime.mjs';

const PLANNING_ACTIONS=new Set([
  'factInbox.list',
  'factInbox.create',
  'factInbox.transition',
  'executiveBrief.current',
  'planning.document.current',
  'planning.document.save',
  'planning.feedback.add',
  'planning.feedback.resolve'
]);

const ADMIN_ACTIONS=new Set([
  'admin.overview',
  'admin.audit',
  'admin.access.list',
  'admin.access.save',
  'admin.farm.delete',
  'admin.account.delete'
]);

const DECK_ACTIONS=new Set([
  'deckAssets',
  'deckBootstrap',
  'saveDeck'
]);

// PHASE C live Preview read verification passed on 2026-09-12.
// PHASE D opens only STAGING-native Deck save and direct private-R2 image upload.
export const DECK_WRITE_GATE_OPEN=true;
export const DECK_DRIVE_LINK_ENABLED=false;

function isDeckUpload(action,payload={}){return action==='upload'&&payload?.kind==='DECK';}
function isDeckDriveLink(action,payload={}){return action==='linkDrive'&&payload?.kind==='DECK';}

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
  if(isDeckDriveLink(action,payload))throw Error('DECK_DRIVE_LINK_DISABLED');
  if(isDeckUpload(action,payload)){
    if(!DECK_WRITE_GATE_OPEN)throw Error('DECK_WRITE_GATE_CLOSED');
    return uploadDeckAsset(env,principal,payload,fetchImpl);
  }
  if(action==='media'){
    const deckMedia=await getDeckMediaMaybe(env,principal,payload,fetchImpl);
    if(deckMedia)return deckMedia;
  }
  if(ADMIN_ACTIONS.has(action))return dispatchAdminOps(env,principal,action,payload,fetchImpl);
  if(PLANNING_ACTIONS.has(action))return dispatchPlanningApi(env,principal,action,payload,fetchImpl);
  if(DECK_ACTIONS.has(action))return dispatchDeckAction(env,principal,action,payload,fetchImpl);
  if(isMediaUploadAction(action,payload))return dispatchMediaUpload(env,principal,action,payload,fetchImpl);
  return dispatchStagingRpc(env,principal,action,payload,fetchImpl);
}

export function isPlanningAction(action){return PLANNING_ACTIONS.has(action);}
export function isAdminAction(action){return ADMIN_ACTIONS.has(action);}
export function isDeckAction(action){return DECK_ACTIONS.has(action);}
export function isDeckUploadAction(action,payload={}){return isDeckUpload(action,payload);}
export function isDeckDriveLinkAction(action,payload={}){return isDeckDriveLink(action,payload);}
