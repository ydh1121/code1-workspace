(() => {
  'use strict';
  const dialog=document.getElementById('export-dialog');
  const list=document.getElementById('qa-list');
  const confirm=document.getElementById('confirm-print');
  const pdf=document.getElementById('pdf');
  const printButton=document.getElementById('print');
  if(!dialog||!list||!confirm||!pdf||!printButton)return;

  const nativePrint=window.print.bind(window);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const overflowText=t=>/글자가 텍스트 상자를 넘습니다\.?$/.test(String(t||'').trim());
  const issues=()=>Array.from(list.querySelectorAll('li'));
  let bypass=false,preparing=false;

  function row(text,cls){const li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;return li;}
  function blockingRows(){return issues().filter(li=>!overflowText(li.textContent)&&!li.classList.contains('qa-status')&&!li.classList.contains('qa-ok')&&!li.classList.contains('qa-warning'));}
  function refresh(){
    issues().forEach(li=>{
      if(overflowText(li.textContent)){
        li.classList.remove('qa-error');
        li.classList.add('qa-warning');
      }
    });
    if(!dialog.open)return;
    if(blockingRows().length){confirm.disabled=true;confirm.textContent='문제 확인 필요';return;}
    if(!preparing){confirm.disabled=false;confirm.textContent=issues().some(li=>li.classList.contains('qa-warning'))?'경고 확인 후 인쇄창 열기':'인쇄창 열기';}
  }

  function installFastChecks(){
    let printRequested=false;
    const originalPrint=window.print;
    const imageProto=window.HTMLImageElement&&HTMLImageElement.prototype;
    const originalDecode=imageProto&&imageProto.decode;
    const fontProto=document.fonts?Object.getPrototypeOf(document.fonts):null;
    const originalFontLoad=fontProto&&fontProto.load;

    window.print=()=>{printRequested=true;};
    if(originalDecode){
      imageProto.decode=function(){
        if(this.complete&&this.naturalWidth>0)return Promise.resolve();
        let timer;
        const timeout=new Promise(resolve=>{timer=setTimeout(resolve,2500);});
        return Promise.race([
          Promise.resolve().then(()=>originalDecode.call(this)).catch(()=>undefined),
          timeout
        ]).finally(()=>clearTimeout(timer));
      };
    }
    if(originalFontLoad){
      fontProto.load=function(font){
        return originalFontLoad.call(this,font,'CODE1 가나다 ABC 123');
      };
    }
    return {
      requested:()=>printRequested,
      restore(){
        window.print=originalPrint;
        if(originalDecode)imageProto.decode=originalDecode;
        if(originalFontLoad)fontProto.load=originalFontLoad;
      }
    };
  }

  async function runPreflight(button){
    if(preparing)return;
    preparing=true;
    list.replaceChildren(row('출력용 페이지를 준비하고 있습니다. 잠시만 기다려 주세요.','qa-status'));
    confirm.disabled=true;
    confirm.textContent='출력 준비 중…';
    if(!dialog.open)dialog.showModal();

    // Let the modal paint before the legacy full-deck preflight starts.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const patch=installFastChecks();
    let finished=false;
    const observer=new MutationObserver(()=>{
      const rows=issues();
      if(rows.length&&rows.every(li=>!li.classList.contains('qa-status')))finished=true;
    });
    observer.observe(list,{childList:true,subtree:true});

    try{
      bypass=true;
      button.click();
      bypass=false;

      // Existing preflight calls window.print() when all hard checks pass. We suppress
      // that automatic call so the user always sees this dialog first.
      while(!patch.requested()&&!finished)await sleep(50);

      if(patch.requested()&&!issues().length){
        list.replaceChildren(row('출력 준비가 완료되었습니다.','qa-ok'));
      }
    }finally{
      observer.disconnect();
      patch.restore();
      preparing=false;
      refresh();
    }
  }

  function intercept(button){
    button.addEventListener('click',event=>{
      if(bypass)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runPreflight(button).catch(error=>{
        preparing=false;
        list.replaceChildren(row('출력 준비 중 오류가 발생했습니다: '+String(error?.message||error),'qa-error'));
        if(!dialog.open)dialog.showModal();
        refresh();
      });
    },true);
  }
  intercept(pdf);
  intercept(printButton);

  new MutationObserver(refresh).observe(dialog,{attributes:true,childList:true,subtree:true});

  confirm.addEventListener('click',event=>{
    if(confirm.disabled||blockingRows().length)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dialog.close();
    nativePrint();
  },true);
})();
