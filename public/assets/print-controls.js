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
      row('A4 가로 용지에 현재 제안서 12장을 출력합니다.','qa-ok'),
      row('텍스트 상자 초과는 출력 차단 사유로 사용하지 않습니다. 실제 인쇄 미리보기에서 최종 확인해 주세요.','qa-warning')
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
