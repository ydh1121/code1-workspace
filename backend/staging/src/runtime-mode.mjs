export const APPS_SCRIPT='APPS_SCRIPT';
export const SUPABASE_STAGING='SUPABASE_STAGING';
const ALLOWED=new Set([APPS_SCRIPT,SUPABASE_STAGING]);

export function runtimeBackend(env={}){
  const value=String(env.CODE1_RUNTIME_BACKEND||APPS_SCRIPT).trim().toUpperCase();
  if(!ALLOWED.has(value))throw Error('SETUP_REQUIRED');
  return value;
}

export function useSupabaseStaging(env={}){
  return runtimeBackend(env)===SUPABASE_STAGING;
}
