import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {issueMediaReadToken} from './media-read.mjs';
import {DECK_ID,DECK_STATUS,validateDeck,collectDeckAssetRefs,prepareDeckSave} from './deck-contract.mjs';
import {resolveWorkspaceAccess,requireWorkspaceAccess,effectiveUserPermissions} from './workspace-access.mjs';

const esc=encodeURIComponent;
const ASSET_ERROR='이미지 접근 또는 사용권 기록을 확인해 주세요.';

function deckLevel(actor){return String(actor?.user?.permissions?.deck||'none');}
function assertDeckRead(actor){if(!['view','edit'].includes(deckLevel(actor)))throw Error('FORBIDDEN');}
function assertDeckEdit(actor){if(deckLevel(actor)!=='edit')throw Error('FORBIDDEN');}

function sameInstant(a,b){
  const x=Date.parse(String(a||'')),y=Date.parse(String(b||''));
  return Number.isFinite(x)&&Number.isFinite(y)&&x===y;
}

export async function sha256Base64Url(text){
  const bytes=new TextEncoder().encode(String(text));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  let binary='';
  for(let i=0;i<digest.length;i++)binary+=String.fromCharCode(digest[i]);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function currentDeckRecord(db){
  const docs=await db.select('deck_documents',`deck_id=eq.${esc(DECK_ID)}&select=deck_id,current_revision_id,current_version,version_label,status,updated_at`);
  const doc=docs?.[0];
  if(!doc||!doc.current_revision_id)throw Error('NOT_FOUND');
  const revisions=await db.select('deck_revisions',`revision_id=eq.${esc(doc.current_revision_id)}&deck_id=eq.${esc(DECK_ID)}&state=eq.COMMITTED&select=revision_id,deck_id,version,version_label,status,payload_text,content_hash,saved_by_snapshot,saved_at,state`);
  const revision=revisions?.[0];
  if(!revision)throw Error('DECK_REVISION_INCOMPLETE');
  return {doc,revision};
}

export async function readDeckBundleWithContext({db,actor,env,tokenIssuer=issueMediaReadToken}){
  assertDeckRead(actor);
  const {doc,revision}=await currentDeckRecord(db);
  const payloadText=String(revision.payload_text||'');
  if(!payloadText||await sha256Base64Url(payloadText)!==String(revision.content_hash||''))throw Error('DECK_REVISION_INCOMPLETE');

  let deck;
  try{deck=JSON.parse(payloadText);validateDeck(deck);}catch{throw Error('DECK_REVISION_INCOMPLETE');}
  if(deck.deck_id!==DECK_ID||deck.status!==DECK_STATUS)throw Error('DECK_REVISION_INCOMPLETE');
  if(Number(deck.version)!==Number(revision.version)||Number(deck.version)!==Number(doc.current_version))throw Error('DECK_REVISION_INCOMPLETE');
  if(String(deck.version_label)!==String(revision.version_label)||String(deck.version_label)!==String(doc.version_label))throw Error('DECK_REVISION_INCOMPLETE');
  if(!sameInstant(deck.updated_at,revision.saved_at)||!sameInstant(doc.updated_at,revision.saved_at))throw Error('DECK_REVISION_INCOMPLETE');
  if(String(deck.saved_by||'')!==String(revision.saved_by_snapshot||''))throw Error('DECK_REVISION_INCOMPLETE');

  const refs=collectDeckAssetRefs(deck);
  const rows=refs.length
    ? await db.select('deck_assets',`deck_id=eq.${esc(DECK_ID)}&state=eq.ACTIVE&asset_id=in.(${refs.map(esc).join(',')})&select=asset_id,deck_id,object_key,mime_type,file_size_bytes,checksum_sha256,source_kind,source_ref,rights_status,usage_note,review_note,state`)
    : [];
  const byId=new Map((rows||[]).map(row=>[row.asset_id,row]));
  const assets={};

  await Promise.all(refs.map(async ref=>{
    try{
      const row=byId.get(ref);
      if(!row||row.deck_id!==DECK_ID||row.state!=='ACTIVE'||!row.object_key)throw Error('NOT_FOUND');
      if(!env?.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
      const head=await env.CODE1_MEDIA_BUCKET.head(row.object_key);
      if(!head||Number(head.size)!==Number(row.file_size_bytes))throw Error('R2_OBJECT_MISMATCH');
      const token=await tokenIssuer(env,{accountId:actor.row.account_id,mediaId:row.asset_id,objectKey:row.object_key,mimeType:row.mime_type});
      assets[ref]={
        url:`/api/staging/media-get?token=${encodeURIComponent(token)}`,
        source:row.source_ref||'',
        rights_status:row.rights_status||'',
        usage:row.usage_note||'',
        note:row.review_note||''
      };
    }catch{
      assets[ref]={error:ASSET_ERROR};
    }
  }));

  return {deck,assets,canEditDeck:deckLevel(actor)==='edit'};
}

export async function saveDeckWithContext({db,actor,payload,now=()=>new Date().toISOString()}){
  assertDeckEdit(actor);
  const requestId=String(payload?.requestId||'');
  if(!/^[a-f0-9]{32}$/.test(requestId))throw Error('INVALID_REQUEST');
  const summary=String(payload?.summary??'');
  if(summary.length>1000)throw Error('INVALID_SUMMARY');
  const baseVersion=Number(payload?.baseVersion);
  if(!Number.isInteger(baseVersion)||baseVersion<0)throw Error('INVALID_DECK_VERSION');

  const pre=validateDeck(payload?.deck);
  if(pre.deck_id!==DECK_ID)throw Error('INVALID_DECK');
  const nextVersion=baseVersion+1;
  const versionLabel=payload?.newVersion===true?`v0.${nextVersion}`:pre.version_label;
  const savedAt=String(now());
  const savedBy=String(actor?.row?.email||actor?.row?.username||'');
  const prepared=prepareDeckSave(payload.deck,{nextVersion,versionLabel,savedAt,savedBy});

  const result=await db.rpc('code1_save_deck',{
    p_actor_id:actor.row.account_id,
    p_deck_id:DECK_ID,
    p_base_version:baseVersion,
    p_new_version:payload?.newVersion===true,
    p_summary:summary,
    p_request_id:requestId,
    p_payload_text:prepared.payloadText,
    p_asset_refs:prepared.assetRefs
  });
  const row=result?.[0];
  if(!row)throw Error('DECK_SAVE_FAILED');
  return {version:Number(row.version),versionLabel:String(row.version_label||versionLabel),savedAt:String(row.saved_at||savedAt)};
}

async function deckActor(db,principal,edit=false){
  const actor=await loadActor(db,principal),access=await resolveWorkspaceAccess(db,actor);
  requireWorkspaceAccess(access,'PAGE_DECK');
  if(edit)requireWorkspaceAccess(access,'DECK_EDIT');
  const permissions=effectiveUserPermissions(actor,access);
  return {...actor,user:{...actor.user,permissions}};
}

export async function deckBootstrap(env,principal,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await deckActor(db,principal,false);
  return readDeckBundleWithContext({db,actor,env});
}

export async function deckAssets(env,principal,fetchImpl=fetch){
  return (await deckBootstrap(env,principal,fetchImpl)).assets;
}

export async function saveDeck(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await deckActor(db,principal,true);
  return saveDeckWithContext({db,actor,payload});
}
