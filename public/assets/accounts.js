(() => {
  'use strict';
  const $=id=>document.getElementById(id),roles={SUPER_ADMIN:'최고 관리자',ADMIN:'서브 관리자',FARMER:'농가 계정'};
  let me=null,accounts=[],farms=[],editing=null;
  const admin=()=>['SUPER_ADMIN','ADMIN'].includes(me?.role),uid=()=>crypto.randomUUID().replace(/-/g,'');
  function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text||'';if(cls)n.className=cls;return n;}
  async function call(payload){const r=await fetch('/api/accounts',payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{}),body=await r.json();if(!r.ok)throw Error(body.message||'계정 정보를 불러오지 못했습니다.');return body.data;}
  async function adminCall(action,payload={}){const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})}),body=await r.json();if(!r.ok||body.error)throw Error(body.message||body.error||'관리 작업을 완료하지 못했습니다.');return body.data;}
  function loadExecutiveModule(){if(document.querySelector('script[data-code1-admin-ops]'))return;const s=document.createElement('script');s.src='/assets/admin-ops.js';s.async=false;s.dataset.code1AdminOps='1';document.head.append(s);}
  loadExecutiveModule();
  function myInfo(){
    $('accounts-title').textContent=admin()?'계정 관리':'내 계정';
    $('my-account-description').textContent=`${me.displayName} · ${roles[me.role]} · 로그인 아이디: ${me.username}`;
    $('current-password-label').hidden=!me.hasPassword;$('current-password').required=false;
    $('account-management').hidden=!admin();
  }
  window.addEventListener('code1-ready',e=>{me=e.detail.user;accounts=[];farms=[];$('account-list').replaceChildren();$('account-farms').replaceChildren();myInfo();});
  window.addEventListener('code1-accounts-open',()=>{if(admin())load().catch(e=>$('account-list').textContent=e.message);});
  async function removeAccount(account,button){
    if(me?.role!=='SUPER_ADMIN'||account.id===me.id||account.role==='SUPER_ADMIN')return;
    if(!confirm(`${account.displayName} (${account.username}) 계정을 삭제할까요?\n\n로그인이 즉시 차단되고 담당 농가 권한이 해제됩니다. 기존 감사·작업 이력은 보존됩니다.`))return;
    button.disabled=true;
    try{await adminCall('admin.account.delete',{id:account.id,reason:'최고 관리자 웹 삭제',requestId:uid()});await load();}
    catch(error){alert(error.message);button.disabled=false;}
  }
  async function load(){
    const data=await call();accounts=data.accounts;farms=data.farms;
    $('account-list').replaceChildren(...accounts.map(a=>{
      const card=node('article','','account-card'),desc=node('div');
      desc.append(node('h3',a.displayName),node('p',`${a.username} · ${roles[a.role]} · ${a.status==='active'?'사용 가능':'접근 중지'}`));
      const p=a.permissions,names=farms.filter(f=>p.farmIds.includes(f.id)).map(f=>f.name).join(', ');
      desc.append(node('p',p.allFarms?'모든 농가 · 제안서 · 검토':`농가 자료: ${p.farm==='none'?'숨김':p.farm==='view'?'보기만':'입력 가능'} / 제안서: ${p.deck==='none'?'숨김':p.deck==='view'?'보기만':'편집 가능'}${names?' / 담당 농가: '+names:''}`,'muted'));
      card.append(desc);const actions=node('div','','account-actions');
      if(a.id!==me.id&&a.role!=='SUPER_ADMIN'&&(me.role==='SUPER_ADMIN'||a.role==='FARMER')){
        const b=node('button','권한·계정 수정');b.type='button';b.addEventListener('click',()=>open(a));actions.append(b);
      }
      if(me.role==='SUPER_ADMIN'&&a.id!==me.id&&a.role!=='SUPER_ADMIN'){
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
    $('account-dialog-title').textContent=account?'계정과 권한 수정':'계정 추가';
    $('account-name').value=account?.displayName||'';$('account-username').value=account?.username||'';$('account-username').readOnly=!!account;
    $('account-password').value='';$('account-password').required=!account;
    $('account-role').value=account?.role||'FARMER';
    $('account-role').querySelector('[value="ADMIN"]').disabled=me.role!=='SUPER_ADMIN';
    $('account-status').value=account?.status||'active';
    $('permission-farm').value=account?.permissions.farm||'edit';$('permission-deck').value=account?.permissions.deck||'none';
    $('account-farms').replaceChildren(...farms.map(f=>{
      const l=node('label','','check'),c=document.createElement('input');c.type='checkbox';c.value=f.id;c.checked=account?.permissions.farmIds.includes(f.id)||false;
      l.append(c,node('span',f.name));return l;
    }));
    if(!farms.length)$('account-farms').append(node('p','먼저 농가 자료에서 농가를 등록하고 임시저장해 주세요.'));
    permissionsUI();$('account-dialog').showModal();
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
      $('account-save-result').textContent=`${saved.displayName} 계정을 저장했습니다. 아이디는 ${saved.username}입니다. 권한을 바꾸거나 접근을 중지하면 기존 로그인도 해제됩니다.`;
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
