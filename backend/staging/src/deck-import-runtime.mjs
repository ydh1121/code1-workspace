import {createDb} from './db.mjs';
import {loadActor} from './authz.mjs';
import {DECK_ID,DECK_STATUS,validateDeck,collectDeckAssetRefs} from './deck-contract.mjs';
import {sha256Base64Url} from './deck-runtime.mjs';

const WORK_ORDER='WO-20260912-CODING-DECK-001';
const PROJECT_REF='bsintmkyhptizrjoizfb';
const BUCKET='code1-staging-media';
const BUNDLE_SHA256='9b525246b9770d8d42b21e8de5ab405a38e8e940a06f0204088845005e737f3e';

const A=(asset_id,object_key,mime_type,file_size_bytes,checksum_sha256,source_kind,source_ref,rights_status,usage_note,review_note,request_id)=>({asset_id,object_key,mime_type,file_size_bytes,checksum_sha256,source_kind,source_ref,rights_status,usage_note,review_note,request_id});
const EXPECTED_ASSETS=[
  A('M_35f86cfcbc9f4c93aa6870ac','private/decks/CODE1_AZA_INTERNAL/assets/M_35f86cfcbc9f4c93aa6870ac/original.jpg','image/jpeg',228502,'b6ca69b8e389fa1523cac1c0fc31e2c7369f7b780028746cdf4f807e898d9fac','LEGACY_DRIVE','1BzpFao2iMPQnSqB_IOYDsFTCBTQfK9_c','REVIEW_REQUIRED','미확인','업로드는 사용권 승인이 아닙니다.','6905e91865bbbacac4d9297692034955'),
  A('asset_114348','private/decks/CODE1_AZA_INTERNAL/assets/asset_114348/original.webp','image/webp',12356,'a708f1c8041275565bb7d51743de33ed42a2ac10a1cc1929e93a776649a6b914','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/114348.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','eb10ac3ddf439d46fbc5cc8c161a297d'),
  A('asset_388585','private/decks/CODE1_AZA_INTERNAL/assets/asset_388585/original.webp','image/webp',8872,'ba83fe016ee327c6e8f3efb8fc81c7e05f1098fd7b39e3747169a05e27a5b68d','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/388585.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','e75ccf645babc4f17a0a1b64e4935d8b'),
  A('asset_409271','private/decks/CODE1_AZA_INTERNAL/assets/asset_409271/original.webp','image/webp',10520,'35605e96b6506d77d548888e34431b154cb945df4162a194e9e517d38033bdf0','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/409271.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','8ebe3ff3c6c5df63124b5e3ce7be1df1'),
  A('asset_48223','private/decks/CODE1_AZA_INTERNAL/assets/asset_48223/original.webp','image/webp',14000,'dcb7a35e4ac43708aee43e6236d5489707f97a192f6969fdcb96c6153fd5a7c8','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/48223.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','d934ab9de0b3bc35d980f0c34a72fa7e'),
  A('asset_651917','private/decks/CODE1_AZA_INTERNAL/assets/asset_651917/original.webp','image/webp',31046,'6b374cb6d50b096bc2c38928d76dba65b5065f75c735cd89b9358c78f04bcbfe','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/651917.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','9c59b9d239ba1565a0f2b2a1ce1b0b4a'),
  A('asset_656360','private/decks/CODE1_AZA_INTERNAL/assets/asset_656360/original.webp','image/webp',20690,'1c9ce8d90020dcded1222abaae5c41c6b35510d9f47f57451c8da3782cb57289','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/656360.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','5958283baaf69f41af9101ad91deb537'),
  A('asset_657342','private/decks/CODE1_AZA_INTERNAL/assets/asset_657342/original.webp','image/webp',10494,'fc5cbbf82f909d2776d73ef8bfcdaad79650f1dde1845b60079276b04ee296e0','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/657342.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','768d913614eb4ce9996d740fc4d96a46'),
  A('asset_661254','private/decks/CODE1_AZA_INTERNAL/assets/asset_661254/original.webp','image/webp',13180,'3cfed1c7b630a8c7b6671521a73222ee5b129505c7f43c574e2cdff257f1afbc','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/products/661254.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','아자몰 기존 상품 · CODE1 상품 이미지가 아님','e0dd42cfb2619b9cc645a05582239931'),
  A('asset_farm','private/decks/CODE1_AZA_INTERNAL/assets/asset_farm/original.webp','image/webp',132278,'523152f50c8c3d28f34d3b0ccc1f5b0f0be0a272ce81782cd6675996c7787ea5','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/internal/farm.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 내부 현장 이미지','cd5701815c5602167b2632aefdaef30c'),
  A('asset_grass','private/decks/CODE1_AZA_INTERNAL/assets/asset_grass/original.webp','image/webp',115800,'625418dc316d384d808242706b3c52c2ea085ad23ba505c829da4b6167200c03','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/ref/grass.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 참고 디자인 자산','7a4c97cb4a2ae8bfb2b4de2e6772f1c4'),
  A('asset_handshake','private/decks/CODE1_AZA_INTERNAL/assets/asset_handshake/original.webp','image/webp',133754,'9227053acf1a827b07de01f55398ee341fee78cad605c77f93e429fdad7f9491','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/ref/handshake.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 참고 디자인 자산','e8f7792fe2fe1c7cbc6267f17cee1e1a'),
  A('asset_sky','private/decks/CODE1_AZA_INTERNAL/assets/asset_sky/original.webp','image/webp',57740,'9baa475728ad5ed1333ae4336fbe79b82e0e53c7978e61889df679ecd4856582','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/ref/sky.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 참고 디자인 자산','86d6cfb9d82a0856fee3dd525b051c31'),
  A('asset_sorting_main','private/decks/CODE1_AZA_INTERNAL/assets/asset_sorting_main/original.webp','image/webp',131886,'a3e850f0cb2a385ce352f703ba3e70ed5a3d32798bc479cf5bdb833333e37575','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/internal/sorting-main.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 내부 현장 이미지','b88fa2361acbae3d2e6bf9fbd08a48c2'),
  A('asset_sorting_wide','private/decks/CODE1_AZA_INTERNAL/assets/asset_sorting_wide/original.webp','image/webp',211874,'81036d587efbac5ebc87374855dbc4abfd1fc458971f65fef241bf72b73746c5','SEED_EMBEDDED','CURRENT v0.2 HTML webdeck / assets/internal/sorting-wide.webp','INTERNAL_REFERENCE_REVIEW_REQUIRED','내부 디자인 작업 참고. 외부 제출 전 기존 이미지 규정 재검토.','기존 내부 현장 이미지','4bc9a19c4aafc35976ac1250ac8ab68a')
];
const EXPECTED_ASSET_IDS=EXPECTED_ASSETS.map(x=>x.asset_id).sort();
const EXPECTED_REVISIONS=[
  {revision_id:'R_b0a1887f67b940f58c626669',version:1,version_label:'v0.1',saved_at:'2026-09-06T18:30:24.125Z',saved_by_snapshot:'master.solly.art@gmail.com',change_summary:'현재 작업본 수정',request_id:'42aae0d78334403b9cc0fb44d6f597dc',content_hash:'9i5dZQvE_YRCUbRyDVY9p8lYVlyPJXVYDGKyxHpGIeM',make_current:false},
  {revision_id:'R_82aeeccce12c4f4381934a7a',version:2,version_label:'v0.1',saved_at:'2026-09-07T16:52:10.299Z',saved_by_snapshot:'master.solly.art@gmail.com',change_summary:'현재 작업본 수정',request_id:'2d0b4c69181d4422b8b44d51ec80e86b',content_hash:'VeMG4FmTIMCr-jfNquPaC4tNhJLizzaS3mlwGvNT5gY',make_current:true}
];

const exact=(a,b)=>String(a??'')===String(b??'');
function assertOwner(actor){if(actor?.row?.account_id!=='OWNER'||actor?.row?.role!=='SUPER_ADMIN')throw Error('FORBIDDEN');}
function assertEnvelope(payload){
  if(!payload||payload.workOrder!==WORK_ORDER||payload.target!=='CODE1 STAGING ONLY'||payload.projectRef!==PROJECT_REF||payload.bucket!==BUCKET||payload.deckId!==DECK_ID||payload.bundleSha256!==BUNDLE_SHA256)throw Error('DECK_IMPORT_ENVELOPE_MISMATCH');
  if(!Array.isArray(payload.assets)||payload.assets.length!==EXPECTED_ASSETS.length||!Array.isArray(payload.revisions)||payload.revisions.length!==2)throw Error('DECK_IMPORT_COUNT_MISMATCH');
}
function assertAsset(actual,expected){
  for(const key of ['asset_id','object_key','mime_type','file_size_bytes','checksum_sha256','source_kind','source_ref','rights_status','usage_note','review_note','request_id'])if(!exact(actual?.[key],expected[key]))throw Error(`DECK_IMPORT_ASSET_MISMATCH:${expected.asset_id}:${key}`);
}
function assertRevisionMeta(actual,expected){
  for(const key of ['revision_id','version','version_label','saved_at','saved_by_snapshot','change_summary','request_id','content_hash','make_current'])if(!exact(actual?.[key],expected[key]))throw Error(`DECK_IMPORT_REVISION_MISMATCH:${expected.revision_id}:${key}`);
  if(typeof actual?.payloadText!=='string'||actual.payloadText.length<2)throw Error('DECK_IMPORT_PAYLOAD_REQUIRED');
}
async function sha256Hex(bytes){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...digest].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifyDeckImportR2Asset(env,expected){
  if(!env?.CODE1_MEDIA_BUCKET)throw Error('R2_BINDING_REQUIRED');
  const object=await env.CODE1_MEDIA_BUCKET.get(expected.object_key);
  if(!object)throw Error(`DECK_IMPORT_R2_MISSING:${expected.asset_id}`);
  const bytes=await object.arrayBuffer();
  if(bytes.byteLength!==expected.file_size_bytes)throw Error(`DECK_IMPORT_R2_SIZE_MISMATCH:${expected.asset_id}`);
  const hash=await sha256Hex(bytes);
  if(hash!==expected.checksum_sha256)throw Error(`DECK_IMPORT_R2_HASH_MISMATCH:${expected.asset_id}`);
  return true;
}

export async function importDeckSourceWithContext({db,actor,env,payload,r2Verifier=verifyDeckImportR2Asset}){
  assertOwner(actor); assertEnvelope(payload);
  const byAsset=new Map(payload.assets.map(a=>[a?.asset_id,a]));
  for(const expected of EXPECTED_ASSETS){
    const actual=byAsset.get(expected.asset_id); assertAsset(actual,expected);
    await r2Verifier(env,expected);
    const p_asset={...expected,deck_id:DECK_ID,metadata:{migration_work_order:WORK_ORDER,source_bundle_sha256:BUNDLE_SHA256,relative_file:String(actual.relative_file||'')}};
    delete p_asset.request_id;
    await db.rpc('code1_register_deck_asset',{p_actor_id:'OWNER',p_request_id:expected.request_id,p_asset});
  }

  for(let i=0;i<EXPECTED_REVISIONS.length;i++){
    const expected=EXPECTED_REVISIONS[i],actual=payload.revisions[i]; assertRevisionMeta(actual,expected);
    const hash=await sha256Base64Url(actual.payloadText); if(hash!==expected.content_hash)throw Error(`DECK_CONTENT_HASH_MISMATCH:${expected.revision_id}`);
    let parsed;try{parsed=JSON.parse(actual.payloadText);}catch{throw Error('INVALID_DECK');}
    validateDeck(parsed);
    if(parsed.deck_id!==DECK_ID||parsed.status!==DECK_STATUS||Number(parsed.version)!==expected.version||parsed.version_label!==expected.version_label||parsed.updated_at!==expected.saved_at||parsed.saved_by!==expected.saved_by_snapshot)throw Error(`DECK_IMPORT_PAYLOAD_META_MISMATCH:${expected.revision_id}`);
    const refs=collectDeckAssetRefs(parsed); if(JSON.stringify(refs)!==JSON.stringify(EXPECTED_ASSET_IDS))throw Error(`DECK_IMPORT_MEDIA_REF_MISMATCH:${expected.revision_id}`);
    await db.rpc('code1_import_deck_revision',{
      p_actor_id:'OWNER',p_revision_id:expected.revision_id,p_deck_id:DECK_ID,p_version:expected.version,p_version_label:expected.version_label,
      p_payload_text:actual.payloadText,p_content_hash:expected.content_hash,p_saved_by_snapshot:expected.saved_by_snapshot,p_saved_at:expected.saved_at,
      p_change_summary:expected.change_summary,p_request_id:expected.request_id,p_asset_refs:EXPECTED_ASSET_IDS,p_make_current:expected.make_current
    });
  }

  const docs=await db.select('deck_documents',`deck_id=eq.${encodeURIComponent(DECK_ID)}&select=deck_id,current_revision_id,current_version,version_label,status,updated_at`);
  const revisions=await db.select('deck_revisions',`deck_id=eq.${encodeURIComponent(DECK_ID)}&select=revision_id,version,version_label,content_hash,saved_at,source_kind,state&order=version.asc`);
  const links=await db.select('deck_revision_assets','select=revision_id,asset_id');
  const doc=docs?.[0];
  if(!doc||doc.current_revision_id!==EXPECTED_REVISIONS[1].revision_id||Number(doc.current_version)!==2)throw Error('DECK_IMPORT_CURRENT_POINTER_MISMATCH');
  if((revisions||[]).length!==2||(links||[]).filter(x=>EXPECTED_REVISIONS.some(r=>r.revision_id===x.revision_id)).length!==30)throw Error('DECK_IMPORT_READBACK_COUNT_MISMATCH');
  for(const expected of EXPECTED_REVISIONS){const r=(revisions||[]).find(x=>x.revision_id===expected.revision_id);if(!r||Number(r.version)!==expected.version||r.content_hash!==expected.content_hash||r.source_kind!=='LEGACY_IMPORT'||r.state!=='COMMITTED')throw Error(`DECK_IMPORT_READBACK_MISMATCH:${expected.revision_id}`);}
  return {pass:true,deckId:DECK_ID,assetCount:15,revisionCount:2,revisionAssetLinks:30,currentRevisionId:doc.current_revision_id,currentVersion:Number(doc.current_version),bundleSha256:BUNDLE_SHA256,productionMutation:'NONE',liveSourceMutation:'NONE'};
}

export async function importDeckSource(env,principal,payload,fetchImpl=fetch){
  const db=createDb(env,fetchImpl),actor=await loadActor(db,principal);
  return importDeckSourceWithContext({db,actor,env,payload});
}

export const DECK_IMPORT_ACTION='deckMigration.importSource20260912';
