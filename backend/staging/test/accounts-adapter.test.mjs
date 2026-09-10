import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSave,accountPassword} from '../src/accounts-adapter.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const principal={accountId:'OWNER',version:2};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',email:'owner@example.com',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:2,password_hash:'a'.repeat(64),password_salt:'b'.repeat(32),password_iterations:100000,password_scheme:'pbkdf2-sha256-pepper-v1'};
const farmer={account_id:'U_FARMER',username:'farmer1',display_name:'Farmer',email:'',role:'FARMER',status:'active',permissions_json:{farm:'edit',deck:'none',farmIds:['GF-1']},session_version:4,password_hash:'c'.repeat(64),password_salt:'d'.repeat(32),password_iterations:100000,password_scheme:'pbkdf2-sha256-pepper-v1'};
const credential={hash:'e'.repeat(64),salt:'f'.repeat(32),iterations:100000,scheme:'pbkdf2-sha256-pepper-v1'};

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});}

test('account save delegates the durable mutation to one transaction RPC',async()=>{
  const writes=[];
  let accountReads=0;
  const fetchImpl=async(url,init={})=>{
    const u=new URL(url),method=init.method||'GET';
    if(method==='GET'&&u.pathname==='/rest/v1/workspace_accounts'){
      accountReads++;
      return response(accountReads===1?[owner]:[farmer]);
    }
    if(method==='POST'&&u.pathname==='/rest/v1/rpc/code1_save_account'){
      const body=JSON.parse(init.body);writes.push([u.pathname,body]);
      return response([{...farmer,display_name:'Farmer Updated',session_version:5}]);
    }
    throw Error(`unexpected ${method} ${u.pathname}`);
  };
  const out=await accountSave(env,principal,{id:'U_FARMER',baseVersion:4,username:'farmer1',displayName:'Farmer Updated',role:'FARMER',status:'active',permissions:{farm:'edit',deck:'none',farmIds:['GF-1']}},fetchImpl);
  assert.equal(out.version,5);
  assert.equal(writes.length,1);
  assert.equal(writes[0][1].p_actor_id,'OWNER');
  assert.equal(writes[0][1].p_base_version,4);
  assert.deepEqual(writes[0][1].p_farm_ids,['GF-1']);
  assert.equal(writes[0][1].p_credential,null);
});

test('password rotation delegates version bump and audit to one transaction RPC',async()=>{
  const writes=[];
  const fetchImpl=async(url,init={})=>{
    const u=new URL(url),method=init.method||'GET';
    if(method==='GET'&&u.pathname==='/rest/v1/workspace_accounts')return response([owner]);
    if(method==='POST'&&u.pathname==='/rest/v1/rpc/code1_change_password'){
      const body=JSON.parse(init.body);writes.push(body);
      return response([{...owner,password_hash:credential.hash,password_salt:credential.salt,session_version:3}]);
    }
    throw Error(`unexpected ${method} ${u.pathname}`);
  };
  const out=await accountPassword(env,principal,{credential},fetchImpl);
  assert.equal(out.version,3);
  assert.equal(writes.length,1);
  assert.equal(writes[0].p_actor_id,'OWNER');
  assert.equal(writes[0].p_base_version,2);
  assert.equal(writes[0].p_credential.hash,credential.hash);
});
