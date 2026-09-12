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
    card.append(el('small','muted',`수정 ${m.current_revision}회 · ${new Date(m.updated_at).toLocaleString('ko-KR')}`));
    return card;
  }

  function renderState(){
    const root=$('admin-ops-body');if(!root)return;
    const page=el('div','profit-workspace'),head=el('section','admin-panel profit-intro'),copy=el('div');
    copy.append(el('h2',null,'제품 수익 구조'),el('p','muted','농가 자료와 별개로, 제품 하나를 팔 때 얼마가 들고 얼마가 남는지 기록합니다. 값이 아직 확정되지 않았다면 현재 파악한 숫자만 입력하고 메모에 확인 필요 내용을 남겨 주세요.'));
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

  window.Code1ProfitUI={render};
})();
