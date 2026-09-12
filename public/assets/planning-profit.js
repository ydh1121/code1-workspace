(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,fn,cls)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const won=value=>`${Math.round(Number(value)||0).toLocaleString('ko-KR')}원`;
  const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>=0?n:0;};
  let state={models:[],access:{canEdit:false}};

  async function rpc(action,payload={}){
    const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    const j=await r.json();if(!r.ok||j.error)throw Error(j.message||j.error||'요청을 처리하지 못했습니다.');return j.data;
  }
  function errorText(error){const s=String(error?.message||error);if(s.includes('CONFLICT'))return '다른 사용자가 먼저 수정했습니다. 다시 불러온 뒤 수정해 주세요.';if(s.includes('FORBIDDEN'))return '이 계정에는 수정 권한이 없습니다.';return s.replace(/^Error:\s*/,'');}
  function calc(m){
    const cost=number(m.purchase_cost)+number(m.package_cost)+number(m.shipping_cost)+number(m.sales_fee)+number(m.other_cost);
    const remain=number(m.sale_price)-cost,ratio=number(m.sale_price)>0?remain/number(m.sale_price)*100:0,units=number(m.monthly_units);
    return {cost,remain,ratio,monthlySales:number(m.sale_price)*units,monthlyRemain:remain*units};
  }
  function metric(label,value){const n=el('div','profit-metric');n.append(el('span',null,label),el('strong',null,value));return n;}
  function modelCard(m){
    const c=calc(m),card=el('article','profit-card'),head=el('div','profit-card-head'),title=el('div');
    title.append(el('h3',null,m.product_name),el('p','muted',[m.unit_name,m.sales_channel].filter(Boolean).join(' · ')||'판매 단위·판매처 미입력'));
    const tools=el('div','profit-card-tools');
    if(state.access.canEdit){tools.append(button('수정',()=>openEditor(m)),button('보관',()=>archiveModel(m),'danger-link'));}
    head.append(title,tools);card.append(head);
    const numbers=el('div','profit-metrics');
    numbers.append(metric('판매가',won(m.sale_price)),metric('한 개 팔 때 드는 비용',won(c.cost)),metric('한 개 팔 때 남는 금액',won(c.remain)),metric('판매가 대비 남는 비율',`${c.ratio.toFixed(1)}%`),metric('월 예상 매출',won(c.monthlySales)),metric('월 예상 남는 금액',won(c.monthlyRemain)));
    card.append(numbers);
    const detail=el('div','profit-cost-detail');
    [['매입·생산비',m.purchase_cost],['포장비',m.package_cost],['배송비',m.shipping_cost],['결제·판매 수수료',m.sales_fee],['기타 비용',m.other_cost],['월 예상 판매수량',`${Number(m.monthly_units||0).toLocaleString('ko-KR')}개`]].forEach(([k,v])=>{const p=el('p');p.append(el('span',null,k),el('b',null,typeof v==='string'?v:won(v)));detail.append(p);});
    card.append(detail);
    if(m.note)card.append(el('p','profit-note',m.note));
    card.append(el('small','muted',`저장 이력 ${m.current_revision} · ${new Date(m.updated_at).toLocaleString('ko-KR')}`));
    return card;
  }

  function renderState(){
    const root=$('admin-ops-body');if(!root)return;
    const page=el('div','profit-workspace'),head=el('section','admin-panel profit-intro'),copy=el('div');
    copy.append(el('h2',null,'제품 수익 구조'),el('p','muted','농가 자료와 별개로, 제품 하나를 팔 때 얼마가 들고 얼마가 남는지 기록합니다. 값이 아직 확정되지 않았다면 현재 파악한 숫자만 입력하고 메모에 확인이 필요한 내용을 남겨 주세요.'));
    const actions=el('div','profit-head-actions');actions.append(button('새로고침',()=>render()));if(state.access.canEdit)actions.append(button('＋ 제품 추가',()=>openEditor(null),'primary'));
    head.append(copy,actions);page.append(head);
    const guide=el('section','profit-guide');guide.append(el('strong',null,'계산 기준'),el('span',null,'남는 금액 = 판매가 - 매입·생산비 - 포장비 - 배송비 - 결제·판매 수수료 - 기타 비용'));
    page.append(guide);
    const list=el('div','profit-list');
    if(!state.models.length)list.append(el('div','admin-empty','등록된 제품 수익 구조가 없습니다. 제품 추가를 눌러 첫 항목을 입력해 주세요.'));
    else state.models.forEach(m=>list.append(modelCard(m)));
    page.append(list);root.replaceChildren(page);
  }

  async function render(){
    const root=$('admin-ops-body');if(root)root.replaceChildren(el('div','admin-loading','제품 수익 구조를 불러오는 중…'));
    try{state=await rpc('planning.profit.list');renderState();}catch(error){if(root)root.replaceChildren(el('div','admin-panel',errorText(error)));}
  }

  function field(labelText,name,value='',type='text',hint=''){
    const label=el('label');label.append(document.createTextNode(labelText));const input=el('input');input.name=name;input.type=type;input.value=value??'';if(type==='number'){input.min='0';input.step='1';input.inputMode='decimal';}if(hint)input.placeholder=hint;label.append(input);return {label,input};
  }
  function openEditor(model){
    let d=$('profit-editor-dialog');if(d)d.remove();d=document.createElement('dialog');d.id='profit-editor-dialog';d.className='access-dialog no-print';
    const shell=el('div','access-dialog-inner'),head=el('div','access-dialog-head');head.append(el('h2',null,model?'제품 수익 구조 수정':'제품 수익 구조 추가'),button('닫기',()=>d.close()));
    const body=el('div','access-dialog-body'),form=el('form','profit-form');form.id='profit-editor-form';
    const textFields=[
      field('제품명','productName',model?.product_name||'','text','예: 사육환경번호 1번 계란 30구'),
      field('판매 단위','unitName',model?.unit_name||'','text','예: 30구 1판'),
      field('판매처·판매 방식','salesChannel',model?.sales_channel||'','text','예: 공식몰 / 기업 납품')
    ];
    textFields[0].input.required=true;textFields.forEach(x=>form.append(x.label));
    const grid=el('div','profit-form-grid');
    const numeric=[
      field('1개 판매가','salePrice',model?.sale_price||0,'number'),
      field('매입·생산비','purchaseCost',model?.purchase_cost||0,'number'),
      field('포장비','packageCost',model?.package_cost||0,'number'),
      field('배송비','shippingCost',model?.shipping_cost||0,'number'),
      field('결제·판매 수수료','salesFee',model?.sales_fee||0,'number'),
      field('기타 비용','otherCost',model?.other_cost||0,'number'),
      field('월 예상 판매수량','monthlyUnits',model?.monthly_units||0,'number')
    ];numeric.forEach(x=>grid.append(x.label));form.append(grid);
    const noteLabel=el('label');noteLabel.append(document.createTextNode('메모'));const note=el('textarea');note.name='note';note.maxLength=4000;note.value=model?.note||'';note.placeholder='예: 배송비 협의 중 / 실제 매입가 계약서 확인 필요';noteLabel.append(note);form.append(noteLabel);
    const preview=el('section','profit-live-preview');form.append(preview);
    const inputs=Object.fromEntries([...textFields,...numeric].map(x=>[x.input.name,x.input]));
    const refreshPreview=()=>{const m={sale_price:number(inputs.salePrice.value),purchase_cost:number(inputs.purchaseCost.value),package_cost:number(inputs.packageCost.value),shipping_cost:number(inputs.shippingCost.value),sales_fee:number(inputs.salesFee.value),other_cost:number(inputs.otherCost.value),monthly_units:number(inputs.monthlyUnits.value)},c=calc(m);preview.replaceChildren(metric('한 개 팔 때 드는 비용',won(c.cost)),metric('한 개 팔 때 남는 금액',won(c.remain)),metric('월 예상 남는 금액',won(c.monthlyRemain)));};
    numeric.forEach(x=>x.input.addEventListener('input',refreshPreview));refreshPreview();body.append(form);
    const foot=el('div','access-dialog-actions'),out=el('span'),save=button('저장',async()=>{
      if(!form.reportValidity())return;save.disabled=true;out.textContent='저장 중…';
      try{
        state=await rpc('planning.profit.save',{id:model?.model_id||'',baseRevision:model?.current_revision||0,productName:inputs.productName.value,unitName:inputs.unitName.value,salesChannel:inputs.salesChannel.value,salePrice:number(inputs.salePrice.value),purchaseCost:number(inputs.purchaseCost.value),packageCost:number(inputs.packageCost.value),shippingCost:number(inputs.shippingCost.value),salesFee:number(inputs.salesFee.value),otherCost:number(inputs.otherCost.value),monthlyUnits:Math.floor(number(inputs.monthlyUnits.value)),note:note.value,requestId:uid()});
        d.close();renderState();
      }catch(error){out.textContent=errorText(error);}finally{save.disabled=false;}
    },'primary');foot.append(out,save);shell.append(head,body,foot);d.append(shell);document.body.append(d);d.showModal();
  }
  async function archiveModel(model){
    if(!confirm(`${model.product_name} 항목을 목록에서 보관 처리할까요? 기록은 삭제되지 않습니다.`))return;
    try{state=await rpc('planning.profit.archive',{id:model.model_id,requestId:uid()});renderState();}catch(error){alert(errorText(error));}
  }

  const exactText=new Map([
    ['Fact Inbox','사실 확인'],['검증 Fact','확인된 정보'],['EXECUTIVE / OWNER','최고 관리자'],['EXECUTIVE / OWNER ONLY','최고 관리자'],['PLANNING WORKSPACE','경영·기획'],
    ['사업 기획 Working Copy, revision 이력과 경영진 피드백을 함께 관리합니다.','사업 계획 문서, 수정 이력, 의견과 제품 수익 구조를 한곳에서 관리합니다.'],
    ['CURRENT 사업계획, 검증 대기 Fact, 농가 관리와 내부 감사 기록을 한곳에서 확인합니다.','현재 사업 계획, 확인이 필요한 정보, 농가 관리와 내부 기록을 한곳에서 확인합니다.'],
    ['사업 기획 · revision · 경영진 피드백','사업 계획 · 수정 이력 · 의견 · 제품 수익 구조'],['기획문서 열기 ↗','경영·기획 열기 ↗'],
    ['revision 이력','수정 이력'],['기획문서 revision 이력','기획문서 수정 이력'],['새 revision 저장','새 버전으로 저장'],
    ['문서 전체 피드백','문서 전체 의견'],['피드백 등록','의견 등록'],['해결 처리','확인 완료'],
    ['새 Fact 접수','새 확인 항목 등록'],['Fact 접수','확인 항목 등록'],['아직 접수된 Fact가 없습니다.','아직 확인할 정보가 없습니다.'],
    ['파트너 보고','협력사 보고'],['증빙 요청','확인 자료 요청'],['문서 수신','확인 자료 받음'],['검증 완료','확인 완료'],['현재값 승인','현재 정보 확정']
  ]);
  function simplifyPlanningWords(){
    document.querySelectorAll('#admin-ops-page *,#admin-ops-destination *').forEach(node=>{
      if(node.children.length)return;const t=(node.textContent||'').trim();if(!t)return;
      if(exactText.has(t)){node.textContent=exactText.get(t);return;}
      if(/^Fact Inbox · \d+$/.test(t)){node.textContent=t.replace('Fact Inbox','사실 확인');return;}
      if(/^Working Copy r\d+/.test(t)){node.textContent=t.replace(/^Working Copy r(\d+)/,'현재 문서 버전 $1').replace(' · 원본 ',' · 기준 문서 ');return;}
      if(/^r\d+$/.test(t)&&node.closest('#planning-history-dialog')){node.textContent=t.replace(/^r(\d+)$/,'버전 $1');return;}
      if(/^(열림|해결) · r\d+ ·/.test(t)){node.textContent=t.replace('열림','확인 필요').replace('해결','확인 완료').replace(/ · r(\d+) ·/,' · 버전 $1 ·');}
      if(t.startsWith('section id:'))node.hidden=true;
    });
    const editorNote=document.querySelector('.planning-editor-note');if(editorNote&&editorNote.textContent.includes('revision'))editorNote.textContent='저장할 때 기존 문서를 덮어쓰지 않고 새 버전으로 보관합니다. 다른 사용자가 먼저 저장했다면 최신 내용을 다시 불러온 뒤 수정해 주세요.';
    const fields=[['fact-domain','영역','예: 공급 / 계약 / 가격'],['fact-subject-type','대상 종류','예: 농가 / 선별·포장 시설 / 계약'],['fact-subject-id','대상','예: 농가명 또는 계약번호'],['fact-source','정보를 받은 곳','예: 직접 전달 / 협력사 전달']];
    for(const [id,label,placeholder] of fields){const input=$(id);if(!input)continue;input.placeholder=placeholder;const parent=input.closest('label');if(parent?.firstChild?.nodeType===Node.TEXT_NODE)parent.firstChild.nodeValue=label;}
    document.querySelectorAll('.planning-feedback-form textarea').forEach(ta=>{if(ta.placeholder.includes('피드백'))ta.placeholder=ta.placeholder.replace('경영진 피드백','의견');});
  }
  function installPlanningTab(){
    const tabs=$('admin-ops-tabs');if(!tabs)return;
    if(!$('planning-profit-tab')){
      const b=button('제품 수익 구조',()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');render();});
      b.id='planning-profit-tab';b.dataset.profitTab='1';
      const before=tabs.querySelector('[data-admin-tab="facts"]');tabs.insertBefore(b,before||null);
    }
    if(!tabs.dataset.profitBound){tabs.dataset.profitBound='1';tabs.addEventListener('click',e=>{if(e.target.closest('[data-admin-tab]'))$('planning-profit-tab')?.classList.remove('active');},true);}
  }
  let scheduled=false;const sync=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;installPlanningTab();simplifyPlanningWords();});};
  const observer=new MutationObserver(sync);observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('code1-ready',sync);window.addEventListener('code1-access-ready',sync);sync();

  window.Code1ProfitUI={render};
})();
