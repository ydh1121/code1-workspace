(() => {
  'use strict';
  const form=document.getElementById('question-form');
  if(!form)return;
  const summaryText='왜 필요한가 · 입력 도움말';
  const missingText='이 항목의 수집 이유가 아직 등록되지 않았습니다. 입력 항목 관리에서 운영 필요성을 검토해 주세요.';
  function reveal(){
    form.querySelectorAll('details.why').forEach(details=>{
      if(!details.open)details.open=true;
      if(!details.classList.contains('question-context-visible'))details.classList.add('question-context-visible');
      const summary=details.querySelector('summary');
      if(summary&&summary.textContent!==summaryText)summary.textContent=summaryText;
      const paragraphs=details.querySelectorAll('p');
      if(paragraphs[0]&&!paragraphs[0].textContent.trim())paragraphs[0].textContent=missingText;
    });
  }
  const observer=new MutationObserver(()=>reveal());
  observer.observe(form,{childList:true,subtree:true});
  reveal();
})();
