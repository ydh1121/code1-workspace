export const ROLES = new Set(['SUPER_ADMIN','ADMIN','FARMER']);
export const FARM_LEVELS = new Set(['none','view','edit']);
export const DECK_LEVELS = new Set(['none','view','edit']);
export const POLICY_REASON_CODES = new Set(['DUPLICATE','DERIVED','NOT_APPLICABLE','LATER_PHASE','COLLECT_LATER','SENSITIVE','LOW_VALUE','OTHER']);
export const NON_BLOCKING_POLICY_MODES = new Set(['OPTIONAL','HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE']);
export const HIDDEN_POLICY_MODES = new Set(['HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE']);

export function publicAccount(row, farmIds = []) {
  if (!row || row.archived_at || !ROLES.has(row.role) || !['active','disabled'].includes(row.status)) throw Error('UNAUTHENTICATED');
  if (row.role === 'SUPER_ADMIN' && row.account_id !== 'OWNER') throw Error('FORBIDDEN');
  const admin = row.role === 'SUPER_ADMIN' || row.role === 'ADMIN';
  const raw = parsePermissions(row.permissions_json);
  const permissions = admin
    ? {farm:'edit',deck:'edit',farmIds:[],allFarms:true,accounts:true,review:true}
    : {farm:raw.farm,deck:raw.deck,farmIds:[...farmIds],allFarms:false,accounts:false,review:false};
  return {
    id: row.account_id,
    username: row.username,
    displayName: row.display_name,
    email: row.email || '',
    role: row.role,
    status: row.status,
    permissions,
    version: Number(row.session_version),
    hasPassword: !!row.password_hash
  };
}

export function parsePermissions(value) {
  let p = value;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = {}; } }
  p = p && typeof p === 'object' ? p : {};
  const farm = FARM_LEVELS.has(p.farm) ? p.farm : 'none';
  const deck = DECK_LEVELS.has(p.deck) ? p.deck : 'none';
  const farmIds = Array.isArray(p.farmIds) ? p.farmIds.filter(v=>typeof v==='string') : [];
  return {farm,deck,farmIds};
}

export function resolvePolicy(itemKey, farmId, rows = []) {
  const active = rows.filter(r => r && r.status !== 'inactive' && r.item_key === itemKey);
  const global = active.find(r => r.scope === 'GLOBAL' && !r.farm_id);
  if (global?.mode === 'PERMANENT_EXCLUDE') return {mode:'PERMANENT_EXCLUDE', source:'GLOBAL'};
  const farm = active.find(r => r.scope === 'FARM' && r.farm_id === farmId);
  if (farm && farm.mode !== 'INHERIT') return {mode:farm.mode, source:'FARM'};
  if (global) return {mode:global.mode, source:'GLOBAL'};
  return {mode:'SHOW', source:'DEFAULT'};
}

export const policyVisible = mode => !HIDDEN_POLICY_MODES.has(mode);
export const policyBlocking = mode => !NON_BLOCKING_POLICY_MODES.has(mode);

export function cleanString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

export function safeObjectKeyPart(value, fallback='item') {
  const out = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return out || fallback;
}

export function privateObjectKey({farmId, submissionId, mediaId, fileName}) {
  if (!farmId || !submissionId || !mediaId) throw Error('INVALID_MEDIA_IDENTITY');
  return `private/farms/${safeObjectKeyPart(farmId)}/submissions/${safeObjectKeyPart(submissionId)}/media/${safeObjectKeyPart(mediaId)}/original/${safeObjectKeyPart(fileName,'original')}`;
}

export function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!sorted.length) return null;
  const i = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}
