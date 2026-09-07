const enc = new TextEncoder();
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
export function configured(env) { return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.APP_ORIGIN && env.BRIDGE_URL && env.BRIDGE_SECRET?.length >= 32 && env.SESSION_SECRET?.length >= 32); }
export function origin(env) { const u = new URL(env.APP_ORIGIN); if (u.protocol !== 'https:' || u.origin !== env.APP_ORIGIN) throw Error('SETUP_REQUIRED'); return u.origin; }
export async function session(request, env) { const s = await verify(readCookie(request, '__Host-code1'), env.SESSION_SECRET); if (!s || s.kind !== 'session' || typeof s.email !== 'string') throw Error('UNAUTHENTICATED'); return s; }
export function sameOrigin(request, env) { if (request.headers.get('Origin') !== origin(env)) throw Error('FORBIDDEN'); }
export async function bridge(env, email, action, payload = {}) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.BRIDGE_URL || '')) throw Error('SETUP_REQUIRED');
  const body = JSON.stringify({ email, action, payload, timestamp: Date.now(), nonce: crypto.randomUUID().replace(/-/g, '') });
  // Signature covers the exact UTF-8 body, including identity, method and payload.
  const res = await fetch(env.BRIDGE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ body, signature: await hmac(body, env.BRIDGE_SECRET) }), redirect: 'follow', signal: AbortSignal.timeout(55000) });
  let result; try { result = await res.json(); } catch { throw Error('BRIDGE_UNAVAILABLE'); }
  if (!res.ok || !result.ok) throw Error(result.error || 'BRIDGE_UNAVAILABLE');
  return result.data;
}
export function failure(e) {
  const message = String(e?.message || '');
  const known = { UNAUTHENTICATED: [401, '로그인이 필요합니다.'], FORBIDDEN: [403, '허용된 계정과 작업 권한을 확인해 주세요.'], SETUP_REQUIRED: [503, '운영 연결 설정이 필요합니다. 관리자에게 알려주세요.'], BRIDGE_UNAVAILABLE: [502, '자료 저장소에 연결하지 못했습니다. 입력 내용은 이 창에 남아 있습니다.'], BUSY_RETRY: [409, '다른 저장이 진행 중입니다. 잠시 후 다시 저장해 주세요.'] };
  for (const [code, [status, text]] of Object.entries(known)) if (message === code) return json({ error: code, message: text }, status);
  if (message.startsWith('CONFLICT')) return json({ error: 'CONFLICT', message: '다른 창에서 저장한 내용이 있습니다. 현재 내용을 확인한 뒤 다시 불러와 주세요.' }, 409);
  return json({ error: 'REQUEST_FAILED', message: /[가-힣]/.test(message) && !/Exception|GCP|API\(/.test(message) ? message.slice(0,300) : '요청을 완료하지 못했습니다. 입력 내용과 관리자 연결 설정을 확인해 주세요.' }, 400);
}
