(function(root){
  const groups=[
    {id:'basic',name:'농장 알아보기',hint:'기본정보 · 사육 · 인증',codes:['A','B','C','D','E']},
    {id:'product',name:'상품과 생산량',hint:'상품 · 가격 · 공급량',codes:['F','G','H']},
    {id:'shipping',name:'포장과 배송',hint:'선별 · 이력 · 배송 · 파손',codes:['I','J','K','L','M']},
    {id:'trade',name:'거래와 정산',hint:'납품 · 정기배송 · 계약',codes:['N','O','P','Q']},
    {id:'story',name:'농장 이야기',hint:'농가 인터뷰',codes:['R']},
    {id:'media',name:'사진과 자료',hint:'사진 · 영상 · 사용 범위',codes:['S','MEDIA']}
  ];
  function hasValue(value){return Array.isArray(value)?value.some(hasValue):value!==null&&value!==undefined&&String(value).trim()!=='';}
  function received(q,form){
    if(q.input_type==='SHOT')return (form.media||[]).some(m=>m.shot_code===q.item_key&&m.status!=='REJECTED');
    const v=form.answers?.[q.item_key];
    if(q.input_type==='file')return hasValue(v)&&(form.media||[]).some(m=>m.upload_id===v&&m.status!=='REJECTED');
    return hasValue(v)&&!(typeof v==='string'&&['미확인','확인 중','모름','미정'].includes(v.trim()));
  }
  function progress(catalog,form){const done=catalog.filter(q=>received(q,form)).length;return {done,total:catalog.length,left:catalog.length-done,percent:catalog.length?Math.round(done/catalog.length*100):0};}
  function questions(catalog,form,{query='',filter='all',category=null}={}){const needle=query.trim().toLocaleLowerCase();return catalog.filter(q=>(needle?`${q.item_label} ${q.plain_question} ${q.section_name} ${q.help_text} ${q.item_key} ${form.answers?.[q.item_key]||''}`.toLocaleLowerCase().includes(needle):!category||q.section_code===category)&&(filter==='all'||(filter==='done')===received(q,form)));}
  function missing(catalog,form){return catalog.filter(q=>!received(q,form));}
  root.Code1Farm={groups,hasValue,received,progress,questions,missing};
})(globalThis);
