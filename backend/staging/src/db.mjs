const jsonHeaders = {'Content-Type':'application/json'};

export function assertStagingEnv(env) {
  const url = String(env.CODE1_SUPABASE_URL || '');
  const ref = String(env.CODE1_STAGING_PROJECT_REF || '');
  const key = String(env.CODE1_SUPABASE_SERVICE_ROLE_KEY || '');
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) throw Error('CODE1_STAGING_PROJECT_REF_REQUIRED');
  let parsed; try { parsed = new URL(url); } catch { throw Error('CODE1_SUPABASE_URL_REQUIRED'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== `${ref}.supabase.co`) throw Error('CODE1_STAGING_REF_MISMATCH');
  if (!key || key.length < 32) throw Error('CODE1_SUPABASE_SERVICE_ROLE_KEY_REQUIRED');
  return {url:parsed.origin, ref, key};
}

export function createDb(env, fetchImpl = fetch) {
  const cfg = assertStagingEnv(env);
  async function request(path, {method='GET', body, headers={}}={}) {
    const response = await fetchImpl(cfg.url + path, {
      method,
      headers:{...jsonHeaders,apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,...headers},
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null; if (text) { try { data=JSON.parse(text); } catch { data=text; } }
    if (!response.ok) {
      const message = data?.message || data?.hint || data?.code || `SUPABASE_${response.status}`;
      const e = Error(message); e.status=response.status; e.data=data; throw e;
    }
    return data;
  }
  const q = value => encodeURIComponent(value);
  return {
    request,
    select(table, query='') { return request(`/rest/v1/${table}${query ? '?' + query : ''}`); },
    insert(table, rows, prefer='return=representation') { return request(`/rest/v1/${table}`,{method:'POST',body:rows,headers:{Prefer:prefer}}); },
    update(table, query, patch, prefer='return=representation') { return request(`/rest/v1/${table}?${query}`,{method:'PATCH',body:patch,headers:{Prefer:prefer}}); },
    delete(table, query, prefer='return=representation') { return request(`/rest/v1/${table}?${query}`,{method:'DELETE',headers:{Prefer:prefer}}); },
    rpc(name, body) { return request(`/rest/v1/rpc/${name}`,{method:'POST',body}); },
    eq(column, value) { return `${encodeURIComponent(column)}=eq.${q(value)}`; },
    inList(column, values) { return `${encodeURIComponent(column)}=in.(${values.map(v=>q(v)).join(',')})`; }
  };
}
