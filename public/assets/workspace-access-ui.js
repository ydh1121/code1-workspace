(() => {
  'use strict';
  const rpcPath='/api/rpc';
  const upstreamFetch=window.fetch.bind(window);
  let access={initialized:false,owner:false,allowed:[]},permissions=null,boot=null;
  const allowed=()=>new Set(access.allowed||[]);
  const can=capability=>!!access.owner||allowed().has(capability);
  const requestUrl=input=>typeof input==='string'?input:(input&&input.url)||'';
  const rpcBody=init=>{try{return String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'?JSON.parse(init.body):null;}catch{return null;}};

  function captureBootstrap(data){
    if(!data?.user)return;
    boot=data;access=data.access||access;permissions=data.permissions||data.user.permissions||null;
    window.__CODE1_BOOTSTRAP__=data;
    window.__CODE1_ACCESS__={...access,allowed:[...(access.allowed||[])]};
    applyAccess();
    window.dispatchEvent(new CustomEvent('code1-access-ready',{detail:{access:window.__CODE1_ACCESS__,permissions,user:data.user}}));
  }

  window.fetch=async function(input,init){
    const response=await upstreamFetch(input,init),url=requestUrl(input),body=rpcBody(init);
    if(url.endsWith(rpcPath)&&body?.action==='bootstrap'){
      try{const json=await response.clone().json();if(response.ok&&!json?.error)captureBootstrap(json.data);}catch{}
    }
    return response;
  };

  function neutralGate(show){
    const gate=document.getElementById('auth-pending');
    if(gate)gate.hidden=!show;
  }
  function resolveGate(authenticated){
    document.body.classList.remove('auth-pending');
    neutralGate(false);
    const login=document.getElementById('login');
    if(login&&!authenticated)login.hidden=false;
  }

  function applyAccess(){
    const inputPolicyVisible=can('PAGE_INPUT_POLICY');
    document.querySelectorAll('button,a').forEach(node=>{
      if((node.textContent||'').trim()==='입력 항목 관리')node.hidden=!inputPolicyVisible;
    });
    const exportAllowed=can('DECK_EXPORT');
    for(const id of ['pdf','print']){
      const node=document.getElementById(id);if(node){node.disabled=!exportAllowed;node.title=exportAllowed?'':'이 계정에는 PDF·인쇄 권한이 없습니다.';}
    }
  }

  window.Code1Access={
    can,
    current:()=>({access:{...access,allowed:[...(access.allowed||[])]},permissions,boot}),
    refresh:applyAccess
  };

  const observer=new MutationObserver(()=>{if(boot)applyAccess();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('code1-ready',()=>{resolveGate(true);applyAccess();});

  // Resolve session state before exposing the login form. app.js performs the authoritative
  // restore/bootstrap; this request only prevents an authenticated refresh from painting login UI.
  neutralGate(true);
  upstreamFetch('/api/session',{headers:{'Accept':'application/json'}}).then(r=>r.json()).then(session=>{
    if(!session?.authenticated)resolveGate(false);
  }).catch(()=>resolveGate(false));
})();
