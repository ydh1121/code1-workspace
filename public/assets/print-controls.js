(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('export-dialog'),list=$('qa-list'),confirm=$('confirm-print'),cancel=$('cancel-print');
  const pdf=$('pdf'),printButton=$('print'),printDeck=$('print-deck'),thumbs=$('thumbnails');
  if(!dialog||!list||!confirm||!pdf||!printButton||!printDeck||!thumbs)return;

  const nativePrint=window.print.bind(window);
  const VIEW_STATE_KEY='code1.workspace.view.v1';
  const ALLOWED_PAGES=new Set(['landing','farm','deck','accounts']);
  const slideCounter=$('slide-counter');
  let preparing=false,restoringView=false,printCacheDirty=true,printCacheTimer=null;

  function row(text,cls){const li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;return li;}
  function readViewState(){
    try{const value=JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}
  }
  function writeViewState(patch){
    try{sessionStorage.setItem(VIEW_STATE_KEY,JSON.stringify({...readViewState(),...patch}));}catch{}
  }
  function currentSlideIndex(){
    const match=String(slideCounter?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
    return match?Math.max(0,Number(match[1])-1):null;
  }

  function buildPrintDeck(){
    const rendered=Array.from(thumbs.querySelectorAll('.thumb-button .slide-render'));
    if(!rendered.length)throw new Error('출력할 슬라이드를 찾지 못했습니다. 제안서를 다시 불러와 주세요.');
    const fragment=document.createDocumentFragment();
    for(const source of rendered){
      const page=document.createElement('section');
      page.className='print-page';
      const slide=source.cloneNode(true);
      slide.classList.remove('mini');
      slide.style.transform='';
      slide.style.transformOrigin='';
      slide.style.left='';
      slide.style.top='';
      slide.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));
      slide.querySelectorAll('.resize-handle').forEach(n=>n.remove());
      page.append(slide);
      fragment.append(page);
    }
    printDeck.replaceChildren(fragment);
    printCacheDirty=false;
  }

  function schedulePrintCache(){
    clearTimeout(printCacheTimer);
    printCacheTimer=setTimeout(()=>{
      if(preparing||!printCacheDirty||!thumbs.querySelector('.thumb-button .slide-render'))return;
      try{buildPrintDeck();}catch{}
    },350);
  }

  function openExportDialog(){
    if(preparing)return;
    list.replaceChildren(
      row('현재 제안서 12장을 원본 규격 1920×1080 · 16:9로 출력합니다.','qa-ok'),
      row('한 페이지에 슬라이드 한 장이 들어갑니다. PDF 저장 후 실제 종이에 출력할 때만 프린터에서 용지에 맞춤을 사용하세요.','qa-warning'),
      row('Chrome이 표시하는 날짜·URL·페이지 번호는 웹앱 내용이 아니라 브라우저 기본 머리글/바닥글입니다. 인쇄창의 더보기 설정에서 “머리글과 바닥글”을 꺼 주세요.','qa-warning')
    );
    confirm.disabled=false;
    confirm.textContent='인쇄창 열기';
    if(!dialog.open)dialog.showModal();
    schedulePrintCache();
  }

  function intercept(button){
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      openExportDialog();
    },true);
  }
  intercept(pdf);
  intercept(printButton);

  confirm.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(preparing)return;
    preparing=true;
    confirm.disabled=true;
    confirm.textContent='인쇄 준비 중…';
    try{
      if(printCacheDirty||!printDeck.querySelector('.print-page'))buildPrintDeck();
      dialog.close();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        preparing=false;
        confirm.disabled=false;
        confirm.textContent='인쇄창 열기';
        nativePrint();
      }));
    }catch(error){
      preparing=false;
      list.replaceChildren(row(String(error?.message||error),'qa-error'));
      confirm.disabled=true;
      confirm.textContent='문제 확인 필요';
    }
  },true);

  cancel.addEventListener('click',()=>{});
  window.addEventListener('afterprint',()=>{});

  document.addEventListener('click',event=>{
    const pageButton=event.target.closest?.('[data-page]');
    if(pageButton&&ALLOWED_PAGES.has(pageButton.dataset.page))writeViewState({page:pageButton.dataset.page});
    if(event.target.closest?.('#home'))writeViewState({page:'landing'});
  },true);

  if(slideCounter){
    new MutationObserver(()=>{
      if(restoringView)return;
      const slide=currentSlideIndex();
      if(slide!==null)writeViewState({page:'deck',deckSlide:slide});
    }).observe(slideCounter,{childList:true,characterData:true,subtree:true});
  }

  function restoreDeckSlide(index,attempt=0){
    const buttons=Array.from(thumbs.querySelectorAll('.thumb-button'));
    if(buttons.length){
      const safe=Math.max(0,Math.min(Number.isInteger(index)?index:0,buttons.length-1));
      buttons[safe].click();
      restoringView=false;
      writeViewState({page:'deck',deckSlide:safe});
      return;
    }
    if(attempt<80){setTimeout(()=>restoreDeckSlide(index,attempt+1),50);return;}
    restoringView=false;
  }

  window.addEventListener('code1-ready',()=>{
    const state=readViewState();
    const page=ALLOWED_PAGES.has(state.page)?state.page:null;
    if(!page)return;
    restoringView=true;
    queueMicrotask(()=>{
      if(page==='landing'){
        $('home')?.click();
        restoringView=false;
        return;
      }
      const button=document.querySelector(`[data-page="${page}"]`);
      if(!button||button.hidden){restoringView=false;return;}
      button.click();
      if(page==='deck')restoreDeckSlide(Number(state.deckSlide)||0);
      else restoringView=false;
    });
  });

  new MutationObserver(()=>{
    printCacheDirty=true;
    schedulePrintCache();
  }).observe(thumbs,{childList:true,subtree:true,attributes:true,attributeFilter:['style','src','class']});
})();
