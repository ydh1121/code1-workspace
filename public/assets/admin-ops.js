(() => {
  'use strict';
  const $=id=>document.getElementById(id),uid=()=>crypto.randomUUID().replace(/-/g,'');
  let initialized=false,currentTab='document',overview=null,facts=[],auditEvents=[],currentUser=null,currentAccess=null,planning=null;
  const statusNames={RECEIVED:'접수',USER_REPORTED:'사용자 보고',PARTNER_REPORTED:'파트너 보고',EVIDENCE_REQUESTED:'증빙 요청',DOCUMENT_RECEIVED:'문서 수신',VERIFIED:'검증 완료',APPROVED_CURRENT:'현재값 승인'};
  const actionLabels={
    'login.success':'로그인 성공','login.failure':'로그인 실패','account.create':'계정 생성','account.update':'계정 수정','account.password':'비밀번호 변경','account.archive':'계정 삭제','account.permissions':'페이지·기능 권한 저장',
    'farm.delete':'농가 삭제','farm.placeholder.delete':'빈 농가 정리','submission.draft.save':'농가 자료 저장','submission.submit':'농가 자료 제출','submission.review':'농가 자료 검토',
    'media.delete':'미디어 삭제','deck.save':'제안서 저장','deck.asset.register':'제안서 이미지 등록','deck.revision.import':'제안서 버전 반영','fact.transition':'Fact 상태 변경','review.decision':'검토 결정',
    'planning.document.save':'기획문서 revision 저장','planning.feedback.create':'경영진 피드백 등록','planning.feedback.resolve':'경영진 피드백 해결'
  };
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,fn,cls)=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  async function rpc(action,payload={}){const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})}),j=await r.json();if(!r.ok||j.error)throw Error(j.message||j.error||'요청을 처리하지 못했습니다.');return j.data;}
  function message(error){const s=String(error?.message||error);if(s.includes('FARM_HAS_HISTORY'))return '제출 자료·미디어·정책·검증 이력이 있는 농가는 삭제할 수 없습니다.';if(s.includes('CONFLICT'))return '다른 사용자가 먼저 새 revision을 저장했습니다. 최신 내용을 다시 불러온 뒤 수정해 주세요.';if(s.includes('FORBIDDEN'))return '이 계정에는 이 작업의 권한이 없습니다.';return s.replace(/^Error:\s*/,'');}
  const owner=()=>currentUser?.id==='OWNER'&&currentUser?.role==='SUPER_ADMIN';
  const can=cap=>owner()||!!currentAccess?.allowed?.includes(cap);
  function ensureStyle(){if(document.querySelector('link[data-code1-admin-ops]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/assets/admin-ops.css';l.dataset.code1AdminOps='1';document.head.append(l);}
  function tabMap(){const tabs={document:'기획문서',actions:'해야 할 일'};if(can('FACT_SUBMIT')||can('FACT_VERIFY')||can('FACT_APPROVE_CURRENT'))tabs.facts='Fact Inbox';if(owner()){tabs.farms='농가 관리';tabs.audit='감사';}return tabs;}
  function hideAdmin(){const p=$('admin-ops-page');if(p)p.hidden=true;$('admin-ops-nav')?.classList.remove('active');}
  function openAdmin(){for(const id of ['landing','farm-page','deck-page','accounts-page'])if($(id))$(id).hidden=true;const p=$('admin-ops-page');if(!p)return;p.hidden=false;document.querySelectorAll('#main-nav button').forEach(b=>b.classList.remove('active'));$('admin-ops-nav')?.classList.add('active');loadTab(currentTab);window.scrollTo({top:0,behavior:'smooth'});}
  function stat(label,value){const c=el('div','admin-stat');c.append(el('span',null,label),el('strong',null,String(value??0)));return c;}
  async function refreshOverview(){if(!owner())return null;overview=await rpc('admin.overview');renderSummary();return overview;}
  function renderSummary(){const root=$('admin-ops-summary');if(!root)return;if(!overview){root.replaceChildren();return;}const s=overview.snapshot;root.replaceChildren(stat('등록 농가',s.farmCount),stat('수집 자료',s.submissionCount),stat('활성 계정',s.activeAccountCount),stat('검증 Fact',`${s.verifiedFactCount}/${s.factCount}`));}

  function setup(user,access){
    if(!user)return;currentUser=user;currentAccess=access||window.__CODE1_ACCESS__||currentAccess;
    if(!owner()&&!can('PAGE_PLANNING'))return;
    if(initialized){renderTabs();return;}
    initialized=true;ensureStyle();
    const nav=button('경영·기획',openAdmin);nav.id='admin-ops-nav';$('main-nav')?.insertBefore(nav,$('accounts-nav')||null);
    const main=$('app'),page=el('section','admin-ops-page');page.id='admin-ops-page';page.hidden=true;
    const head=el('div','admin-ops-head'),hd=el('div');hd.append(el('p','eyebrow',owner()?'EXECUTIVE / OWNER':'PLANNING WORKSPACE'),el('h1',null,'경영·기획'),el('p','muted','사업 기획 Working Copy, revision 이력과 경영진 피드백을 함께 관리합니다.'));head.append(hd);
    const tabs=el('nav','admin-ops-tabs');tabs.id='admin-ops-tabs';tabs.setAttribute('aria-label','경영·기획 메뉴');
    const summary=el('div','admin-ops-summary');summary.id='admin-ops-summary';
    const body=el('div');body.id='admin-ops-body';page.append(head,tabs,summary,body);main.append(page);renderTabs();
    const destinations=document.querySelector('#landing .destinations');if(destinations&&!document.getElementById('admin-ops-destination')){const d=button('',openAdmin,'admin-destination');d.id='admin-ops-destination';d.append(el('span',null,'03'),el('h2',null,'경영·기획'),el('p',null,'사업 기획 · revision · 경영진 피드백'),el('b',null,'기획문서 열기 ↗'));destinations.append(d);}
    document.addEventListener('click',e=>{if(e.target.closest('[data-page],#home'))hideAdmin();});
    if(owner())refreshOverview().catch(()=>{});selectTab('document',false);
  }
  function renderTabs(){const tabs=$('admin-ops-tabs');if(!tabs)return;const map=tabMap();if(!map[currentTab])currentTab='document';tabs.replaceChildren(...Object.entries(map).map(([id,name])=>{const b=button(name,()=>selectTab(id));b.dataset.adminTab=id;b.classList.toggle('active',id===currentTab);return b;}));}
  function selectTab(id,open=true){if(!tabMap()[id])id='document';currentTab=id;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===id));if(open&&!$('admin-ops-page').hidden)loadTab(id);}
  function loading(){const root=$('admin-ops-body');root.replaceChildren(el('div','admin-loading','불러오는 중…'));}
  async function loadTab(id){loading();try{if(id==='document')await renderPlanning(false);else if(id==='actions')await renderPlanning(true);else if(id==='facts')await renderFacts();else if(id==='farms')await renderFarms();else if(id==='audit')await renderAudit();}catch(e){$('admin-ops-body').replaceChildren(el('div','admin-panel',message(e)));}}

  function contentLines(section){
    if(Array.isArray(section.body))return section.body.map(String).join('\n');
    if(Array.isArray(section.items))return section.items.map(item=>item&&typeof item==='object'?`${item.label||''} :: ${item.text||''}`:String(item)).join('\n');
    return '';
  }
  function renderSectionContent(root,section){
    const s=el('section','planning-section-card');s.dataset.sectionId=section.id||'';s.append(el('h3',null,section.title||''));
    for(const p of section.body||[])s.append(el('p',null,String(p)));
    const items=section.items||[];if(items.length){const ul=el('ul');for(const item of items){const li=el('li');if(item&&typeof item==='object'){const strong=el('strong',null,item.label?item.label+' · ':'');li.append(strong,document.createTextNode(item.text||''));}else li.textContent=String(item);ul.append(li);}s.append(ul);}
    root.append(s);return s;
  }
  function feedbackFor(sectionId){return (planning?.feedback||[]).filter(f=>(f.section_id||'')===(sectionId||''));}
  function feedbackBlock(sectionId){
    const wrap=el('div','planning-feedback-list');
    for(const f of feedbackFor(sectionId)){
      const card=el('article','planning-feedback'+(f.status==='RESOLVED'?' resolved':'')),head=el('div','planning-feedback-head');
      const who=f.actor?.displayName||f.actor?.username||f.actor_id||'사용자';head.append(el('strong',null,who),el('small',null,`${f.status==='RESOLVED'?'해결':'열림'} · r${f.revision} · ${new Date(f.created_at).toLocaleString('ko-KR')}`));card.append(head,el('div',null,f.body));
      if(f.status==='OPEN'&&planning.access.canEdit)card.append(button('해결 처리',async()=>{try{planning=await rpc('planning.feedback.resolve',{feedbackId:f.feedback_id,requestId:uid()});renderPlanningFromState(currentTab==='actions');}catch(error){alert(message(error));}}));wrap.append(card);
    }
    if(planning?.access.canFeedback){const form=el('form','planning-feedback-form'),ta=el('textarea');ta.placeholder=sectionId?'이 섹션에 대한 경영진 피드백을 남겨 주세요.':'문서 전체에 대한 경영진 피드백을 남겨 주세요.';ta.maxLength=8000;const out=el('output');const submit=el('button','primary','피드백 등록');submit.type='submit';form.append(ta,submit,out);form.addEventListener('submit',async e=>{e.preventDefault();const body=ta.value.trim();if(!body)return;submit.disabled=true;out.textContent='저장 중…';try{planning=await rpc('planning.feedback.add',{id:planning.document.document_id,revision:Number(planning.revision.revision),sectionId:sectionId||'',body,requestId:uid()});ta.value='';out.textContent='등록했습니다.';renderPlanningFromState(currentTab==='actions');}catch(error){out.textContent=message(error);}finally{submit.disabled=false;}});wrap.append(form);}
    return wrap;
  }
  async function renderPlanning(actionsOnly){planning=await rpc('planning.document.current',{id:'EXECUTIVE_CURRENT'});renderPlanningFromState(actionsOnly);}
  function renderPlanningFromState(actionsOnly){
    const root=$('admin-ops-body'),work=el('div','planning-workspace'),toolbar=el('div','planning-toolbar'),meta=el('div','planning-meta');
    meta.append(el('h2',null,planning.revision.title||planning.document.title),el('p',null,planning.revision.purpose||planning.document.purpose||''),el('span','planning-revision',`Working Copy r${planning.revision.revision} · ${new Date(planning.revision.created_at).toLocaleString('ko-KR')} · 원본 ${planning.document.source_brief_version||'-'}`));
    const actions=el('div','planning-actions');actions.append(button('새로고침',()=>renderPlanning(actionsOnly)));if(planning.access.canEdit)actions.append(button('기획문서 수정',openPlanningEditor,'primary'));actions.append(button('revision 이력',showPlanningHistory));toolbar.append(meta,actions);work.append(toolbar);
    if(!actionsOnly){const docFeedback=el('section','admin-panel');docFeedback.append(el('h3',null,'문서 전체 피드백'),feedbackBlock(''));work.append(docFeedback);}
    const list=el('div','planning-section-list'),sections=(planning.revision.sections||[]).filter(s=>!actionsOnly||['next','open'].includes(s.id));
    for(const section of sections){const card=renderSectionContent(list,section);card.append(feedbackBlock(section.id||''));}
    if(!sections.length)list.append(el('div','admin-empty','표시할 섹션이 없습니다.'));work.append(list);root.replaceChildren(work);
  }
  function parseEditedSection(original,title,text){
    const out=structuredClone(original);out.title=title.trim();const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
    if(Array.isArray(original.body)){out.body=lines;delete out.items;return out;}
    if(Array.isArray(original.items)){
      const objectMode=original.items.some(x=>x&&typeof x==='object');
      out.items=objectMode?lines.map(line=>{const i=line.indexOf('::');return i>=0?{label:line.slice(0,i).trim(),text:line.slice(i+2).trim()}:{label:'',text:line};}):lines;
      delete out.body;return out;
    }
    out.items=lines;return out;
  }
  function openPlanningEditor(){
    if(!planning?.access?.canEdit)return;
    let d=$('planning-editor-dialog');if(d)d.remove();d=document.createElement('dialog');d.id='planning-editor-dialog';d.className='access-dialog no-print';
    const shell=el('div','access-dialog-inner'),head=el('div','access-dialog-head');head.append(el('h2',null,`기획문서 수정 · r${planning.revision.revision} → r${Number(planning.revision.revision)+1}`),button('닫기',()=>d.close()));
    const body=el('div','access-dialog-body'),form=el('form','planning-editor');form.id='planning-editor-form';
    form.append(el('div','planning-editor-note','저장할 때 기존 revision은 덮어쓰지 않고 새 revision이 생성됩니다. 다른 사용자가 먼저 저장하면 충돌을 알리고 최신본을 다시 불러옵니다.'));
    const titleLabel=el('label',null,'문서 제목'),title=el('input');title.name='title';title.required=true;title.maxLength=240;title.value=planning.revision.title||'';titleLabel.append(title);form.append(titleLabel);
    const purposeLabel=el('label',null,'문서 목적'),purpose=el('textarea','purpose');purpose.name='purpose';purpose.maxLength=4000;purpose.value=planning.revision.purpose||'';purposeLabel.append(purpose);form.append(purposeLabel);
    (planning.revision.sections||[]).forEach((section,index)=>{const card=el('section','planning-edit-section');card.dataset.index=String(index);const l1=el('label',null,`섹션 ${index+1} 제목`),t=el('input');t.dataset.sectionTitle='1';t.value=section.title||'';t.maxLength=240;l1.append(t);const l2=el('label',null,'내용 · 한 줄에 한 항목'),ta=el('textarea');ta.dataset.sectionContent='1';ta.value=contentLines(section);l2.append(ta);card.append(l1,l2,el('small','muted',section.id?`section id: ${section.id}`:''));form.append(card);});
    const summaryLabel=el('label',null,'변경 요약'),summary=el('input');summary.name='summary';summary.maxLength=1000;summary.placeholder='예: 공급망 검증 항목과 다음 행동 수정';summaryLabel.append(summary);form.append(summaryLabel);body.append(form);
    const foot=el('div','access-dialog-actions'),out=el('span');out.id='planning-editor-result';const save=button('새 revision 저장',async()=>{save.disabled=true;out.textContent='저장 중…';try{const sections=(planning.revision.sections||[]).map((section,index)=>{const card=form.querySelector(`[data-index="${index}"]`);return parseEditedSection(section,card.querySelector('[data-section-title]').value,card.querySelector('[data-section-content]').value);});planning=await rpc('planning.document.save',{id:planning.document.document_id,baseRevision:Number(planning.revision.revision),title:title.value,purpose:purpose.value,sections,summary:summary.value,requestId:uid()});out.textContent=`r${planning.revision.revision} 저장 완료`;setTimeout(()=>{d.close();renderPlanningFromState(false);},450);}catch(error){out.textContent=message(error);}finally{save.disabled=false;}},'primary');foot.append(out,save);shell.append(head,body,foot);d.append(shell);document.body.append(d);d.showModal();
  }
  function showPlanningHistory(){
    let d=$('planning-history-dialog');if(d)d.remove();d=document.createElement('dialog');d.id='planning-history-dialog';d.className='access-dialog no-print';const shell=el('div','access-dialog-inner'),head=el('div','access-dialog-head');head.append(el('h2',null,'기획문서 revision 이력'),button('닫기',()=>d.close()));const body=el('div','access-dialog-body'),list=el('div','planning-history');for(const r of planning.revisions||[]){const row=el('div','planning-history-row');row.append(el('strong',null,'r'+r.revision),el('div',null,r.summary||r.title||''),el('time',null,new Date(r.created_at).toLocaleString('ko-KR')));list.append(row);}body.append(list);shell.append(head,body);d.append(shell);document.body.append(d);d.showModal();
  }

  function factForm(){const panel=el('section','admin-panel'),head=el('div','admin-panel-header');head.append(el('h2',null,'새 Fact 접수'));panel.append(head);const form=el('form','admin-form-grid');
    const fields=[['fact-domain','영역','예: SUPPLY / CONTRACT / PRICING'],['fact-subject-type','대상 종류','예: FARM / HUB / CONTRACT'],['fact-subject-id','대상 ID','예: GF-ORIGIN-01'],['fact-source','출처 종류','예: USER_REPORT / PARTNER_REPORT']];for(const [id,label,placeholder] of fields){const l=el('label');l.textContent=label;const input=el('input');input.id=id;input.required=true;input.placeholder=placeholder;l.append(input);form.append(l);}const l=el('label','wide');l.textContent='확인할 내용';const ta=el('textarea');ta.id='fact-statement';ta.required=true;ta.maxLength=8000;l.append(ta);form.append(l);const actions=el('div','admin-actions wide'),out=el('output'),submit=el('button','primary','Fact 접수');submit.type='submit';actions.append(out,submit);form.append(actions);form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;out.textContent='저장 중…';try{await rpc('factInbox.create',{domain:$('fact-domain').value,subjectType:$('fact-subject-type').value,subjectId:$('fact-subject-id').value,sourceType:$('fact-source').value,statement:$('fact-statement').value,requestId:uid()});form.reset();await renderFacts();}catch(err){out.textContent=message(err);}finally{submit.disabled=false;}});panel.append(form);return panel;}
  const nextFactAction={RECEIVED:['USER_REPORTED','PARTNER_REPORTED'],USER_REPORTED:['EVIDENCE_REQUESTED'],PARTNER_REPORTED:['EVIDENCE_REQUESTED'],EVIDENCE_REQUESTED:['DOCUMENT_RECEIVED'],DOCUMENT_RECEIVED:['VERIFIED'],VERIFIED:['APPROVED_CURRENT']};
  async function transitionFact(fact,status){let evidenceRef=null,note='',confidence=null;if(status==='DOCUMENT_RECEIVED'){const ref=prompt('증빙 문서 또는 파일 참조를 입력하세요.');if(!ref)return;evidenceRef={reference:ref};}if(status==='VERIFIED'){note=prompt('검증 메모를 입력하세요.')||'';const raw=prompt('검증 신뢰도 0~1','0.9');if(raw===null)return;confidence=Number(raw);}if(status==='APPROVED_CURRENT'&&!confirm('이 Fact를 현재 승인값으로 확정할까요?'))return;await rpc('factInbox.transition',{id:fact.fact_id,status,evidenceRef,note,confidence,requestId:uid()});await renderFacts();}
  function factCard(f){const row=el('article','fact-row'),top=el('div','fact-top'),txt=el('div');txt.append(el('strong',null,f.statement),el('p','fact-meta',`${f.domain} · ${f.subject_type}:${f.subject_id} · ${f.source_type}`));top.append(txt,el('span','fact-status',statusNames[f.status]||f.status));row.append(top);if(f.evidence_ref)row.append(el('p','fact-meta','증빙: '+JSON.stringify(f.evidence_ref)));if(f.verification_note)row.append(el('p',null,'검증 메모: '+f.verification_note));const next=nextFactAction[f.status]||[];if(next.length){const controls=el('div','fact-controls');next.forEach(status=>controls.append(button(statusNames[status]||status,()=>transitionFact(f,status).catch(err=>alert(message(err))))));row.append(controls);}return row;}
  async function renderFacts(){const result=await rpc('factInbox.list');facts=result.facts||[];const root=$('admin-ops-body'),list=el('section','admin-panel'),header=el('div','admin-panel-header');header.append(el('h2',null,`Fact Inbox · ${facts.length}`),button('새로고침',()=>renderFacts()));list.append(header);if(!facts.length)list.append(el('div','admin-empty','아직 접수된 Fact가 없습니다.'));else facts.forEach(f=>list.append(factCard(f)));const parts=[];if(can('FACT_SUBMIT'))parts.push(factForm());parts.push(list);root.replaceChildren(...parts);}

  async function renderFarms(){if(!owner())throw Error('FORBIDDEN');await refreshOverview();const root=$('admin-ops-body'),panel=el('section','admin-panel'),head=el('div','admin-panel-header');head.append(el('h2',null,`농가 관리 · ${overview.farms.length}`),button('새로고침',()=>renderFarms()));panel.append(head,el('p','muted','삭제는 최고 관리자만 할 수 있습니다. 제출 자료·미디어·검증 이력이 있는 농가는 삭제를 거부합니다.'));for(const farm of overview.farms){const row=el('article','admin-farm-row'),main=el('div','admin-farm-main'),text=el('div');text.append(el('strong',null,farm.name),el('p','fact-meta',`${farm.id} · 자료 ${farm.submissionCount} · 미디어 ${farm.mediaCount}`));main.append(text);const del=button('농가 삭제',async()=>{if(!confirm(`${farm.name} (${farm.id}) 농가를 삭제할까요?`))return;del.disabled=true;try{await rpc('admin.farm.delete',{id:farm.id,reason:'최고 관리자 웹 삭제',requestId:uid()});await renderFarms();}catch(err){alert(message(err));del.disabled=false;}},'danger');del.disabled=!farm.canDelete;row.append(main,del);panel.append(row);}root.replaceChildren(panel);}
  function auditRow(e){const row=el('article','audit-row');row.dataset.search=[e.action,e.actor?.displayName,e.actor?.username,e.targetType,e.targetId,e.detail].filter(Boolean).join(' ').toLowerCase();const time=el('div','audit-time',new Date(e.at).toLocaleString('ko-KR')),body=el('div'),top=el('div','audit-top');top.append(el('div','audit-action',actionLabels[e.action]||e.action),el('span','fact-status',e.actor?.displayName||e.actorId||'SYSTEM'));body.append(top,el('div','audit-target',`${e.targetType||'-'} · ${e.targetId||'-'} · ${e.source}`));if(e.detail)body.append(el('p','audit-detail',e.detail));row.append(time,body);return row;}
  function filterAudit(){const q=$('audit-search')?.value.trim().toLowerCase()||'',source=$('audit-source')?.value||'';document.querySelectorAll('#audit-list .audit-row').forEach(n=>{const event=auditEvents.find(x=>x.id===n.dataset.id);n.hidden=!!((q&&!n.dataset.search.includes(q))||(source&&event?.source!==source));});}
  async function renderAudit(){if(!owner())throw Error('FORBIDDEN');const [audit]=await Promise.all([rpc('admin.audit',{limit:400}),refreshOverview()]);auditEvents=audit.events||[];const root=$('admin-ops-body'),panel=el('section','admin-panel'),head=el('div','admin-panel-header');head.append(el('h2',null,'최고 관리자 감사'),button('새로고침',()=>renderAudit()));panel.append(head,el('p','muted','로그인, 저장·제출·검토, 계정·권한·농가 변경, 미디어·제안서·기획문서 작업의 서버 감사기록을 확인합니다.'));const filters=el('div','audit-filter'),searchLabel=el('label');searchLabel.textContent='기록 검색';const search=el('input');search.id='audit-search';search.type='search';search.placeholder='계정, 작업, 대상 ID';search.addEventListener('input',filterAudit);searchLabel.append(search);const sourceLabel=el('label');sourceLabel.textContent='기록 종류';const select=el('select');select.id='audit-source';[['','전체'],['AUDIT','서버 감사'],['MEDIA','미디어'],['REVIEW','검토']].forEach(([v,t])=>{const o=el('option',null,t);o.value=v;select.append(o);});select.addEventListener('change',filterAudit);sourceLabel.append(select);filters.append(searchLabel,sourceLabel);panel.append(filters);const list=el('div');list.id='audit-list';auditEvents.forEach(e=>{const n=auditRow(e);n.dataset.id=e.id;list.append(n);});panel.append(list);root.replaceChildren(panel);}

  window.addEventListener('code1-access-ready',e=>setup(e.detail?.user,e.detail?.access));
  window.addEventListener('code1-ready',e=>{const access=window.__CODE1_ACCESS__;setup(e.detail?.user,access);});
  setTimeout(()=>{const state=window.Code1Access?.current?.();if(state?.boot?.user)setup(state.boot.user,state.access);},900);
})();