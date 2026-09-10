import test from 'node:test';
import assert from 'node:assert/strict';
import {configured,loginIpSecret} from '../../../functions/_shared/security.js';

const origin='https://coding-runtime-backend-stagi.code1-workspace.pages.dev';
const secret=ch=>ch.repeat(32);

test('legacy runtime preserves bridge-based configured contract',()=>{
  const env={APP_ORIGIN:origin,SESSION_SECRET:secret('s'),BRIDGE_URL:'https://script.google.com/macros/s/example/exec',BRIDGE_SECRET:secret('b')};
  assert.equal(configured(env),true);
  assert.equal(loginIpSecret(env),secret('b'));
  assert.equal(configured({...env,BRIDGE_SECRET:''}),false);
});

test('Supabase staging runtime is configured without Apps Script bridge credentials',()=>{
  const env={APP_ORIGIN:origin,SESSION_SECRET:secret('s'),CODE1_RUNTIME_BACKEND:'SUPABASE_STAGING',CODE1_LOGIN_IP_SECRET:secret('i')};
  assert.equal(configured(env),true);
  assert.equal(loginIpSecret(env),secret('i'));
  assert.equal(configured({...env,CODE1_LOGIN_IP_SECRET:'',BRIDGE_URL:'https://script.google.com/macros/s/example/exec',BRIDGE_SECRET:secret('b')}),false);
});

test('invalid runtime and short staging login secret fail closed',()=>{
  const base={APP_ORIGIN:origin,SESSION_SECRET:secret('s')};
  assert.equal(configured({...base,CODE1_RUNTIME_BACKEND:'UNKNOWN',BRIDGE_URL:'https://script.google.com/macros/s/example/exec',BRIDGE_SECRET:secret('b')}),false);
  assert.equal(configured({...base,CODE1_RUNTIME_BACKEND:'SUPABASE_STAGING',CODE1_LOGIN_IP_SECRET:'short'}),false);
  assert.throws(()=>loginIpSecret({...base,CODE1_RUNTIME_BACKEND:'SUPABASE_STAGING',CODE1_LOGIN_IP_SECRET:'short'}),/SETUP_REQUIRED/);
});
