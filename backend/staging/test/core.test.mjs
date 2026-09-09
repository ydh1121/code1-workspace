import test from 'node:test';import assert from 'node:assert/strict';
import {publicAccount,resolvePolicy,policyVisible,policyBlocking,privateObjectKey,percentile} from '../src/core.mjs';

test('admin account keeps all-farm contract',()=>{const u=publicAccount({account_id:'A1',username:'admin',display_name:'Admin',role:'ADMIN',status:'active',permissions_json:{},session_version:1,password_hash:'x'});assert.equal(u.permissions.allFarms,true);assert.equal(u.permissions.farm,'edit');});
test('only OWNER may be SUPER_ADMIN',()=>assert.throws(()=>publicAccount({account_id:'X',username:'owner2',display_name:'x',role:'SUPER_ADMIN',status:'active',session_version:1}),/FORBIDDEN/));
test('global permanent exclusion beats farm show',()=>{const r=resolvePolicy('A-1','F-1',[{scope:'GLOBAL',item_key:'A-1',mode:'PERMANENT_EXCLUDE',status:'active'},{scope:'FARM',farm_id:'F-1',item_key:'A-1',mode:'SHOW',status:'active'}]);assert.equal(r.mode,'PERMANENT_EXCLUDE');assert.equal(policyVisible(r.mode),false);assert.equal(policyBlocking(r.mode),false);});
test('farm policy overrides non-permanent global policy',()=>assert.equal(resolvePolicy('A','F',[{scope:'GLOBAL',item_key:'A',mode:'HIDE',status:'active'},{scope:'FARM',farm_id:'F',item_key:'A',mode:'SHOW',status:'active'}]).mode,'SHOW'));
test('private object key uses stable hierarchy',()=>assert.equal(privateObjectKey({farmId:'GF-1',submissionId:'SUB_1',mediaId:'M_1',fileName:'원본 1.webp'}),'private/farms/GF-1/submissions/SUB_1/media/M_1/original/원본-1.webp'));
test('percentiles use observed samples',()=>{assert.equal(percentile([10,20,30,40,50],.5),30);assert.equal(percentile([10,20,30,40,50],.95),50);});
