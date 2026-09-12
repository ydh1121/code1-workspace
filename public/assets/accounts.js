(() => {
  'use strict';
  const $=id=>document.getElementById(id),roles={SUPER_ADMIN:'최고 관리자',ADMIN:'서브 관리자',FARMER:'농가 계정'};
  let me=null,accounts=[],farms=[],editing=null,executiveReloaded=false,accessBundle=null;
  const admin=()=>['SUPER_ADMIN','ADMIN'].includes(me?.role),owner=()=>me?.role==='SUPER_ADMIN'&&me?.id==='OWNER',uid=()=>crypto.randomUUID().replace(/-/g,'');
  function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;}
  async function call(payload){const r=await fetch('/api/accounts',payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{}),body=await r.json();if(!r.ok)throw Error(body.message||'계정 정보를 불러오지 못했습니다.');return body.data;}
  async function adminCall(action,payload={}){const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})}),body=await r.json();if(!r.ok||body.error)throw Error(body.message||body.error||'관리 작업을 완료하지 못했습니다.');return body.data;}
  function loadExecutiveModule(force=false){
    const existing=document.querySelector('script[data-code1-admin-ops]');
    if(existing&&!force)return;
    const s=document.createElement('script');s.src='/assets/admin-ops.js'+(force?`?owner-reinit=${Date.now()}`:'');s.async=false;s.dataset.code1AdminOps='1';
    s.addEventListener('load',()=>{if(me)window.dispatchEvent(new CustomEvent('code1-ready',{detail:{user:me}}));},{once:true});
    document.head.append(s);
  }
  loadExecutiveModule();
  function ensureExecutiveModule(){
    if(!owner()||$('admin-ops-nav')||executiveReloaded)return;
    executiveReloaded=true;
    setTimeout(()=>{if(!$('admin-ops-nav'))loadExecutiveModule(true);},0);
  }
  function myInfo(){
    $('accounts-title').textContent=admin()?'계정 관리':'내 계정';
    $('my-account-description').textContent=`${me.displayName} · ${roles[me.role]} · 로그인 아이디: ${me.username}`;
    $('current-password-label').hidden=!me.hasPassword;$('current-password').required=false;
    $('account-management').hidden=!admin();
  }
  window.addEventListener('code1-ready',e=>{me=e.detail.user;accounts=[];farms=[];accessBundle=null;$('account-list').replaceChildren();$('account-farms').replaceChildren();myInfo();ensureExecutiveModule();});
  window.addEventListener('code1-accounts-open',()=>{if(admin())load().catch(e=>$('account-list').textContent=e.message);});
  async function removeAccount(account,button){
    if(!owner()||account.id===me.id||account.role==='SUPER_ADMIN')return;
    if(!confirm(`${account.displayName} (${account.username}) 계정을 삭제할까요?\n\n로그인이 즉시 차단되고 담당 농가 권한이 해제됩니다. 기존 감사·작업 이력은 보존됩니다.`))return;
    button.disabled=true;
    try{await adminCall('admin.account.delete',{id:account.id,reason:'최고 관리자 웹 삭제',requestId:uid()});await load();}
    catch(error){alert(error.message);button.disabled=false;}
  }
  function accessFor(id){return accessBundle?.accounts?.find(a=>a.id===id)?.access||null;}
  function accessSummary(profile){
    if(!profile)return '';
    if(profile.owner)return '전체 권한';
    const names={PAGE_FARM:'농가',PAGE_DECK:'제안서',PAGE_PLANNING:'경영·기획',PAGE_INPUT_POLICY:'입력항목',PAGE_ACCOUNTS:'계정'};
    const pages=(profile.allowed||[]).filter(x=>names[x]).map(x=>names[x]);
    return `${profile.initialized?'명시 권한':'기존 범위 유지'} · ${pages.length?pages.join(' · '):'업무 페이지 없음'}`;
  }
  async function load(){
    const data=await call();accounts=data.accounts;farms=data.farms;
    if(owner()){
      try{accessBundle=await adminCall('admin.access.list');}catch{accessBundle=null;}
    }
    $('account-list').replaceChildren(...accounts.map(a=>{
      const card=node('article','','account-card'),desc=node('div');
      desc.append(node('h3',a.displayName),node('p',`${a.username} · ${roles[a.role]} · ${a.status==='active'?'사용 가능':'접근 중지'}`));
      const p=a.permissions,names=farms.filter(f=>p.farmIds.includes(f.id)).map(f=>f.name).join(', ');
      desc.append(node('p',p.allFarms?'기본범위: 모든 농가 · 제안서 · 검토':`기본범위: 농가 ${p.farm==='none'?'숨김':p.farm==='view'?'보기':'입력'} / 제안서 ${p.deck==='none'?'숨김':p.deck==='view'?'보기':'편집'}${names?' / 담당 '+names:''}`,'muted'));
      const profile=accessFor(a.id);if(profile&&!profile.owner)desc.append(node('p','세부권한: '+accessSummary(profile),'muted'));
      card.append(desc);const actions=node('div','','account-actions');
      if(a.id!==me.id&&a.role!=='SUPER_ADMIN'&&(owner()||a.role==='FARMER')){
        const b=node('button','계정 기본설정');b.type='button';b.addEventListener('click',()=>open(a));actions.append(b);
      }
      if(owner()&&a.id!==me.id&&a.role!=='SUPER_ADMIN'){
        const access=node('button','페이지·기능 권한');access.type='button';access.addEventListener('click',()=>openAccessEditor(a).catch(error=>alert(error.message)));actions.append(access);
        const d=node('button','계정 삭제','danger');d.type='button';d.addEventListener('click',()=>removeAccount(a,d));actions.append(d);
      }
      if(actions.childNodes.length)card.append(actions);
      return card;
    }));
  }
  function permissionsUI(){
    const isSub=$('account-role').value==='ADMIN';$('account-permissions').hidden=isSub;$('admin-access-note').hidden=!isSub;
    $('farm-assignment').hidden=$('permission-farm').value==='none';
  }
  function open(account=null){
    editing=account;$('account-form').reset();$('account-save-result').textContent='';
    $('account-dialog-title').textContent=account?'계정 기본설정':'계정 추가';
    $('account-name').value=account?.displayName||'';$('account-username').value=account?.username||'';$('account-username').readOnly=!!account;
    $('account-password').value='';$('account-password').required=!account;
    $('account-role').value=account?.role||'FARMER';
    $('account-role').querySelector('[value="ADMIN"]').disabled=!owner();
    $('account-status').value=account?.status||'active';
    $('permission-farm').value=account?.permissions.farm||'edit';$('permission-deck').value=account?.permissions.deck||'none';
    $('account-farms').replaceChildren(...farms.map(f=>{
      const l=node('label','','check'),c=document.createElement('input');c.type='checkbox';c.value=f.id;c.checked=account?.permissions.farmIds.includes(f.id)||false;
      l.append(c,node('span',f.name));return l;
    }));
    if(!farms.length)$('account-farms').append(node('p','먼저 농가 자료에서 농가를 등록하고 임시저장해 주세요.'));
    permissionsUI();$('account-dialog').showModal();
  }

  const parentByCapability={
    FARM_EDIT:'PAGE_FARM',FARM_REVIEW:'PAGE_FARM',DECK_EDIT:'PAGE_DECK',DECK_EXPORT:'PAGE_DECK',
    PLANNING_EDIT:'PAGE_PLANNING',PLANNING_FEEDBACK:'PAGE_PLANNING',EXECUTIVE_BRIEF_VIEW:'PAGE_PLANNING',FACT_SUBMIT:'PAGE_PLANNING',FACT_VERIFY:'PAGE_PLANNING',FACT_APPROVE_CURRENT:'PAGE_PLANNING',
    ACCOUNT_MANAGE:'PAGE_ACCOUNTS',INPUT_POLICY_MANAGE:'PAGE_INPUT_POLICY'
  };
  function accessDialog(){
    let dialog=$('access-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='access-dialog';dialog.className='access-dialog no-print';
    dialog.innerHTML='<div class="access-dialog-inner"><div class="access-dialog-head"><h2 id="access-dialog-title">페이지·기능 권한</h2><button type="button" id="access-close">닫기</button></div><div class="access-dialog-body"><div id="access-notice"></div><div class="access-toolbar"><button type="button" id="access-all">전체 선택</button><button type="button" id="access-none">전체 해제</button><button type="button" id="access-pages">페이지 기본만</button></div><div id="access-groups" class="access-groups"></div></div><div class="access-dialog-actions"><span id="access-result" role="status"></span><button type="button" class="primary" id="access-save">권한 저장</button></div></div>';
    document.body.append(dialog);$('access-close').addEventListener('click',()=>dialog.close());
    $('access-all').addEventListener('click',()=>dialog.querySelectorAll('input[data-access-cap]').forEach(x=>x.checked=true));
    $('access-none').addEventListener('click',()=>dialog.querySelectorAll('input[data-access-cap]').forEach(x=>x.checked=false));
    $('access-pages').addEventListener('click',()=>dialog.querySelectorAll('input[data-access-cap]').forEach(x=>x.checked=x.value.startsWith('PAGE_')));
    dialog.addEventListener('change',e=>{
      const input=e.target.closest('input[data-access-cap]');if(!input)return;
      const parent=parentByCapability[input.value];if(input.checked&&parent){const p=dialog.querySelector(`input[value="${parent}"]`);if(p)p.checked=true;}
      if(!input.checked&&input.value.startsWith('PAGE_'))dialog.querySelectorAll('input[data-access-cap]').forEach(child=>{if(parentByCapability[child.value]===input.value)child.checked=false;});
    });
    return dialog;
  }
  async function openAccessEditor(account){
    if(!owner())return;
    accessBundle=await adminCall('admin.access.list');const record=accessBundle.accounts.find(x=>x.id===account.id);if(!record)throw Error('계정 권한 정보를 찾지 못했습니다.');
    const dialog=accessDialog(),profile=record.access||{initialized:false,allowed:[]},allowed=new Set(profile.allowed||[]);dialog.dataset.accountId=account.id;
    $('access-dialog-title').textContent=`${account.displayName} · 페이지·기능 권한`;
    const notice=$('access-notice');notice.className='access-notice'+(profile.initialized?'':' legacy');notice.textContent=profile.initialized?'저장된 명시 권한을 적용 중입니다. 체크하지 않은 페이지와 기능은 서버에서도 차단됩니다.':'아직 세부권한을 저장하지 않아 기존 접근 범위를 유지하고 있습니다. 지금 저장하면 체크된 범위만 명시적으로 허용되며 해당 계정의 기존 로그인은 즉시 해제됩니다.';
    $('access-result').textContent='';$('access-groups').replaceChildren(...(accessBundle.catalog||[]).map(group=>{
      const section=node('section','','access-group');section.append(node('h3',group.group));const list=node('div','','access-list');
      for(const [cap,label,description] of group.items){const item=node('label','','access-item'),check=document.createElement('input');check.type='checkbox';check.value=cap;check.dataset.accessCap='1';check.checked=allowed.has(cap);const text=node('span');text.append(node('strong',label),node('small',description));item.append(check,text);list.append(item);}section.append(list);return section;
    }));
    $('access-save').onclick=async()=>{
      const button=$('access-save');button.disabled=true;$('access-result').textContent='저장 중…';
      try{const capabilities=[...dialog.querySelectorAll('input[data-access-cap]:checked')].map(x=>x.value);await adminCall('admin.access.save',{id:account.id,capabilities,requestId:uid()});$('access-result').textContent='저장 완료 · 해당 계정의 기존 로그인은 해제되었습니다.';await load();setTimeout(()=>dialog.close(),650);}catch(error){$('access-result').textContent=error.message;}finally{button.disabled=false;}
    };
    dialog.showModal();
  }

  $('add-account').addEventListener('click',async()=>{try{await load();open();}catch(e){$('account-list').textContent=e.message;}});
  $('close-account').addEventListener('click',()=>$('account-dialog').close());
  $('account-role').addEventListener('change',permissionsUI);$('permission-farm').addEventListener('change',permissionsUI);
  $('account-dialog').addEventListener('close',()=>{$('account-password').value='';});
  $('account-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=$('save-account');button.disabled=true;$('account-save-result').textContent='저장 중…';
    try{
      const payload={action:'save',id:editing?.id||'',baseVersion:editing?.version,username:$('account-username').value,displayName:$('account-name').value,password:$('account-password').value,role:$('account-role').value,status:$('account-status').value,permissions:{farm:$('permission-farm').value,deck:$('permission-deck').value,farmIds:[...document.querySelectorAll('#account-farms input:checked')].map(n=>n.value)}};
      const saved=await call(payload);editing=saved;$('account-password').value='';$('account-password').required=false;$('account-username').readOnly=true;
      $('account-save-result').textContent=`${saved.displayName} 계정을 저장했습니다. 아이디는 ${saved.username}입니다. 세부 페이지·기능 권한은 최고 관리자 화면에서 별도로 지정할 수 있습니다.`;
      await load();
    }catch(error){$('account-save-result').textContent=error.message;}finally{button.disabled=false;}
  });
  $('copy-login-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/');$('account-save-result').textContent='로그인 링크를 복사했습니다. 등록한 아이디와 비밀번호는 담당자에게 별도로 안내해 주세요.';}catch{$('account-save-result').textContent='로그인 주소: '+location.origin+'/';}});
  $('my-password-form').addEventListener('submit',async e=>{
    e.preventDefault();const b=e.submitter||$('my-password-form').querySelector('button');b.disabled=true;
    try{
      const password=$('my-new-password').value;if(password!==$('my-new-password-confirm').value)throw Error('새 비밀번호가 서로 다릅니다.');
      me=await call({action:'password',password,currentPassword:$('current-password').value});$('my-password-form').reset();myInfo();
      window.dispatchEvent(new CustomEvent('code1-account-updated',{detail:me}));
      $('my-password-result').textContent='비밀번호를 저장했습니다. 다른 기기의 기존 로그인은 해제되었습니다.';
    }catch(error){$('my-password-result').textContent=error.message;}finally{b.disabled=false;}
  });
})();
