import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {validateDeck,collectDeckAssetRefs,prepareDeckSave,DECK_ID,DECK_STATUS} from '../src/deck-contract.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const clientCore=fs.readFileSync(path.resolve(here,'../../../public/assets/core.js'),'utf8');
const ctx={};
vm.runInNewContext(`${clientCore}\n;globalThis.__Code1Core=Code1Core;`,ctx);
const clientValidate=deck=>JSON.parse(JSON.stringify(ctx.__Code1Core.validateDeck(deck)));

function fixture(){
  return {
    deck_id:DECK_ID,
    version:2,
    version_label:'v0.1',
    status:'anything is normalized',
    slides:[
      {
        slide_id:'S01',width:111,height:222,
        background:{color:'#FFFFFF',opacity:.52,overlayColor:'#FFFFFF',overlayOpacity:.5,fit:'cover',position:'center',zoom:1,mediaRef:'asset_sky'},
        elements:[
          {element_id:'S01_E001',type:'image',x:0,y:0,width:200,height:100,z:0,locked:true,style:{opacity:1,objectFit:'cover',objectPosition:'center'},mediaRef:'asset_farm'},
          {element_id:'S01_E002',type:'text',x:220,y:10,width:500,height:120,z:1,locked:false,style:{fontSize:40,fontWeight:700,lineHeight:1.2,color:'#111111',fontFamily:'Pretendard Variable'},content:'Deck contract'},
          {element_id:'S01_E003',type:'shape',x:0,y:200,width:1920,height:20,z:-1,locked:false,style:{backgroundColor:'#FFFFFF',opacity:.8}}
        ]
      },
      {
        slide_id:'S02',background:{},elements:[
          {element_id:'S02_E001',type:'image',x:10,y:10,width:300,height:300,z:0,locked:false,style:{objectFit:'contain'},mediaRef:'asset_farm'},
          {element_id:'S02_E002',type:'image',x:400,y:10,width:300,height:300,z:1,locked:false,style:{objectFit:'contain'},mediaRef:'M_35f86cfcbc9f4c93aa6870ac'}
        ]
      }
    ]
  };
}

test('server Deck validator stays byte-shape compatible with current browser validator',()=>{
  const source=fixture();
  assert.deepEqual(validateDeck(source),clientValidate(source));
});

test('asset reference collection is stable, unique and includes backgrounds',()=>{
  assert.deepEqual(collectDeckAssetRefs(fixture()),['M_35f86cfcbc9f4c93aa6870ac','asset_farm','asset_sky']);
});

test('prepareDeckSave mirrors legacy post-validation version metadata behavior',()=>{
  const savedAt='2026-09-12T00:00:00.000Z';
  const out=prepareDeckSave(fixture(),{nextVersion:3,versionLabel:'v0.1',savedAt,savedBy:'owner'});
  assert.equal(out.deck.deck_id,DECK_ID);
  assert.equal(out.deck.version,3);
  assert.equal(out.deck.version_label,'v0.1');
  assert.equal(out.deck.status,DECK_STATUS);
  assert.equal(out.deck.updated_at,savedAt);
  assert.equal(out.deck.saved_by,'owner');
  assert.deepEqual(out.assetRefs,['M_35f86cfcbc9f4c93aa6870ac','asset_farm','asset_sky']);
  assert.deepEqual(JSON.parse(out.payloadText),out.deck);
});

test('wrong Deck identity fails closed before persistence',()=>{
  const d=fixture();d.deck_id='OTHER_DECK';
  assert.throws(()=>prepareDeckSave(d,{nextVersion:3,versionLabel:'v0.1',savedAt:'2026-09-12T00:00:00Z',savedBy:'owner'}),/INVALID_DECK/);
});

test('server parity rejects duplicate IDs, outside geometry and invalid image refs',()=>{
  const duplicate=fixture();duplicate.slides[0].elements[1].element_id='S01_E001';
  assert.throws(()=>validateDeck(duplicate),/DUPLICATE_ID/);

  const outside=fixture();outside.slides[0].elements[0].x=1900;outside.slides[0].elements[0].width=100;
  assert.throws(()=>validateDeck(outside),/ELEMENT_OUTSIDE_SLIDE/);

  const badRef=fixture();badRef.slides[0].elements[0].mediaRef='bad ref';
  assert.throws(()=>validateDeck(badRef),/INVALID_ID/);
});

test('server parity enforces existing 40-slide and 180-elements-per-slide caps',()=>{
  const tooManySlides=fixture();tooManySlides.slides=Array.from({length:41},(_,i)=>({slide_id:`S${i}`,background:{},elements:[]}));
  assert.throws(()=>validateDeck(tooManySlides),/INVALID_DECK/);

  const tooManyElements=fixture();tooManyElements.slides=[{slide_id:'S01',background:{},elements:Array.from({length:181},(_,i)=>({element_id:`E${i}`,type:'shape',x:0,y:0,width:1,height:1,z:i,locked:false,style:{}}))}];
  assert.throws(()=>validateDeck(tooManyElements),/TOO_MANY_ELEMENTS/);
});
