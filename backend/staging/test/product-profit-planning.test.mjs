import test from 'node:test';
import assert from 'node:assert/strict';
import {listProductProfitModels,saveProductProfitModel,archiveProductProfitModel} from '../src/planning-api.mjs';

const ref='abcdefghijklmnopqrst';
const env={CODE1_STAGING_PROJECT_REF:ref,CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48)};
const principal={accountId:'OWNER',version:3};
const owner={account_id:'OWNER',username:'owner',display_name:'Owner',role:'SUPER_ADMIN',status:'active',permissions_json:{},session_version:3,archived_at:null};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const mockFetch=handler=>async(url,init={})=>handler(new URL(url),init);
const model={model_id:'PPM_1',product_name:'30구 계란',unit_name:'30구 1판',sales_channel:'공식몰',sale_price:15000,purchase_cost:9000,package_cost:800,shipping_cost:2500,sales_fee:450,other_cost:250,monthly_units:100,note:'현재 파악한 값',current_revision:1,created_at:'2026-09-12T00:00:00Z',updated_at:'2026-09-12T00:00:00Z'};

test('product profit list is separate planning data and exposes edit access for OWNER',async()=>{
  const fetchImpl=mockFetch((u)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/planning_product_profit_models'))return response([model]);
    throw Error(`unexpected ${u.pathname}`);
  });
  const result=await listProductProfitModels(env,principal,{},fetchImpl);
  assert.equal(result.models[0].product_name,'30구 계란');
  assert.equal(result.models[0].monthly_units,100);
  assert.equal(result.access.canEdit,true);
});

test('product profit save uses one guarded RPC then reloads current models',async()=>{
  let rpcBody;
  const fetchImpl=mockFetch((u,init)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/rpc/code1_save_product_profit_model')){rpcBody=JSON.parse(init.body);return response([model]);}
    if(u.pathname.endsWith('/planning_product_profit_models'))return response([model]);
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await saveProductProfitModel(env,principal,{id:'',baseRevision:0,productName:'30구 계란',unitName:'30구 1판',salesChannel:'공식몰',salePrice:15000,purchaseCost:9000,packageCost:800,shippingCost:2500,salesFee:450,otherCost:250,monthlyUnits:100,note:'현재 파악한 값',requestId:'a'.repeat(32)},fetchImpl);
  assert.equal(rpcBody.p_actor_id,'OWNER');
  assert.equal(rpcBody.p_sale_price,15000);
  assert.equal(rpcBody.p_monthly_units,100);
  assert.equal(result.models.length,1);
});

test('product profit archive uses guarded archive RPC and keeps history out of hard delete path',async()=>{
  let called=false;
  const fetchImpl=mockFetch((u,init)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.endsWith('/rpc/code1_archive_product_profit_model')){called=true;const body=JSON.parse(init.body);assert.equal(body.p_model_id,'PPM_1');return response([model]);}
    if(u.pathname.endsWith('/planning_product_profit_models'))return response([]);
    throw Error(`unexpected ${init.method||'GET'} ${u.pathname}`);
  });
  const result=await archiveProductProfitModel(env,principal,{id:'PPM_1',requestId:'b'.repeat(32)},fetchImpl);
  assert.equal(called,true);
  assert.deepEqual(result.models,[]);
});

test('negative product cost is rejected before persistence',async()=>{
  let rpcCalled=false;
  const fetchImpl=mockFetch((u)=>{
    if(u.pathname.endsWith('/workspace_accounts'))return response([owner]);
    if(u.pathname.includes('/rpc/'))rpcCalled=true;
    throw Error(`unexpected ${u.pathname}`);
  });
  await assert.rejects(()=>saveProductProfitModel(env,principal,{baseRevision:0,productName:'테스트',salePrice:1000,purchaseCost:-1,monthlyUnits:1,requestId:'c'.repeat(32)},fetchImpl),/INVALID_PRODUCT_PROFIT/);
  assert.equal(rpcCalled,false);
});
