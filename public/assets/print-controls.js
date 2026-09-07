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
  let bypass=false,preparing=false,printSignal=0;

  // The legacy preflight used to open the browser print dialog automatically after
  // several async checks. Keep that call as a completion signal instead, so a late
  // check can never pop a print dialog after the user already cancelled or timed out.
  window.print=()=>{printSignal++;};

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
    const imageProto=window.HTMLImageElement&&HTMLImageElement.prototype;
    const originalDecode=imageProto&&imageProto.decode;
    const fontProto=document.fonts?Object.getPrototypeOf(document.fonts):null;
    const originalFontLoad=fontProto&&fontProto.load;

    if(originalDecode){
      imageProto.decode=function(){
        if(this.complete&&this.naturalWidth>0)return Promise.resolve();
        let timer;
        const timeout=new Promise(resolve=>{timer=setTimeout(resolve,2500);});
        return Promise.race([
          Promise.resolve().then(()=>originalDecode.call(this)),
          timeout
        ]).finally(()=>clearTimeout(timer));
      };
    }
    if(originalFontLoad){
      fontProto.load=function(font){
        // Do not shape every character from all 12 slides just to verify one font.
        return originalFontLoad.call(this,font,'CODE1 가나다 ABC 123');
      };
    }
    return {
      restore(){
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

    // Paint the modal first. Previously the page started building all 12 print pages
    // before the user saw any feedback, which looked like a frozen browser.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const patch=installFastChecks();
    const signalAtStart=printSignal;
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

      const deadline=Date.now()+8000;
      while(printSignal===signalAtStart&&!finished&&Date.now()<deadline)await sleep(50);

      if(printSignal!==signalAtStart&&!issues().length){
        list.replaceChildren(row('출력 준비가 완료되었습니다.','qa-ok'));
      }else if(!finished&&printSignal===signalAtStart){
        list.replaceChildren(row('자동 사전검사가 8초 안에 끝나지 않아 대기를 중단했습니다. 브라우저 부하를 막기 위해 검사를 더 기다리지 않습니다. 현재 저장된 제안서를 그대로 인쇄할 수 있습니다.','qa-warning'));
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
