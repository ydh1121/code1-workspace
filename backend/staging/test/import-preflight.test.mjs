import test from 'node:test';
import assert from 'node:assert/strict';
import {assertImportControlEnv,nonEmptyImportCounts,runImportPreflight} from '../src/import-preflight.mjs';

const ref='abcdefghijklmnopqrst';
const baseEnv={
  CODE1_STAGING_PROJECT_REF:ref,
  CODE1_SUPABASE_URL:`https://${ref}.supabase.co`,
  CODE1_SUPABASE_SERVICE_ROLE_KEY:'s'.repeat(48),
  CODE1_IMPORT_TARGET:'STAGING',
  CODE1_IMPORT_CONFIRM_REF:ref
};

const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const emptyFetch=async(url,init={})=>{
  const u=new URL(url);
  assert.equal(u.hostname,`${ref}.supabase.co`);
  assert.equal(init.headers.apikey,baseEnv.CODE1_SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(init.headers.Authorization,`Bearer ${baseEnv.CODE1_SUPABASE_SERVICE_ROLE_KEY}`);
  return jsonResponse([]);
};

test('import control requires explicit staging target and exact ref acknowledgement',()=>{
  assert.equal(assertImportControlEnv(baseEnv).ref,ref);
  assert.throws(()=>assertImportControlEnv({...baseEnv,CODE1_IMPORT_TARGET:'PRODUCTION'}),/CODE1_IMPORT_TARGET_MUST_BE_STAGING/);
  assert.throws(()=>assertImportControlEnv({...baseEnv,CODE1_IMPORT_CONFIRM_REF:'bbbbbbbbbbbbbbbbbbbb'}),/CODE1_IMPORT_CONFIRM_REF_MISMATCH/);
});

test('empty target passes first-import preflight without exposing secret material',async()=>{
  const result=await runImportPreflight(baseEnv,emptyFetch);
  assert.equal(result.ok,true);
  assert.equal(result.mode,'FIRST_IMPORT');
  assert.equal(result.projectRef,ref);
  assert.deepEqual(result.nonEmpty,[]);
  assert.equal(JSON.stringify(result).includes(baseEnv.CODE1_SUPABASE_SERVICE_ROLE_KEY),false);
});

test('non-empty target is refused unless explicit idempotent retry is enabled',async()=>{
  const rows={workspace_accounts:[{account_id:'OWNER'}]};
  const fetchImpl=async(url)=>{
    const u=new URL(url),table=u.pathname.split('/').at(-1);
    return jsonResponse(rows[table]||[]);
  };
  await assert.rejects(()=>runImportPreflight(baseEnv,fetchImpl),error=>{
    assert.equal(error.message,'CODE1_IMPORT_TARGET_NOT_EMPTY');
    assert.deepEqual(error.nonEmpty,[{key:'accounts',value:1}]);
    return true;
  });
  const retry=await runImportPreflight({...baseEnv,CODE1_IMPORT_ALLOW_NONEMPTY:'IDEMPOTENT_RETRY'},fetchImpl);
  assert.equal(retry.mode,'IDEMPOTENT_RETRY');
  assert.deepEqual(retry.nonEmpty,[{key:'accounts',value:1}]);
});

test('non-empty count helper reports only durable imported data surfaces',()=>{
  assert.deepEqual(nonEmptyImportCounts({accounts:2,questions:231,planningCapabilities:0}),[
    {key:'accounts',value:2},{key:'questions',value:231}
  ]);
});
