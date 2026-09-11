import test from 'node:test';
import assert from 'node:assert/strict';
import {readDeckBundleWithContext,saveDeckWithContext,sha256Base64Url} from '../src/deck-runtime.mjs';

const savedAt='2026-09-07T16:52:10.299Z';
const actor=(deck='edit')=>({
  row:{account_id:'OWNER',email:'master.solly.art@gmail.com',username:'owner'},
  user:{permissions:{deck}}
});
const deck=()=>({
  deck_id:'CODE1_AZA_INTERNAL',version:2,version_label:'v0.1',status:'INTERNAL WORKING COPY',
  slides:[{
    slide_id:'S01',width:1920,height:1080,
    background:{color:'#FFFFFF',opacity:1,overlayColor:'#FFFFFF',overlayOpacity:0,fit:'cover',position:'center',zoom:1,mediaRef:'asset_sky'},
    elements:[{element_id:'E01',type:'image',x:0,y:0,width:100,height:100,z:1,locked:false,style:{opacity:1,objectFit:'cover',objectPosition:'center'},mediaRef:'asset_photo'}]
  }],
  updated_at:savedAt,saved_by:'master.solly.art@gmail.com'
});

async function readDb({hashOverride,omitAsset=false}={}){
  const payloadText=JSON.stringify(deck());
  const hash=hashOverride??await sha256Base64Url(payloadText);
  return {
    async select(table){
      if(table==='deck_documents')return [{deck_id:'CODE1_AZA_INTERNAL',current_revision_id:'R_82aeeccce12c4f4381934a7a',current_version:2,version_label:'v0.1',status:'INTERNAL WORKING COPY',updated_at:savedAt}];
      if(table==='deck_revisions')return [{revision_id:'R_82aeeccce12c4f4381934a7a',deck_id:'CODE1_AZA_INTERNAL',version:2,version_label:'v0.1',status:'INTERNAL WORKING COPY',payload_text:payloadText,content_hash:hash,saved_by_snapshot:'master.solly.art@gmail.com',saved_at:savedAt,state:'COMMITTED'}];
      if(table==='deck_assets')return omitAsset?[]:[
        {asset_id:'asset_sky',deck_id:'CODE1_AZA_INTERNAL',object_key:'private/decks/CODE1_AZA_INTERNAL/assets/asset_sky/original.webp',mime_type:'image/webp',file_size_bytes:10,checksum_sha256:'a'.repeat(64),source_kind:'SEED_EMBEDDED',source_ref:'seed:sky',rights_status:'REVIEW_REQUIRED',usage_note:'internal',review_note:'review',state:'ACTIVE'},
        {asset_id:'asset_photo',deck_id:'CODE1_AZA_INTERNAL',object_key:'private/decks/CODE1_AZA_INTERNAL/assets/asset_photo/original.webp',mime_type:'image/webp',file_size_bytes:20,checksum_sha256:'b'.repeat(64),source_kind:'SEED_EMBEDDED',source_ref:'seed:photo',rights_status:'REVIEW_REQUIRED',usage_note:'internal',review_note:'review',state:'ACTIVE'}
      ];
      throw Error(`unexpected table ${table}`);
    }
  };
}

const env=()=>({CODE1_MEDIA_BUCKET:{async head(key){return {size:key.includes('asset_sky')?10:20};}}});
const tokenIssuer=async(_env,p)=>`token-${p.mediaId}`;

test('Deck bootstrap verifies exact revision hash and returns private asset URLs',async()=>{
  const db=await readDb();
  const out=await readDeckBundleWithContext({db,actor:actor('edit'),env:env(),tokenIssuer});
  assert.equal(out.deck.version,2);
  assert.equal(out.deck.updated_at,savedAt);
  assert.equal(out.canEditDeck,true);
  assert.deepEqual(Object.keys(out.assets).sort(),['asset_photo','asset_sky']);
  assert.match(out.assets.asset_sky.url,/^\/api\/staging\/media-get\?token=token-asset_sky$/);
  assert.equal(out.assets.asset_sky.source,'seed:sky');
  assert.equal(out.assets.asset_sky.rights_status,'REVIEW_REQUIRED');
});

test('Deck bootstrap is fail-closed on revision hash mismatch',async()=>{
  const db=await readDb({hashOverride:'x'.repeat(43)});
  await assert.rejects(()=>readDeckBundleWithContext({db,actor:actor('view'),env:env(),tokenIssuer}),/DECK_REVISION_INCOMPLETE/);
});

test('Deck bootstrap preserves legacy per-asset error behavior for missing linkage',async()=>{
  const db=await readDb({omitAsset:true});
  const out=await readDeckBundleWithContext({db,actor:actor('view'),env:env(),tokenIssuer});
  assert.equal(out.canEditDeck,false);
  assert.deepEqual(out.assets.asset_sky,{error:'이미지 접근 또는 사용권 기록을 확인해 주세요.'});
  assert.deepEqual(out.assets.asset_photo,{error:'이미지 접근 또는 사용권 기록을 확인해 주세요.'});
});

test('Deck read denies deck:none before persistence access',async()=>{
  let touched=false;
  const db={async select(){touched=true;return [];}};
  await assert.rejects(()=>readDeckBundleWithContext({db,actor:actor('none'),env:env(),tokenIssuer}),/FORBIDDEN/);
  assert.equal(touched,false);
});

test('Deck save prepares next version, exact saved timestamp/actor and asset refs for transactional RPC',async()=>{
  let call;
  const db={async rpc(name,body){call={name,body};return [{version:3,version_label:'v0.1',saved_at:'2026-09-12T07:00:00.000Z',revision_id:'R_123456789012345678901234'}];}};
  const source=deck();
  const out=await saveDeckWithContext({
    db,actor:actor('edit'),payload:{deck:source,baseVersion:2,newVersion:false,summary:'현재 작업본 수정',requestId:'1'.repeat(32)},
    now:()=> '2026-09-12T07:00:00.000Z'
  });
  assert.equal(call.name,'code1_save_deck');
  assert.equal(call.body.p_base_version,2);
  assert.equal(call.body.p_new_version,false);
  assert.deepEqual(call.body.p_asset_refs,['asset_photo','asset_sky']);
  const stored=JSON.parse(call.body.p_payload_text);
  assert.equal(stored.version,3);
  assert.equal(stored.version_label,'v0.1');
  assert.equal(stored.updated_at,'2026-09-12T07:00:00.000Z');
  assert.equal(stored.saved_by,'master.solly.art@gmail.com');
  assert.deepEqual(out,{version:3,versionLabel:'v0.1',savedAt:'2026-09-12T07:00:00.000Z'});
});

test('newVersion=true derives legacy v0.<nextVersion> label from baseVersion',async()=>{
  let body;
  const db={async rpc(_name,b){body=b;return [{version:3,version_label:'v0.3',saved_at:'2026-09-12T07:00:00.000Z'}];}};
  await saveDeckWithContext({db,actor:actor('edit'),payload:{deck:deck(),baseVersion:2,newVersion:true,summary:'버전 생성',requestId:'2'.repeat(32)},now:()=> '2026-09-12T07:00:00.000Z'});
  assert.equal(JSON.parse(body.p_payload_text).version_label,'v0.3');
});

test('Deck save denies view-only caller before RPC',async()=>{
  let touched=false;
  const db={async rpc(){touched=true;return [];}};
  await assert.rejects(()=>saveDeckWithContext({db,actor:actor('view'),payload:{deck:deck(),baseVersion:2,newVersion:false,summary:'x',requestId:'3'.repeat(32)}}),/FORBIDDEN/);
  assert.equal(touched,false);
});
