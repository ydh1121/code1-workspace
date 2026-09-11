import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadDeckAssetWithContext,readDeckMediaWithContext,deckAssetIdForRequest,deckAssetObjectKey} from '../src/deck-media-runtime.mjs';

const actor=(deck='edit')=>({row:{account_id:'OWNER',username:'owner',email:'owner@example.test'},user:{permissions:{deck}}});
const requestId='a'.repeat(32);
const bytes=Uint8Array.from([1,2,3,4,5,6]);
const base64=Buffer.from(bytes).toString('base64');

function bucket(){
  const objects=new Map();
  return {
    objects,
    async head(key){const x=objects.get(key);return x?{size:x.bytes.length,customMetadata:x.customMetadata,httpMetadata:x.httpMetadata}:null;},
    async get(key){const x=objects.get(key);return x?{arrayBuffer:async()=>x.bytes.buffer.slice(x.bytes.byteOffset,x.bytes.byteOffset+x.bytes.byteLength)}:null;},
    async put(key,data,options={}){objects.set(key,{bytes:Uint8Array.from(data),...options});},
    async delete(key){objects.delete(key);}
  };
}

function expectedRow(checksum){
  const assetId=deckAssetIdForRequest(requestId);
  return {
    asset_id:assetId,deck_id:'CODE1_AZA_INTERNAL',object_key:deckAssetObjectKey(assetId),mime_type:'image/png',file_size_bytes:bytes.length,
    checksum_sha256:checksum,source_kind:'STAGING_UPLOAD',source_ref:'proof.png',rights_status:'internal',usage_note:'unconfirmed',review_note:'proof',
    metadata:{original_file_name:'proof.png',caption:'proof'},state:'ACTIVE',registered_by:'OWNER',request_id:requestId
  };
}

async function checksum(){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}

test('Deck upload writes deterministic private object then registers exact asset',async()=>{
  const r2=bucket(),hash=await checksum();let rpcCall;
  const db={
    async select(){return [];},
    async rpc(name,body){rpcCall={name,body};return [expectedRow(hash)];}
  };
  const out=await uploadDeckAssetWithContext({db,actor:actor(),env:{CODE1_MEDIA_BUCKET:r2},payload:{kind:'DECK',requestId,fileName:'proof.png',mimeType:'image/png',base64,metadata:{rights_owner:'internal',b2b_use:'unconfirmed',caption:'proof'}}});
  assert.equal(out.upload_id,deckAssetIdForRequest(requestId));
  assert.equal(rpcCall.name,'code1_register_deck_asset');
  assert.equal(rpcCall.body.p_asset.object_key,deckAssetObjectKey(out.upload_id));
  assert.equal(rpcCall.body.p_asset.checksum_sha256,hash);
  assert.ok(r2.objects.has(deckAssetObjectKey(out.upload_id)));
});

test('Deck upload retry with mismatched bytes fails before any R2 mutation',async()=>{
  const hash=await checksum(),row=expectedRow(hash);let put=false;
  const db={async select(){return [row];}};
  const r2=bucket();r2.put=async()=>{put=true;};
  const other=Buffer.from(Uint8Array.from([9,9,9])).toString('base64');
  await assert.rejects(()=>uploadDeckAssetWithContext({db,actor:actor(),env:{CODE1_MEDIA_BUCKET:r2},payload:{kind:'DECK',requestId,fileName:'proof.png',mimeType:'image/png',base64:other,metadata:{}}}),/UPLOAD_REQUEST_CONFLICT/);
  assert.equal(put,false);
});

test('Deck upload compensates a newly created R2 object when DB registration fails',async()=>{
  const r2=bucket();let selects=0;
  const db={async select(){selects++;return [];},async rpc(){throw Error('DB_WRITE_FAILED');}};
  await assert.rejects(()=>uploadDeckAssetWithContext({db,actor:actor(),env:{CODE1_MEDIA_BUCKET:r2},payload:{kind:'DECK',requestId,fileName:'proof.png',mimeType:'image/png',base64,metadata:{}}}),/DB_WRITE_FAILED/);
  assert.equal(selects>=2,true);
  assert.equal(r2.objects.size,0);
});

test('Deck media read returns a private token URL and denies viewless callers',async()=>{
  const hash=await checksum(),row=expectedRow(hash),r2=bucket();
  r2.objects.set(row.object_key,{bytes,customMetadata:{checksumSha256:hash},httpMetadata:{contentType:'image/png'}});
  const db={async select(){return [row];}};
  const tokenIssuer=async(_env,p)=>`token-${p.mediaId}`;
  const out=await readDeckMediaWithContext({db,actor:actor('view'),env:{CODE1_MEDIA_BUCKET:r2},id:row.asset_id,tokenIssuer});
  assert.equal(out.upload_id,row.asset_id);
  assert.equal(out.url,`/api/staging/media-get?token=token-${row.asset_id}`);
  await assert.rejects(()=>readDeckMediaWithContext({db,actor:actor('none'),env:{CODE1_MEDIA_BUCKET:r2},id:row.asset_id,tokenIssuer}),/FORBIDDEN/);
});
