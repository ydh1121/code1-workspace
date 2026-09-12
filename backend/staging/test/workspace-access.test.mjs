import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWorkspaceAccess,accessHas,effectiveUserPermissions,ACCESS_CAPABILITIES} from '../src/workspace-access.mjs';

const adminRow={account_id:'U_ADMIN',role:'ADMIN',permissions_json:{},status:'active'};
const farmerRow={account_id:'U_FARMER',role:'FARMER',permissions_json:{farm:'edit',deck:'view',farmIds:['GF-1']},status:'active'};
const ownerRow={account_id:'OWNER',role:'SUPER_ADMIN',permissions_json:{},status:'active'};
const user=(row,permissions)=>({row,user:{id:row.account_id,role:row.role,permissions}});

function dbWith(rows){return {select:async(table)=>{assert.equal(table,'account_capabilities');return rows;}};}

test('OWNER receives the complete workspace access catalog without role leakage to other accounts',async()=>{
  const profile=await resolveWorkspaceAccess({select:async()=>{throw Error('OWNER must not need capability lookup');}},user(ownerRow,{farm:'edit',deck:'edit'}));
  assert.equal(profile.owner,true);
  assert.equal(profile.initialized,true);
  for(const capability of ACCESS_CAPABILITIES)assert.equal(accessHas(profile,capability),true,capability);
});

test('legacy ADMIN keeps current operational pages until an explicit access profile is saved',async()=>{
  const actor=user(adminRow,{farm:'edit',deck:'edit',allFarms:true,accounts:true,review:true});
  const profile=await resolveWorkspaceAccess(dbWith([]),actor);
  assert.equal(profile.initialized,false);
  assert.equal(accessHas(profile,'PAGE_FARM'),true);
  assert.equal(accessHas(profile,'PAGE_DECK'),true);
  assert.equal(accessHas(profile,'PAGE_INPUT_POLICY'),true);
  assert.equal(accessHas(profile,'ACCOUNT_MANAGE'),true);
  assert.equal(accessHas(profile,'PAGE_PLANNING'),false);
});

test('first explicit profile becomes allow-list only and can expose planning without unrelated pages',async()=>{
  const actor=user(adminRow,{farm:'edit',deck:'edit',allFarms:true,accounts:true,review:true});
  const profile=await resolveWorkspaceAccess(dbWith([
    {capability:'ACCESS_PROFILE_INITIALIZED',effect:'ALLOW'},
    {capability:'PAGE_PLANNING',effect:'ALLOW'},
    {capability:'PLANNING_FEEDBACK',effect:'ALLOW'}
  ]),actor);
  assert.equal(profile.initialized,true);
  assert.equal(accessHas(profile,'PAGE_PLANNING'),true);
  assert.equal(accessHas(profile,'PLANNING_FEEDBACK'),true);
  assert.equal(accessHas(profile,'PAGE_FARM'),false);
  assert.equal(accessHas(profile,'ACCOUNT_MANAGE'),false);
  const permissions=effectiveUserPermissions(actor,profile);
  assert.equal(permissions.farm,'none');
  assert.equal(permissions.deck,'none');
});

test('legacy FARMER derives page visibility from its old farm/deck scope',async()=>{
  const actor=user(farmerRow,{farm:'edit',deck:'view',farmIds:['GF-1'],allFarms:false,accounts:false,review:false});
  const profile=await resolveWorkspaceAccess(dbWith([]),actor);
  assert.equal(accessHas(profile,'PAGE_FARM'),true);
  assert.equal(accessHas(profile,'FARM_EDIT'),true);
  assert.equal(accessHas(profile,'PAGE_DECK'),true);
  assert.equal(accessHas(profile,'DECK_EDIT'),false);
  assert.equal(accessHas(profile,'DECK_EXPORT'),true);
});
