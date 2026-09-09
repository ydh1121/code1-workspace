import {publicAccount, parsePermissions} from './core.mjs';

export async function loadActor(db, principal) {
  if (!principal || typeof principal.accountId !== 'string' || !Number.isInteger(principal.version)) throw Error('UNAUTHENTICATED');
  const rows = await db.select('workspace_accounts', `account_id=eq.${encodeURIComponent(principal.accountId)}&select=*`);
  const row = rows?.[0];
  if (!row || row.status !== 'active' || Number(row.session_version) !== principal.version) throw Error('UNAUTHENTICATED');
  let farmIds=[];
  if (row.role === 'FARMER') {
    const access = await db.select('farm_access', `account_id=eq.${encodeURIComponent(row.account_id)}&select=farm_id,access_level`);
    farmIds = (access||[]).map(x=>x.farm_id);
  }
  return {row, user:publicAccount(row,farmIds), farmIds};
}

export function isAdmin(actor) { return ['SUPER_ADMIN','ADMIN'].includes(actor?.row?.role); }

export async function assertFarmAccess(db, actor, farmId, edit=false) {
  if (!farmId) throw Error('FORBIDDEN');
  if (isAdmin(actor)) return;
  const p = parsePermissions(actor.row.permissions_json);
  if (p.farm === 'none' || (edit && p.farm !== 'edit')) throw Error('FORBIDDEN');
  const rows = await db.select('farm_access', `account_id=eq.${encodeURIComponent(actor.row.account_id)}&farm_id=eq.${encodeURIComponent(farmId)}&select=access_level`);
  const level = rows?.[0]?.access_level;
  if (!level || (edit && level !== 'edit')) throw Error('FORBIDDEN');
}

export function assertAdmin(actor) { if (!isAdmin(actor)) throw Error('FORBIDDEN'); }
