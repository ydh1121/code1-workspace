const enc = new TextEncoder();
const RUNTIME_APPS_SCRIPT='APPS_SCRIPT';
const RUNTIME_SUPABASE_STAGING='SUPABASE_STAGING';
const runtimeMode = env => String(env?.CODE1_RUNTIME_BACKEND || RUNTIME_APPS_SCRIPT).trim().toUpperCase();
export const encode = value => btoa(String.fromCharCode(...enc.encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decode(value) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); }
export async function hmac(text, secret) {
  if (!secret || secret.length < 32) throw Error('SETUP_REQUIRED');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}
export function equal(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function sign(payload, secret) { const body = encode(payload); return body + '.' + await hmac(body, secret); }
export async function verify(token, secret) { try { const [body, sig, extra] = token.split('.'); if (extra || !equal(sig, await hmac(body, secret))) return null; const p = decode(body); return Number.isFinite(p.exp) && p.exp > Date.now() ? p : null; } catch { return null; } }
export const cookie = (name, value, age = 28800) => `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
export const readCookie = (request, name) => (request.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) || '';
export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
export function configured(env={}) {
  if (!env.APP_ORIGIN || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return false;
  const mode=runtimeMode(env);
  if(mode===RUNTIME_SUPABASE_STAGING)return !!(env.CODE1_LOGIN_IP_SECRET&&env.CODE1_LOGIN_IP_SECRET.length>=32);
  if(mode===RUNTIME_APPS_SCRIPT)return !!(env.BRIDGE_URL&&env.BRIDGE_SECRET&&env.BRIDGE_SECRET.length>=32);
  return false;
}
export function loginIpSecret(env={}) {
  const mode=runtimeMode(env);
  const secret=mode===RUNTIME_SUPABASE_STAGING?env.CODE1_LOGIN_IP_SECRET:mode===RUNTIME_APPS_SCRIPT?env.BRIDGE_SECRET:'';
  if(!secret||secret.length<32)throw Error('SETUP_REQUIRED');
  return secret;
}
export function origin(env) { const u = new URL(env.APP_ORIGIN); if (u.protocol !== 'https:' || u.origin !== env.APP_ORIGIN) throw Error('SETUP_REQUIRED'); return u.origin; }
export async function session(request, env) { const s = await verify(readCookie(request, '__Host-code1'), env.SESSION_SECRET); if (!s || s.kind !== 'session' || typeof s.accountId !== 'string' || !Number.isInteger(s.version)) throw Error('UNAUTHENTICATED'); return s; }
export async function accountCookie(account, env, method='password') {
  return cookie('__Host-code1',await sign({kind:'session',accountId:account.id,version:account.version,method,authAt:Date.now(),exp:Date.now()+28800000},env.SESSION_SECRET));
}
export function sameOrigin(request, env) { if (request.headers.get('Origin') !== origin(env)) throw Error('FORBIDDEN'); }
export async function bridge(env, principal, action, payload = {}) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.BRIDGE_URL || '')) throw Error('SETUP_REQUIRED');
  const identity=typeof principal==='string'?{email:principal}:{actor:principal?{accountId:principal.accountId,version:principal.version}:null};
  const body = JSON.stringify({ protocol:2,...identity, action, payload, timestamp: Date.now(), nonce: crypto.randomUUID().replace(/-/g, '') });
  // Signature covers the exact UTF-8 body, including identity, method and payload.
  const res = await fetch(env.BRIDGE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ body, signature: await hmac(body, env.BRIDGE_SECRET) }), redirect: 'follow', signal: AbortSignal.timeout(55000) });
  let result; try { result = await res.json(); } catch { throw Error('BRIDGE_UNAVAILABLE'); }
  if (!res.ok || !result.ok) throw Error(result.error || 'BRIDGE_UNAVAILABLE');
  return result.data;
}
export function failure(e) {
  const message = String(e?.message || '');
  if(message==='PASSWORD_SETUP_REQUIRED')return json({error:message,message:'관리자가 비밀번호 로그인 설정을 완료해야 합니다.'},503);
  const known = { UNAUTHENTICATED: [401, '로그인 시간이 끝났거나 계정 권한이 변경되었습니다. 다시 로그인해 주세요.'], LOGIN_INVALID:[401,'아이디 또는 비밀번호를 확인해 주세요.'], LOGIN_THROTTLED:[429,'로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'], AUTH_SETUP_REQUIRED:[503,'최고 관리자의 최초 계정 설정이 필요합니다.'], BRIDGE_UPDATE_REQUIRED:[503,'관리자가 데이터 연결 파일을 업데이트해야 합니다.'], FORBIDDEN: [403, '허용된 계정과 작업 권한을 확인해 주세요.'], NOT_FOUND:[404,'요청한 항목을 찾을 수 없습니다.'], SETUP_REQUIRED: [503, '운영 연결 설정이 필요합니다. 관리자에게 알려주세요.'], BRIDGE_UNAVAILABLE: [502, '자료 저장소에 연결하지 못했습니다. 입력 내용은 이 창에 남아 있습니다.'], BUSY_RETRY: [409, '다른 저장이 진행 중입니다. 잠시 후 다시 저장해 주세요.'] };
  for (const [code, [status, text]] of Object.entries(known)) if (message === code) return json({ error: code, message: text }, status);
  if (message.startsWith('CONFLICT')) return json({ error: 'CONFLICT', message: '다른 창에서 저장한 내용이 있습니다. 현재 내용을 확인한 뒤 다시 불러와 주세요.' }, 409);
  return json({ error: 'REQUEST_FAILED', message: /[가-힣]/.test(message) && !/Exception|GCP|API\(/.test(message) ? message.slice(0,300) : '요청을 완료하지 못했습니다. 입력 내용과 관리자 연결 설정을 확인해 주세요.' }, 400);
}
