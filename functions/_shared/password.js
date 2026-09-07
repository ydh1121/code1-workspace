import { equal, hmac } from './security.js';
const enc=new TextEncoder();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g),x=>parseInt(x,16));
export const PASSWORD_SCHEME='pbkdf2-sha256-pepper-v1';
export async function passwordHash(password,env,salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {
  if(typeof password!=='string'||password.length<12||password.length>128)throw Error('비밀번호는 12~128자로 입력해 주세요.');
  if(!env.PASSWORD_PEPPER||env.PASSWORD_PEPPER.length<32)throw Error('PASSWORD_SETUP_REQUIRED');
  if(!/^[a-f0-9]{32}$/.test(salt))throw Error('LOGIN_INVALID');
  // Workers' native WebCrypto PBKDF2 cap is 100,000. A separate server-only
  // pepper protects a leaked Sheet; session/key rotation does not change hashes.
  const material=await hmac('code1-password-v1:'+password,env.PASSWORD_PEPPER);
  const key=await crypto.subtle.importKey('raw',enc.encode(material),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:100000,hash:'SHA-256'},key,256);
  return {salt,hash:hex(new Uint8Array(bits)),iterations:100000,scheme:PASSWORD_SCHEME};
}
export async function passwordMatches(password,credential,env) {
  if(typeof password!=='string'||password.length<12||password.length>128)return false;
  const valid=credential&&credential.scheme===PASSWORD_SCHEME&&credential.iterations===100000&&/^[a-f0-9]{32}$/.test(credential.salt)&&/^[a-f0-9]{64}$/.test(credential.hash);
  const candidate=await passwordHash(password,env,valid?credential.salt:'0'.repeat(32));
  return !!valid&&equal(candidate.hash,credential.hash);
}
