(() => {
  'use strict';
  const dialog=document.getElementById('export-dialog');
  const list=document.getElementById('qa-list');
  const confirm=document.getElementById('confirm-print');
  if(!dialog||!list||!confirm)return;

  const overflowText=t=>/글자가 텍스트 상자를 넘습니다\.?$/.test(String(t||'').trim());
  const issues=()=>Array.from(list.querySelectorAll('li'));
  const overflowOnly=()=>{
    const rows=issues();
    return rows.length>0&&rows.every(li=>overflowText(li.textContent));
  };
  function refresh(){
    const rows=issues();
    rows.forEach(li=>{
      if(overflowText(li.textContent)){
        li.classList.remove('qa-error');
        li.classList.add('qa-warning');
      }
    });
    if(dialog.open&&overflowOnly()){
      confirm.disabled=false;
      confirm.textContent='경고 확인 후 인쇄창 열기';
    }
  }
  new MutationObserver(refresh).observe(dialog,{attributes:true,childList:true,subtree:true});
  confirm.addEventListener('click',e=>{
    if(!dialog.open||!overflowOnly())return;
    e.preventDefault();
    e.stopImmediatePropagation();
    dialog.close();
    window.print();
  },true);
})();
