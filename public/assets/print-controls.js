(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('export-dialog'),list=$('qa-list'),confirm=$('confirm-print'),cancel=$('cancel-print');
  const pdf=$('pdf'),printButton=$('print'),printDeck=$('print-deck'),thumbs=$('thumbnails');
  if(!dialog||!list||!confirm||!pdf||!printButton||!printDeck||!thumbs)return;

  const nativePrint=window.print.bind(window);
  let preparing=false;

  function row(text,cls){const li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;return li;}

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
  }

  function openExportDialog(){
    if(preparing)return;
    list.replaceChildren(
      row('현재 제안서 12장을 원본 규격 1920×1080 · 16:9로 출력합니다.','qa-ok'),
      row('한 페이지에 슬라이드 한 장이 들어갑니다. PDF 저장 후 실제 종이에 출력할 때만 프린터에서 용지에 맞춤을 사용하세요.','qa-warning')
    );
    confirm.disabled=false;
    confirm.textContent='인쇄창 열기';
    if(!dialog.open)dialog.showModal();
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
      buildPrintDeck();
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

  cancel.addEventListener('click',()=>{if(!preparing)printDeck.replaceChildren();});
  window.addEventListener('afterprint',()=>printDeck.replaceChildren());
})();
