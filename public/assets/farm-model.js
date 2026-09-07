(function(root){
  const groups=[
    {id:'basic',name:'농장 알아보기',hint:'기본정보 · 사육 · 인증',codes:['A','B','C','D','E']},
    {id:'product',name:'상품과 생산량',hint:'상품 · 가격 · 공급량',codes:['F','G','H']},
    {id:'shipping',name:'포장과 배송',hint:'선별 · 이력 · 배송 · 파손',codes:['I','J','K','L','M']},
    {id:'trade',name:'거래와 정산',hint:'납품 · 정기배송 · 계약',codes:['N','O','P','Q']},
    {id:'story',name:'농장 이야기',hint:'농가 인터뷰',codes:['R']},
    {id:'media',name:'사진과 자료',hint:'사진 · 영상 · 사용 범위',codes:['S','MEDIA']}
  ];
  const policy={records:[],catalog:[],farms:[],reasons:[],user:null,dirty:new Map(),loaded:false,ready:false};
  const nativeFetch=root.fetch.bind(root);
  const hiddenModes=['HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE'];
  const nonBlockingModes=['OPTIONAL','HIDE','NOT_APPLICABLE','PERMANENT_EXCLUDE'];

  function hasValue(value){return Array.isArray(value)?value.some(hasValue):value!==null&&value!==undefined&&String(value).trim()!=='';}
  function received(q,form){
    if(q.input_type==='SHOT')return (form.media||[]).some(m=>m.shot_code===q.item_key&&m.status!=='REJECTED');
    const v=form.answers?.[q.item_key];
    if(q.input_type==='file')return hasValue(v)&&(form.media||[]).some(m=>m.upload_id===v&&m.status!=='REJECTED');
    return hasValue(v)&&!(typeof v==='string'&&['미확인','확인 중','모름','미정'].includes(v.trim()));
  }
  function record(scope,farmId,itemKey,records=policy.records){return records.find(r=>r.scope===scope&&(r.farmId||'')===(farmId||'')&&r.itemKey===itemKey);}
  function policyMode(itemKey,farmId,records=policy.records){
    const global=record('GLOBAL','',itemKey,records),farm=farmId&&record('FARM',farmId,itemKey,records);
    if(global?.mode==='PERMANENT_EXCLUDE')return 'PERMANENT_EXCLUDE';
    if(farm&&farm.mode!=='INHERIT')return farm.mode;
    return global?.mode||'SHOW';
  }
  function visibleCatalog(catalog,form){const farmId=form?.farmId||'';return catalog.filter(q=>!hiddenModes.includes(policyMode(q.item_key,farmId)));}
  function collectionCatalog(catalog,form){const farmId=form?.farmId||'';return catalog.filter(q=>!nonBlockingModes.includes(policyMode(q.item_key,farmId)));}
  function effectiveCatalog(catalog,form){return visibleCatalog(catalog,form);}
  function progress(catalog,form){const active=collectionCatalog(catalog,form),done=active.filter(q=>received(q,form)).length;return {done,total:active.length,left:active.length-done,percent:active.length?Math.round(done/active.length*100):0};}
  function questions(catalog,form,{query='',filter='all',category=null}={}){
    const needle=query.trim().toLocaleLowerCase();
    return visibleCatalog(catalog,form).filter(q=>{
      const searchable=[q.item_label,q.plain_question,q.section_name,q.help_text,q.why_needed,q.item_key,form?.answers?.[q.item_key]].filter(v=>v!==null&&v!==undefined).join(' ').toLocaleLowerCase();
      return (needle?searchable.includes(needle):!category||q.section_code===category)&&(filter==='all'||(filter==='done')===received(q,form));
    });
  }
  function missing(catalog,form){return collectionCatalog(catalog,form).filter(q=>!received(q,form));}
  root.Code1Farm={groups,hasValue,received,progress,questions,missing,effectiveCatalog,visibleCatalog,collectionCatalog,policyMode};

  root.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    try{
      const url=typeof input==='string'?input:input?.url||'',body=init?.body&&JSON.parse(init.body);
      if(url.includes('/api/rpc')&&body?.action==='bootstrap'&&response.ok){
        const parsed=await response.clone().json(),data=parsed?.data||{};
        policy.records=Array.isArray(data.questionPolicies)?data.questionPolicies:[];
        policy.catalog=Array.isArray(data.catalog)?data.catalog:[];
        policy.farms=Array.isArray(data.farms)?data.farms:[];
        policy.ready=data.questionPolicyReady===true;
      }
    }catch(_){ }
    return response;
  };

  async function call(action,payload={}){
    const response=await nativeFetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    const body=await response.json();if(!response.ok||body.error)throw Error(body.message||body.error||'입력 항목 정책 요청을 완료하지 못했습니다.');return body.data;
  }
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const admin=()=>['SUPER_ADMIN','ADMIN'].includes(policy.user?.role);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const option=(value,text)=>{const n=el('option',null,text);n.value=value;return n;};
  function explicit(scope,farmId,itemKey){return record(scope,farmId,itemKey);}
  function currentScope(){const value=document.getElementById('question-policy-scope')?.value||'GLOBAL';return value==='GLOBAL'?{scope:'GLOBAL',farmId:''}:{scope:'FARM',farmId:value.slice(5)};}
  function currentDraft(q){
    const s=currentScope(),key=s.scope+'|'+s.farmId+'|'+q.item_key;if(policy.dirty.has(key))return policy.dirty.get(key);
    const old=explicit(s.scope,s.farmId,q.item_key);return {scope:s.scope,farmId:s.farmId,itemKey:q.item_key,mode:old?.mode||(s.scope==='GLOBAL'?'SHOW':'INHERIT'),reasonCode:old?.reasonCode||'',reasonNote:old?.reasonNote||'',baseVersion:old?.version||0};
  }
  function effectiveWithDraft(q,draft){
    const records=policy.records.filter(r=>!(r.scope===draft.scope&&(r.farmId||'')===draft.farmId&&r.itemKey===draft.itemKey));
    records.push({scope:draft.scope,farmId:draft.farmId,itemKey:draft.itemKey,mode:draft.mode});return policyMode(q.item_key,draft.farmId,records);
  }
  function markDirty(draft){policy.dirty.set(draft.scope+'|'+draft.farmId+'|'+draft.itemKey,{...draft});updateDirtyStatus();}
  function updateDirtyStatus(){
    const out=document.getElementById('question-policy-status'),save=document.getElementById('question-policy-save');if(!out||!save)return;
    out.textContent=policy.dirty.size?`${policy.dirty.size}개 변경사항이 저장되지 않았습니다.`:'현재 저장된 정책을 표시하고 있습니다.';save.disabled=!policy.dirty.size;
  }
  function buildUi(){
    const nav=document.getElementById('main-nav'),main=document.getElementById('app');if(!nav||!main||document.getElementById('question-policy-page'))return;
    const navButton=el('button',null,'입력 항목 관리');navButton.id='question-policy-nav';navButton.hidden=true;nav.append(navButton);
    const page=el('section','question-policy-page');page.id='question-policy-page';page.hidden=true;
    page.innerHTML=`<div class="page-heading"><div><h1>입력 항목 관리</h1><p class="muted">질문 원본은 삭제하지 않고, 전체 또는 농가별로 받을 항목과 선택 항목을 정합니다. 이미 받은 답변은 숨겨도 보존됩니다.</p></div></div>
      <div class="question-policy-shell">
        <div class="question-policy-toolbar">
          <label>적용 범위<select id="question-policy-scope"></select></label>
          <label>분류<select id="question-policy-section"></select></label>
          <label class="question-policy-search">항목 검색<input id="question-policy-search" type="search" placeholder="예: 배송비, 인증서, 포장"></label>
          <button id="question-policy-save" class="primary" disabled>변경사항 저장</button>
        </div>
        <p id="question-policy-status" role="status" class="muted"></p>
        <div class="question-policy-legend"><b>운영 원칙</b><span>선택 입력은 화면에 보이지만 진행률과 미입력 요청서에는 포함하지 않습니다.</span><span>전역 영구 제외도 카탈로그에서 삭제하지 않습니다.</span><span>농가별 설정이 전역 기본값보다 우선하지만, 전역 영구 제외는 모든 농가에 적용됩니다.</span><span>사유와 메모는 향후 관리자단·DB 이전 시 그대로 이관합니다.</span></div>
        <div id="question-policy-list"></div>
      </div>`;
    main.append(page);
    const style=el('style');style.textContent=`
      .question-policy-page{max-width:1540px;margin:auto;padding-bottom:60px}.question-policy-shell{padding:0 32px}.question-policy-toolbar{display:grid;grid-template-columns:260px 230px minmax(260px,1fr) auto;gap:12px;align-items:end;position:sticky;top:84px;z-index:12;background:#f3f6faf2;backdrop-filter:blur(10px);padding:14px 0}.question-policy-toolbar label{font-size:15px}.question-policy-toolbar button{min-height:50px}.question-policy-legend{display:flex;gap:12px;flex-wrap:wrap;padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:12px;margin:10px 0 18px;font-size:14px}.question-policy-legend span{color:var(--muted)}.question-policy-section{margin:24px 0}.question-policy-section>h2{font-size:21px;margin-bottom:8px}.question-policy-row{display:grid;grid-template-columns:76px minmax(260px,1.4fr) 245px 210px minmax(220px,1fr);gap:12px;align-items:start;padding:16px;background:#fff;border:1px solid var(--line);border-radius:12px;margin:8px 0}.question-policy-row.is-hidden{background:#f8f9fb}.question-policy-row.is-optional{border-style:dashed}.question-policy-check{display:flex!important;align-items:center;gap:8px;margin:8px 0!important;font-size:14px!important}.question-policy-copy strong{display:block;font-size:17px}.question-policy-copy p{margin:4px 0;font-size:15px}.question-policy-copy small{display:block;color:var(--muted);line-height:1.45}.question-policy-row label{font-size:13px}.question-policy-row select,.question-policy-row input{font-size:15px!important;min-height:44px!important}.question-policy-code{font-size:12px;color:#52708b}.question-policy-missing{color:#a65f00!important}@media(max-width:1050px){.question-policy-toolbar{grid-template-columns:1fr 1fr}.question-policy-search{grid-column:1/-1}.question-policy-row{grid-template-columns:70px 1fr 1fr}.question-policy-copy{grid-column:2/-1}.question-policy-row label:last-child{grid-column:2/-1}}@media(max-width:760px){.question-policy-shell{padding:0 14px}.question-policy-toolbar{top:112px;grid-template-columns:1fr}.question-policy-search{grid-column:auto}.question-policy-row{display:block}.question-policy-check{margin-bottom:10px!important}.question-policy-row label{margin-top:10px}}`;
    document.head.append(style);
    navButton.addEventListener('click',showPolicyPage);
    document.addEventListener('click',event=>{if(event.target.closest('#main-nav [data-page],#home')){page.hidden=true;navButton.classList.remove('active');}},true);
    document.getElementById('question-policy-scope').addEventListener('change',()=>{policy.dirty.clear();renderPolicies();});
    document.getElementById('question-policy-section').addEventListener('change',renderPolicies);
    document.getElementById('question-policy-search').addEventListener('input',renderPolicies);
    document.getElementById('question-policy-save').addEventListener('click',savePolicies);
  }
  async function showPolicyPage(){
    if(!admin())return;['landing','farm-page','deck-page','accounts-page'].forEach(id=>{const n=document.getElementById(id);if(n)n.hidden=true;});
    document.querySelectorAll('#main-nav [data-page]').forEach(n=>n.classList.remove('active'));document.getElementById('question-policy-nav').classList.add('active');document.getElementById('question-policy-page').hidden=false;
    if(!policy.loaded)await loadPolicies();else renderPolicies();
  }
  async function loadPolicies(){
    const out=document.getElementById('question-policy-status');out.textContent='입력 항목 정책을 불러오는 중…';
    try{
      const data=await call('questionPolicy.list');policy.records=data.policies||[];policy.reasons=data.reasons||[];policy.farms=data.farms||policy.farms;policy.catalog=data.catalog||policy.catalog;policy.loaded=true;policy.ready=true;policy.dirty.clear();buildSelectors();renderPolicies();
    }catch(error){out.textContent=/UNKNOWN_ACTION|BRIDGE_UPDATE_REQUIRED/.test(String(error.message))?'Apps Script 데이터 연결에 QuestionPolicy.gs 최신 버전을 적용해야 합니다. 기존 농가 자료와 제안서는 계속 사용할 수 있습니다.':error.message;document.getElementById('question-policy-list').replaceChildren();}
  }
  function buildSelectors(){
    const scope=document.getElementById('question-policy-scope'),section=document.getElementById('question-policy-section'),oldScope=scope.value,oldSection=section.value;
    scope.replaceChildren(option('GLOBAL','전체 기본값'));policy.farms.forEach(f=>scope.append(option('FARM:'+f.id,'농가 · '+f.name)));if([...scope.options].some(o=>o.value===oldScope))scope.value=oldScope;
    const sections=[];policy.catalog.forEach(q=>{if(!sections.some(x=>x.code===q.section_code))sections.push({code:q.section_code,name:q.section_name||q.section_code});});
    section.replaceChildren(option('','전체 분류'),...sections.map(s=>option(s.code,s.code+' · '+s.name)));section.value=oldSection&&sections.some(s=>s.code===oldSection)?oldSection:(sections[0]?.code||'');
  }
  function renderPolicies(){
    if(!policy.loaded)return;const root=document.getElementById('question-policy-list'),section=document.getElementById('question-policy-section').value,query=document.getElementById('question-policy-search').value.trim().toLocaleLowerCase(),s=currentScope();root.replaceChildren();
    const rows=policy.catalog.filter(q=>(!section||q.section_code===section)&&(!query||[q.item_key,q.item_label,q.plain_question,q.why_needed,q.help_text].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
    const bySection=new Map();rows.forEach(q=>{if(!bySection.has(q.section_code))bySection.set(q.section_code,[]);bySection.get(q.section_code).push(q);});
    if(!rows.length){root.append(el('p','muted','조건에 맞는 입력 항목이 없습니다.'));updateDirtyStatus();return;}
    bySection.forEach((items,code)=>{const wrap=el('section','question-policy-section'),heading=el('h2',null,`${code} · ${items[0].section_name||'분류명 미등록'} · ${items.length}개`);wrap.append(heading);items.forEach(q=>wrap.append(policyRow(q,s)));root.append(wrap);});updateDirtyStatus();
  }
  function policyRow(q,s){
    const draft=currentDraft(q),effective=effectiveWithDraft(q,draft),visible=!hiddenModes.includes(effective),row=el('article','question-policy-row'+(visible?'':' is-hidden')+(effective==='OPTIONAL'?' is-optional':''));
    const checkLabel=el('label','question-policy-check'),check=document.createElement('input');check.type='checkbox';check.checked=visible;checkLabel.append(check,document.createTextNode('노출'));
    const copy=el('div','question-policy-copy'),title=el('strong',null,q.item_label||q.item_key),question=el('p',null,q.plain_question||q.item_label||q.item_key),why=el('small',null,'현재 수집 이유: '+(q.why_needed||'운영 이유가 아직 등록되지 않았습니다.'));if(!q.why_needed)why.classList.add('question-policy-missing');copy.append(el('span','question-policy-code',q.item_key),title,question,why);if(q.help_text)copy.append(el('small',null,'입력 도움말: '+q.help_text));
    const modeLabel=el('label',null,'수집 상태'),mode=document.createElement('select');
    const modes=s.scope==='GLOBAL'?[['SHOW','입력받기'],['OPTIONAL','선택 입력 · 진행률 제외'],['HIDE','전역 숨김'],['PERMANENT_EXCLUDE','영구 제외 · 원본 보존']]:[['INHERIT','전체 기본값 따름'],['SHOW','이 농가에서 입력받기'],['OPTIONAL','이 농가에서 선택 입력'],['HIDE','이 농가에서 숨김'],['NOT_APPLICABLE','이 농가에는 해당 없음']];modes.forEach(([v,t])=>mode.append(option(v,t)));mode.value=draft.mode;modeLabel.append(mode);
    const reasonLabel=el('label',null,'수집 정책 이유'),reason=document.createElement('select');reason.append(option('','사유 선택'));policy.reasons.forEach(r=>reason.append(option(r.code,r.label)));reason.value=draft.reasonCode;reasonLabel.append(reason);
    const noteLabel=el('label',null,'운영 메모'),note=document.createElement('input');note.type='text';note.maxLength=500;note.value=draft.reasonNote;note.placeholder='왜 필수로 받지 않는지 판단 근거';noteLabel.append(note);
    const sync=()=>{const effectiveMode=effectiveWithDraft(q,{...draft,mode:mode.value}),needs=nonBlockingModes.includes(mode.value);reason.disabled=!needs;note.disabled=!needs;check.checked=!hiddenModes.includes(effectiveMode);row.classList.toggle('is-hidden',!check.checked);row.classList.toggle('is-optional',effectiveMode==='OPTIONAL');};
    const changed=()=>{draft.mode=mode.value;draft.reasonCode=reason.value;draft.reasonNote=note.value;if(!nonBlockingModes.includes(draft.mode)){draft.reasonCode='';draft.reasonNote='';reason.value='';note.value='';}markDirty(draft);sync();};
    mode.addEventListener('change',changed);reason.addEventListener('change',changed);note.addEventListener('input',changed);check.addEventListener('change',()=>{mode.value=check.checked?'SHOW':(s.scope==='GLOBAL'?'HIDE':'NOT_APPLICABLE');changed();});sync();row.append(checkLabel,copy,modeLabel,reasonLabel,noteLabel);return row;
  }
  async function savePolicies(){
    if(!policy.dirty.size)return;const out=document.getElementById('question-policy-status'),button=document.getElementById('question-policy-save'),changes=[...policy.dirty.values()];
    for(const c of changes){if(nonBlockingModes.includes(c.mode)&&(!c.reasonCode||!c.reasonNote.trim())){out.textContent=`${c.itemKey}: 수집 정책 이유와 운영 메모를 입력해 주세요.`;return;}}
    button.disabled=true;out.textContent=`${changes.length}개 정책 저장 중…`;
    try{const data=await call('questionPolicy.save',{requestId:uid(),changes});policy.records=data.policies||policy.records;policy.dirty.clear();out.textContent=`${changes.length}개 입력 항목 정책을 저장했습니다. 변경 이력도 함께 기록했습니다.`;renderPolicies();}
    catch(error){out.textContent=error.message;button.disabled=false;}
  }

  buildUi();
  root.addEventListener('code1-ready',event=>{policy.user=event.detail.user;setTimeout(()=>{const n=document.getElementById('question-policy-nav');if(n)n.hidden=!admin();},0);});
})(globalThis);
