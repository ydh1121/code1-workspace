import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeBackend,useSupabaseStaging,APPS_SCRIPT,SUPABASE_STAGING} from '../src/runtime-mode.mjs';

test('runtime backend defaults to existing Apps Script',()=>{
  assert.equal(runtimeBackend({}),APPS_SCRIPT);
  assert.equal(useSupabaseStaging({}),false);
});

test('Supabase staging must be explicitly selected',()=>{
  assert.equal(runtimeBackend({CODE1_RUNTIME_BACKEND:'SUPABASE_STAGING'}),SUPABASE_STAGING);
  assert.equal(useSupabaseStaging({CODE1_RUNTIME_BACKEND:'supabase_staging'}),true);
});

test('unknown runtime backend fails closed',()=>{
  assert.throws(()=>runtimeBackend({CODE1_RUNTIME_BACKEND:'production'}),/SETUP_REQUIRED/);
});
