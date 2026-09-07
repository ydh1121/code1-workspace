(() => {
  'use strict';
  const form=document.getElementById('question-form');
  if(!form)return;
  function reveal(){
    form.querySelectorAll('details.why').forEach(details=>{
      details.open=true;
      details.classList.add('question-context-visible');
      const summary=details.querySelector('summary');
      if(summary)summary.textContent='왜 필요한가 · 입력 도움말';
      const paragraphs=details.querySelectorAll('p');
      if(paragraphs[0]&&!paragraphs[0].textContent.trim())paragraphs[0].textContent='이 항목의 수집 이유가 아직 등록되지 않았습니다. 입력 항목 관리에서 운영 필요성을 검토해 주세요.';
    });
  }
  new MutationObserver(reveal).observe(form,{childList:true,subtree:true});
  reveal();
})();
