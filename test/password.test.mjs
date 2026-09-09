import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,passwordMatches} from '../functions/_shared/password.js';
import {sign,accountCookie,session,verify,readCookie} from '../functions/_shared/security.js';
import {onRequestPost as login} from '../functions/api/auth/password.js';
import {onRequestPost as rpc} from '../functions/api/rpc.js';
import {onRequestPost as accounts} from '../functions/api/accounts.js';
const env={APP_ORIGIN:'https://workspace.test',BRIDGE_URL:'https://script.google.com/macros/s/test/exec',BRIDGE_SECRET:'test-bridge-secret-with-32-characters-123',SESSION_SECRET:'test-session-secret-with-32-characters-123',PASSWORD_PEPPER:'test-password-pepper-with-32-characters-123'};
const user={id:'user-test',version:1,role:'FARMER',username:'farmer',status:'active'};
const request=(path,body,cookie='',origin=env.APP_ORIGIN)=>new Request(env.APP_ORIGIN+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(body)});
test('salted password hashes verify, reject wrong password/pepper and do not store plaintext',async()=>{
  const first=await passwordHash('test-password-1234',env),second=await passwordHash('test-password-1234',env);
  assert.notEqual(first.hash,second.hash);assert.notEqual(first.salt,second.salt);assert.equal(await passwordMatches('test-password-1234',first,env),true);assert.equal(await passwordMatches('wrong-password-12',first,env),false);assert.equal(await passwordMatches('test-password-1234',first,{...env,PASSWORD_PEPPER:'different-secret-pepper-at-least-32-chars'}),false);
  assert.equal(JSON.stringify(first).includes('test-password'),false);await assert.rejects(passwordHash('short',env));
});
test('new cookies require immutable account id and version; old email-only sessions cannot enter RPC',async()=>{
  const header=await accountCookie(user,env);assert.match(header,/HttpOnly; Secure; SameSite=Lax/);assert.equal((await session(new Request(env.APP_ORIGIN,{headers:{Cookie:header.split(';')[0]}}),env)).accountId,user.id);
  const old=await sign({kind:'session',email:'owner@example.test',exp:Date.now()+5000},env.SESSION_SECRET);
  const r=await rpc({request:request('/api/rpc',{action:'bootstrap'},'__Host-code1='+old),env});assert.equal(r.status,401);
});
test('password login uses one signed authentication bridge round trip and returns sanitized identity with HttpOnly cookie',async()=>{
  const credential=await passwordHash('test-password-1234',env),original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{const p=JSON.parse(JSON.parse(init.body).body);calls.push(p);return new Response(JSON.stringify({ok:true,data:{credential,user}}));};
  try{
    const r=await login({request:request('/api/auth/password',{username:'farmer',password:'test-password-1234'}),env});assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);const response=await r.text();assert.equal(response.includes(credential.hash),false);assert.equal(response.includes('password'),false);assert.deepEqual(calls.map(c=>c.action),['auth.fast']);assert.match(calls[0].payload.ipKey,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(calls).includes('test-password-1234'),false);
  }finally{globalThis.fetch=original;}
});
test('browser RPC cannot request credential lookups, login tickets, account changes or forged roles',async()=>{
  const cookie=(await accountCookie(user,env)).split(';')[0],original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;throw Error('unexpected');};
  try{for(const action of ['account.credential','auth.begin','auth.finish','auth.fast','auth.audit','account.save','account.password','settings']){const r=await rpc({request:request('/api/rpc',{action,payload:{role:'SUPER_ADMIN'}},cookie),env});assert.equal(r.status,400);}assert.equal(called,false);}finally{globalThis.fetch=original;}
});
test('account API rejects cross-origin mutation and farmer account creation before hashing',async()=>{
  const cookie=(await accountCookie(user,env)).split(';')[0];assert.equal((await accounts({request:request('/api/accounts',{action:'save'},cookie,'https://evil.test'),env})).status,403);
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,data:user}));
  try{const r=await accounts({request:request('/api/accounts',{action:'save',role:'SUPER_ADMIN',password:'some-password-123'},cookie),env});assert.equal(r.status,403);}finally{globalThis.fetch=original;}
});
test('own password change requires the current password; browser credential fields are never accepted',async()=>{
  const credential=await passwordHash('current-password-12',env),cookie=(await accountCookie(user,env)).split(';')[0],original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{const p=JSON.parse(JSON.parse(init.body).body);calls.push(p.action);return new Response(JSON.stringify({ok:true,data:p.action==='account.credential'?credential:user}));};
  try{const r=await accounts({request:request('/api/accounts',{action:'password',currentPassword:'wrong-password-123',password:'new-password-1234',credential:{hash:'forged'}},cookie),env});assert.equal(r.status,400);assert.equal(calls.includes('account.password'),false);}finally{globalThis.fetch=original;}
});
