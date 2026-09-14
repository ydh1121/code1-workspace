(() => {
  'use strict';

  let me=null;
  let decorating=false;
  let timer=null;
  const uid=()=>crypto.randomUUID().replace(/-/g,'');

  async function rpc(action,payload={}){
    const response=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    const body=await response.json();
    if(!response.ok||body.error)throw Error(body.message||body.error||'요청을 처리하지 못했습니다.');
    return body.data;
  }

  function ensureStyle(){
    if(document.getElementById('material-request-delete-style'))return;
    const style=document.createElement('style');
    style.id='material-request-delete-style';
    style.textContent=`
      .material-request-row-shell{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch}
      .material-request-row-shell>.material-request-row{min-width:0}
      .material-request-delete{align-self:stretch;min-width:72px;border:1px solid #e3b8b8!important;background:#fff!important;color:#a12f2f!important;font-weight:700}
      .material-request-delete:hover{background:#fff5f5!important;border-color:#d88e8e!important}
      @media(max-width:720px){.material-request-row-shell{grid-template-columns:1fr}.material-request-delete{min-height:42px}}
    `;
    document.head.append(style);
  }

  function refreshMaterialList(){
    const tab=document.querySelector('[data-admin-tab="materials"]');
    if(tab)tab.click();
  }

  async function deleteRequest(request,button){
    const message=`“${request.title}” 자료요청을 삭제할까요?\n\n비어 있고 아직 사용되지 않은 요청은 완전히 삭제됩니다.\n파일·제출·검토 등 이력이 있는 요청은 화면에서 제거되지만 기록은 보존됩니다.`;
    if(!confirm(message))return;
    button.disabled=true;
    button.textContent='처리 중…';
    try{
      const result=await rpc('planning.material.request.delete',{
        materialRequestId:request.materialRequestId,
        confirmTitle:request.title,
        requestId:uid()
      });
      alert(result?.mode==='DELETED'?'비어 있는 자료요청을 삭제했습니다.':'자료·검토 이력이 있어 요청을 보관 처리했습니다. 기존 기록은 유지됩니다.');
      refreshMaterialList();
    }catch(error){
      alert(String(error?.message||error));
      button.disabled=false;
      button.textContent='삭제';
    }
  }

  async function decorate(){
    if(decorating||me?.role!=='SUPER_ADMIN')return;
    const list=document.querySelector('.material-workspace .material-request-list');
    if(!list)return;
    const rawRows=[...list.querySelectorAll(':scope > .material-request-row')];
    if(!rawRows.length)return;
    decorating=true;
    try{
      const boot=await rpc('planning.material.bootstrap');
      const requests=(boot?.requests||[]).filter(request=>request.status!=='ARCHIVED');
      rawRows.forEach((row,index)=>{
        const request=requests[index];
        if(!request||row.closest('.material-request-row-shell'))return;
        row.dataset.materialRequestId=request.materialRequestId;
        const shell=document.createElement('div');
        shell.className='material-request-row-shell';
        shell.dataset.materialRequestId=request.materialRequestId;
        const deleteButton=document.createElement('button');
        deleteButton.type='button';
        deleteButton.className='material-request-delete';
        deleteButton.textContent='삭제';
        deleteButton.setAttribute('aria-label',`${request.title} 자료요청 삭제`);
        deleteButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();deleteRequest(request,deleteButton);});
        row.replaceWith(shell);
        shell.append(row,deleteButton);
      });
    }catch{/* main Planning Material surface owns its own error state */}
    finally{decorating=false;}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,30);}

  window.addEventListener('code1-ready',event=>{
    me=event.detail?.user||null;
    if(me?.role==='SUPER_ADMIN'){ensureStyle();schedule();}
  });

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
