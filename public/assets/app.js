(() => {
  'use strict';
  const $=id=>document.getElementById(id),clone=Code1Core.clone;
  const S={token:null,boot:null,form:null,category:null,deck:null,slide:0,selected:null,edit:false,assets:{},history:null,baseVersion:0,saveFlight:null,dirty:0,savedDirty:0,savedDeckSlides:null,discardChanges:false,questionPage:0,questionQuery:"",questionFilter:"all"};
  const statusNames={DRAFT:'임시저장',SUBMITTED:'검토 요청',NEEDS_INFO:'추가 확인 필요',APPROVED:'승인',REJECTED:'반려',REFLECTED:'정본 반영 완료'};
  let autoTimer,toastTimer,loginTimer,drag=null;
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function btn(text,fn,cls){const n=el('button',cls,text);n.type='button';n.addEventListener('click',fn);return n;}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},7000);}
  function errorText(error){const t=String(error.message||error);if(/UNAUTHENTICATED/.test(t))return '로그인 시간이 끝났습니다. 현재 창을 유지한 채 Google 계정으로 다시 로그인해 주세요.';if(/LOGIN_DENIED/.test(t))return '허용된 Google 계정으로 로그인했는지 확인해 주세요.';if(/FORBIDDEN/.test(t))return '이 계정에는 이 작업의 권한이 없습니다.';return t.replace(/^Error:\s*/,'');}
  async function rpc(action,p={}){const response=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload:p})});const data=await response.json();if(!response.ok||data.error)throw Error((data.error||'')+': '+(data.message||'저장 요청을 완료하지 못했습니다.'));return data.data;}
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const deckSnapshot=deck=>JSON.stringify(Code1Core.validateDeck(deck).slides);
  function hasUnsavedChanges(){
    if(S.discardChanges)return false;
    if(S.dirty!==S.savedDirty||S.saveFlight||deckSaving)return true;
    if(editingNode&&editingNode.innerText!==editingBefore)return true;
    try{return !!S.deck&&S.savedDeckSlides!==deckSnapshot(S.deck);}catch(_){return true;}
  }
  function fail(e){toast(errorText(e));if(/UNAUTHENTICATED/.test(String(e.message||e))){$('login').hidden=false;for(const id of ['landing','farm-page','deck-page','main-nav'])$(id).hidden=true;$('sign-in').hidden=false;$('sign-in').disabled=false;$('auth-link').hidden=true;$('login-status').textContent='로그인 시간이 끝났습니다. 같은 계정으로 다시 로그인하면 현재 작성 내용을 이어갑니다.';}}
  function loginStart(){if(hasUnsavedChanges()){toast('현재 창에 저장하지 못한 내용이 있습니다. 새 탭에서 로그인한 후 이 창의 다시 연결을 눌러 주세요.');window.open('/api/auth/login','code1-login');$('sign-in').textContent='로그인 후 다시 연결';return;}location.assign('/api/auth/login');}
  async function bootstrap(){
    const b=await rpc('bootstrap'),resume=S.boot?.user.email===b.user.email;S.boot=b;
    if(!resume){S.deck=Code1Core.validateDeck(b.deck);S.savedDeckSlides=deckSnapshot(S.deck);S.discardChanges=false;S.baseVersion=S.deck.version;S.history=new Code1Core.History(S.deck);S.form=null;S.dirty=0;S.savedDirty=0;S.edit=false;S.selected=null;$('farm-editor').hidden=true;$('farm-empty').hidden=false;}
    $('login').hidden=true;$('main-nav').hidden=false;$('identity').replaceChildren(el('span','account-email',b.user.email),el('span','tag',b.user.role==='OWNER'?'소유자':'초대 사용자'),btn('로그아웃',async()=>{if(hasUnsavedChanges()&&!confirm('저장하지 않은 변경이 있습니다. 로그아웃할까요?'))return;try{await fetch('/api/auth/logout',{method:'POST'});}finally{S.discardChanges=true;location.reload();}}));
    $('owner-settings').hidden=b.user.role!=='OWNER';if(b.settings){$('contributor').value=b.settings.contributor||'';$('contributor-deck').checked=b.settings.deckEdit;}
    for(const id of ['edit-mode','deck-save','version-save','undo','redo'])$(id).disabled=!b.canEditDeck;
    showPage('farm');renderFarmList();renderSubmissionList();
    try{S.assets={...S.assets,...await rpc('deckAssets')};renderDeck();}catch(e){toast('제안서 이미지 연결에 실패했습니다. 제안서 화면에서 다시 불러오기를 눌러 주세요.');}if(resume&&S.form)renderFarm();
  }
  function showPage(page){
    if(!S.boot)return;for(const p of ['landing','farm-page','deck-page'])$(p).hidden=p!==(page==='landing'?'landing':page+'-page');
    document.querySelectorAll('#main-nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    if(page==='deck'){renderDeck();requestAnimationFrame(scaleCanvas);}
  }
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
  $('home').addEventListener('click',()=>showPage('landing'));
  $('sign-in').addEventListener('click',async()=>{if(S.boot){try{const r=await fetch('/api/session');if((await r.json()).authenticated){await bootstrap();return;}}catch{} }loginStart();});
  $('settings-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const r=await rpc('settings',{contributor:$('contributor').value,deckEdit:$('contributor-deck').checked});$('settings-result').textContent=r.status;S.boot.settings=r;}catch(e){fail(e);}finally{button.disabled=false;}});
  function renderFarmList(){const q=$('farm-search').value.trim();$('farm-list').replaceChildren(...S.boot.farms.filter(f=>f.name.includes(q)).map(f=>btn(f.name,()=>openFarm(f))));}
  $('farm-search').addEventListener('input',renderFarmList);
  function renderSubmissionList(){
    const filter=$('submission-filter').value,query=$('farm-search').value.trim();
    $('submission-list').replaceChildren(...S.boot.submissions.filter(s=>(!filter||s.status===filter)&&(!query||s.name.includes(query))).map(s=>{const b=btn(s.name,()=>openSubmission(s.id));b.append(el('small',null,(statusNames[s.status]||s.status)+' · r'+s.revision));return b;}));
  }
  $('submission-filter').addEventListener('change',renderSubmissionList);$('farm-search').addEventListener('input',renderSubmissionList);
  async function beforeFarmSwitch(){if(S.form&&S.dirty!==S.savedDirty){await saveFarm(false);if(S.dirty!==S.savedDirty)throw Error('저장에 실패했습니다. 현재 입력을 먼저 저장해 주세요.');}}
  async function openFarm(f){const latest=f&&S.boot.submissions.find(s=>s.farmId===f.id);if(latest)return openSubmission(latest.id);try{await beforeFarmSwitch();clearTimeout(autoTimer);S.form={id:'SUB_'+uid(),farmId:f?.id||'',name:f?.name||'',status:'DRAFT',revision:0,answers:{},media:[]};if(f?.name)S.form.answers['A-01']=f.name;S.dirty=0;S.savedDirty=0;S.category='A';S.questionPage=0;S.questionQuery='';$('question-search').value='';renderFarm();}catch(e){fail(e);}}
  $('new-farm').addEventListener('click',()=>openFarm(null));
  async function openSubmission(id){try{await beforeFarmSwitch();S.form=await rpc('getSubmission',{id});S.dirty=0;S.savedDirty=0;S.category='A';S.questionPage=0;S.questionQuery='';$('question-search').value='';renderFarm();}catch(e){fail(e);}}
  function markFarmDirty(){S.dirty++;refreshProgress();$('save-status').textContent='저장하지 않은 변경';clearTimeout(autoTimer);if(S.form.name.trim())autoTimer=setTimeout(()=>saveFarm(false).catch(fail),1600);}
  function renderFarm(){
    $('farm-empty').hidden=true;$('farm-editor').hidden=false;$('farm-name').value=S.form.name;
    const locked=['APPROVED','REFLECTED'].includes(S.form.status);$('farm-name').disabled=locked;$('submit-farm').disabled=locked;$('draft-save').disabled=locked;
    $('submission-state').textContent=statusNames[S.form.status];$('save-status').textContent=S.form.revision?'저장됨 · r'+S.form.revision:'작성 중';
    renderGroupNavigation();refreshProgress();
    renderCategory();renderReview();renderMediaList();
  }
  $('farm-name').addEventListener('input',()=>{S.form.name=$('farm-name').value;S.form.answers['A-01']=S.form.name;markFarmDirty();});
  function renderCategory(){
    renderGroupNavigation();
    $('question-form').replaceChildren();$('media-panel').hidden=S.category!=='MEDIA'||!!S.questionQuery;$('question-form').hidden=S.category==='MEDIA'&&!S.questionQuery;
    const query=S.questionQuery, filtering=query||S.questionFilter!=='all';
    const list=Code1Farm.questions(S.boot.catalog,S.form,{query,filter:S.questionFilter,category:query?null:S.category});
    $('category-title').textContent=query?'검색 결과':S.boot.catalog.find(q=>q.section_code===S.category)?.section_name||'사진·영상';
    $('question-count').textContent=list.length+'개 항목';
    if(S.category==='MEDIA'&&!query){renderShotOptions();$('question-pagination').replaceChildren();return;}
    const pages=Math.max(1,Math.ceil(list.length/5));S.questionPage=Math.max(0,Math.min(S.questionPage,pages-1));
    $('question-pagination').replaceChildren();
    const prev=btn('이전 질문',()=>turnQuestion(-1)),next=btn('다음 질문',()=>turnQuestion(1));prev.disabled=S.questionPage===0;next.disabled=S.questionPage>=pages-1;
    $('question-pagination').append(prev,el('span',null,`${S.questionPage+1} / ${pages}`),next);
    if(!list.length)$('question-form').append(el('p','empty','해당하는 항목이 없습니다. 검색어나 표시 조건을 바꿔 주세요.'));
    const locked=['APPROVED','REFLECTED'].includes(S.form.status);
    list.slice(S.questionPage*5,S.questionPage*5+5).forEach(q=>{
      if(q.input_type==='SHOT'){const c=el('article','question');c.append(el('h3',null,q.item_label),el('p',null,q.help_text),btn('사진·영상 올리기',()=>{S.category='MEDIA';S.questionQuery='';$('question-search').value='';renderCategory();$('shot-select').value=q.item_key;renderShotGuide();}));$('question-form').append(c);return;}
      const wrap=el('div','question');wrap.dataset.question=q.item_key;wrap.append(el('span','answer-state',Code1Farm.received(q,S.form)?'✓ 입력했어요':'아직 필요해요'));const label=el('label',null,q.plain_question||q.item_label),inputId='q-'+q.item_key;label.htmlFor=inputId;
      let control;const options=q.options?JSON.parse(q.options):[];
      if(q.input_type==='longtext')control=el('textarea');
      else if(['select','boolean','multiselect'].includes(q.input_type)){control=el('select');if(q.input_type==='multiselect')control.multiple=true;else{const p=el('option',null,'선택해 주세요');p.value='';control.append(p);}options.forEach(o=>{const n=el('option',null,o);n.value=o;control.append(n);});}
      else if(q.input_type==='file'){
        control=el('input');control.type='file';control.accept='image/jpeg,image/png,image/webp,application/pdf';
      }else{control=el('input');control.type=['number','currency'].includes(q.input_type)?'number':q.input_type==='date'?'date':q.input_type==='url'?'url':'text';if(['number','currency'].includes(q.input_type)){control.min='0';control.step='any';control.inputMode='decimal';}control.maxLength=10000;}
      control.id=inputId;control.disabled=locked;
      if(q.input_type==='multiselect'){Array.from(control.options).forEach(o=>o.selected=(S.form.answers[q.item_key]||[]).includes(o.value));}
      else if(q.input_type!=='file')control.value=S.form.answers[q.item_key]||'';
      control.addEventListener(q.input_type==='file'?'change':'input',async()=>{
        if(q.input_type==='file'){try{if(!control.files[0])return;await saveFarm(false);const file=control.files[0],row=await uploadFile(file,{kind:'FARM',submissionId:S.form.id,shotCode:q.item_key,metadata:{rights_owner:'내부 검토용 증빙 · 권리 확인 필요',caption:q.item_label}});S.form.answers[q.item_key]=row.upload_id;S.form.media.push(row);toast('증빙 원본을 비공개 폴더에 저장했습니다.');}catch(e){fail(e);return;}}
        else S.form.answers[q.item_key]=q.input_type==='multiselect'?Array.from(control.selectedOptions,o=>o.value):control.value;
        if(q.item_key==='A-01'){S.form.name=control.value;$('farm-name').value=control.value;}
        markFarmDirty();
      });
      wrap.append(label,control);
      if(q.input_type==='multiselect'){control.hidden=true;const checks=el('div','multi-checks');checks.setAttribute('role','group');checks.setAttribute('aria-label',q.plain_question||q.item_label);for(const option of control.options){const l=el('label','check'),box=el('input');box.type='checkbox';box.checked=option.selected;box.disabled=locked;box.addEventListener('change',()=>{option.selected=box.checked;control.dispatchEvent(new Event('input'));});l.append(box,document.createTextNode(option.value));checks.append(l);}wrap.append(checks);}
      control.addEventListener('input',()=>{wrap.querySelector('.answer-state').textContent=Code1Farm.received(q,S.form)?'✓ 입력했어요':'아직 필요해요';});
      wrap.append(el('small','muted',q.required_level==='REQUIRED'?'제출 시 필수':q.evidence_required==='TRUE'?'증빙 자료 · 확인되는 자료부터 첨부해 주세요.':'확인되는 내용부터 입력해 주세요.'));
      if(q.input_type==='file'&&S.form.answers[q.item_key])wrap.append(el('p','hint','첨부 기록: '+S.form.answers[q.item_key]));
      const why=el('details','why');why.append(el('summary',null,'입력 도움말'),el('p',null,q.why_needed||''));if(q.help_text)why.append(el('p','hint',q.help_text));wrap.append(why);$('question-form').append(wrap);
    });
  }
  $('question-form').addEventListener('submit',e=>e.preventDefault());
  async function saveFarm(submit){
    if(!S.form)return;clearTimeout(autoTimer);while(S.saveFlight)await S.saveFlight;
    const form=S.form;if(['APPROVED','REFLECTED'].includes(form.status))return;
    if(!submit&&form.revision>0&&S.dirty===S.savedDirty)return;
    if(!form.name.trim())throw Error('농가 이름을 먼저 입력해 주세요.');
    const change=S.dirty,p={id:form.id,farmId:form.farmId,name:form.name,answers:clone(form.answers),baseRevision:form.revision,requestId:uid(),status:submit?'SUBMITTED':'DRAFT'};
    $('save-status').textContent='저장 중…';
    S.saveFlight=rpc('saveSubmission',p).then(r=>{
      if(S.form!==form)return;form.revision=r.revision;form.status=r.status;form.farmId=r.farmId;S.savedDirty=change;
      $('save-status').textContent=S.dirty===change?'저장됨 · r'+r.revision:'추가 변경 저장 대기';$('submission-state').textContent=statusNames[r.status];
      const item={id:form.id,name:form.name,farmId:form.farmId,status:r.status,revision:r.revision};const i=S.boot.submissions.findIndex(x=>x.id===form.id);if(i<0)S.boot.submissions.unshift(item);else S.boot.submissions[i]=item;renderSubmissionList();renderReview();refreshProgress();if(submit)toast('검토 요청으로 제출했습니다. 기존 정본은 변경되지 않았습니다.');
    }).catch(e=>{$('save-status').textContent='저장 실패 · 다시 시도해 주세요';throw e;}).finally(()=>{S.saveFlight=null;});
    await S.saveFlight;
  }
  $('draft-save').addEventListener('click',()=>saveFarm(false).catch(fail));
  $('submit-farm').addEventListener('click',()=>{clearTimeout(autoTimer);const count=Object.values(S.form?.answers||{}).filter(v=>String(v).trim()).length;if(confirm(`입력한 ${count}개 항목을 검토 요청으로 제출할까요? 제출 후에도 승인 전까지 수정·재제출할 수 있습니다.`))saveFarm(true).catch(fail);});
  function renderReview(){
    const enabled=S.boot.user.role==='OWNER'&&S.form.revision>0;$('review-panel').hidden=!enabled;$('review-note').value=S.form.note||'';
    const transitions={SUBMITTED:['NEEDS_INFO','APPROVED','REJECTED'],NEEDS_INFO:['APPROVED','REJECTED'],APPROVED:['REFLECTED']};
    $('review-buttons').replaceChildren(...(transitions[S.form.status]||[]).map(status=>btn(statusNames[status],async()=>{try{await rpc('review',{id:S.form.id,baseRevision:S.form.revision,requestId:uid(),status,note:$('review-note').value});S.form=await rpc('getSubmission',{id:S.form.id});S.dirty=0;S.savedDirty=0;const i=S.boot.submissions.findIndex(s=>s.id===S.form.id);if(i>=0)Object.assign(S.boot.submissions[i],{status:S.form.status,revision:S.form.revision});renderFarm();renderSubmissionList();toast('검토 상태를 기록했습니다. 정본은 자동 수정하지 않았습니다.');}catch(e){fail(e);}})));
  }
  function renderShotOptions(){
    const previous=$('shot-select').value;$('shot-select').replaceChildren();
    Code1Farm.questions(S.boot.catalog,S.form,{filter:S.questionFilter,category:'MEDIA'}).filter(q=>q.input_type==='SHOT').forEach(q=>{const o=el('option',null,q.item_label);o.value=q.item_key;$('shot-select').append(o);});if([...$('shot-select').options].some(o=>o.value===previous))$('shot-select').value=previous;renderShotGuide();
  }
  function renderShotGuide(){const q=S.boot.catalog.find(q=>q.item_key===$('shot-select').value);$('shot-guide').replaceChildren();if(q)$('shot-guide').append(el('b',null,q.item_label),document.createTextNode(q.help_text+'\n\n왜 필요한가: '+q.why_needed));}
  $('shot-select').addEventListener('change',renderShotGuide);
  function readFile(file){return new Promise((resolve,reject)=>{if(!file||file.size>8*1024*1024){reject(Error('직접 업로드는 8MB 이하입니다. 큰 영상은 소유자가 비공개 Drive 원본 연결을 이용해 주세요.'));return;}const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));r.readAsDataURL(file);});}
  async function uploadFile(file,params){const base64=await readFile(file);return rpc('upload',{...params,fileName:file.name,mimeType:file.type,base64,requestId:uid()});}
  $('media-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{
    await saveFarm(false);$('media-status').textContent='비공개 원본 업로드 중…';
    const metadata=mediaMetadata();
    const row=await uploadFile($('media-file').files[0],{kind:'FARM',submissionId:S.form.id,shotCode:$('shot-select').value,metadata});S.form.media.push(row);$('media-status').textContent='원본과 미디어 기록 저장됨 · 사용권 검토 대기';$('media-file').value='';renderMediaList();
  }catch(e){$('media-status').textContent=errorText(e);fail(e);}finally{button.disabled=false;}});
  function mediaMetadata(){const m={caption:$('media-caption').value,photographer:$('media-photographer').value,taken_at:$('media-date').value,rights_owner:$('media-rights').value,face_present:$('media-face').value,face_consent:$('media-consent').value,b2b_use:$('media-usage').value,privacy_checked:$('media-privacy').value};document.querySelectorAll('[data-media-meta]').forEach(n=>m[n.dataset.mediaMeta]=n.value);return m;}
  function driveId(value){const m=value?.trim().match(/^(?:https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=))?([A-Za-z0-9_-]{10,})(?:\/view(?:\?.*)?)?$/);if(!m)throw Error('Drive 파일 링크 또는 파일 ID를 확인해 주세요.');return m[1];}
  $('link-drive').addEventListener('click',async()=>{try{if(S.boot.user.role!=='OWNER')throw Error('큰 원본은 소유자가 비공개 Drive 폴더에서 연결할 수 있습니다.');const value=prompt('지정된 비공개 업로드 폴더 바로 아래에 있는 파일의 Drive 링크 또는 ID');if(!value)return;await saveFarm(false);const row=await rpc('linkDrive',{fileId:driveId(value),requestId:uid(),kind:'FARM',submissionId:S.form.id,shotCode:$('shot-select').value,metadata:mediaMetadata()});S.form.media.push(row);renderMediaList();toast('비공개 Drive 원본을 제출 자료에 연결했습니다.');}catch(e){fail(e);}});
  function renderMediaList(){refreshProgress();
    $('media-list').replaceChildren(...(S.form.media||[]).map(m=>{const card=el('article','media-card');card.append(el('strong',null,m.shot_label),el('p',null,m.file_name),el('small',null,m.status==='APPROVED'?'사용권 검토 승인':m.status==='REJECTED'?'사용 보류':'사용권 검토 대기'));
      if(S.boot.user.role==='OWNER'&&m.drive_url&&/^https:\/\/drive\.google\.com\//.test(m.drive_url)){const a=el('a','button','Drive 원본 열기');a.href=m.drive_url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
      if(S.boot.user.role==='OWNER')for(const [caption,status] of [['사용권 승인','APPROVED'],['사용 보류','REJECTED']])card.append(btn(caption,async()=>{const note=prompt('확인한 사용권·인물 동의·공개 범위의 근거');if(!note)return;try{const row=await rpc('reviewMedia',{id:m.upload_id,status,note,requestId:uid()});Object.assign(m,row);renderMediaList();}catch(e){fail(e);}}));
      if(/^image\//.test(m.mime_type)){const im=el('img');im.alt=m.caption||m.shot_label;card.prepend(im);rpc('media',{id:m.upload_id}).then(a=>im.src=a.url).catch(()=>im.remove());}
      return card;}));
  }
  function currentSlide(){return S.deck.slides[S.slide];}
  function selected(){return currentSlide()?.elements.find(e=>e.element_id===S.selected);}
  function applyElementStyle(node,e){
    const s=e.style||{};Object.assign(node.style,{left:e.x+'px',top:e.y+'px',width:e.width+'px',height:e.height+'px',zIndex:String(e.z),opacity:s.opacity??1,transform:`rotate(${s.rotation||0}deg)`,fontFamily:'"'+(s.fontFamily||'Pretendard Variable')+'",Pretendard,sans-serif',fontSize:(s.fontSize||32)+'px',fontWeight:s.fontWeight||400,lineHeight:s.lineHeight||1.3,letterSpacing:(s.letterSpacing||0)+'px',color:s.color||'#111111',textAlign:s.textAlign||'left',fontStyle:s.fontStyle||'normal',textDecoration:s.textDecoration||'none',borderRadius:(s.borderRadius||0)+'px',backgroundColor:s.backgroundColor||'transparent'});
  }
  function slideDOM(slide,{interactive=false}={}){
    const dom=el('div','slide-render'),b=slide.background;dom.style.background=b.color;
    if(b.mediaRef){const wrap=el('div','slide-bg'),im=el('img');im.alt='슬라이드 배경';im.src=S.assets[b.mediaRef]?.url||'';Object.assign(im.style,{objectFit:b.fit,objectPosition:b.position,opacity:b.opacity,transform:`scale(${b.zoom||1})`});wrap.append(im);const overlay=el('div','slide-overlay');Object.assign(overlay.style,{background:b.overlayColor,opacity:b.overlayOpacity});wrap.append(overlay);dom.append(wrap);}
    for(const e of [...slide.elements].sort((a,b)=>a.z-b.z)){
      const n=el('div','deck-element');n.dataset.elementId=e.element_id;applyElementStyle(n,e);
      if(e.type==='text')n.textContent=e.content;
      if(e.type==='image'){const im=el('img');im.alt=S.assets[e.mediaRef]?.note||'제안서 이미지';const asset=S.assets[e.mediaRef];if(asset?.url)im.src=asset.url;else n.dataset.missingImage='true';Object.assign(im.style,{objectFit:e.style.objectFit==='original'?'contain':e.style.objectFit||'cover',objectPosition:e.style.objectPosition||'center',borderRadius:(e.style.borderRadius||0)+'px'});n.append(im);}
      if(interactive&&S.edit){n.classList.toggle('editable',!e.locked);n.classList.toggle('selected',e.element_id===S.selected);if(e.element_id===S.selected&&!e.locked)n.append(el('span','resize-handle'));}
      dom.append(n);
    }
    return dom;
  }
  function scaleCanvas(){if($('deck-page').hidden)return;const w=$('canvas-viewport').clientWidth;$('slide-canvas').style.transform=`scale(${w/1920})`;}
  new ResizeObserver(scaleCanvas).observe($('canvas-viewport'));
  function renderDeck(){
    if(!S.deck)return;S.slide=Math.max(0,Math.min(S.slide,S.deck.slides.length-1));
    S.deck.slides.forEach((s,i)=>s.elements.filter(e=>e.source_layer_id==='C-PG-01').forEach(e=>e.content=String(i+1).padStart(2,'0')+' / '+S.deck.slides.length));
    const d=slideDOM(currentSlide(),{interactive:true});$('slide-canvas').replaceChildren(...d.childNodes);$('slide-canvas').style.background=currentSlide().background.color;
    $('slide-counter').textContent=String(S.slide+1).padStart(2,'0')+' / '+S.deck.slides.length;
    $('view-mode').setAttribute('aria-pressed',String(!S.edit));$('edit-mode').setAttribute('aria-pressed',String(S.edit));$('element-tools').hidden=!S.edit;$('editor-hint').textContent=S.edit?'더블클릭: 글 수정 · 드래그: 이동 · 모서리: 크기 · Ctrl/Cmd+S: 저장':'보기 모드 · 방향키로 슬라이드 이동 · 미리보기 종료: Esc';
    renderThumbnails();renderProperties();renderLayers();scaleCanvas();
    $('undo').disabled=!S.edit||!S.history.past.length;$('redo').disabled=!S.edit||!S.history.future.length;
  }
  function renderThumbnails(){
    $('thumbnails').replaceChildren(...S.deck.slides.map((s,i)=>{const b=btn('',()=>{commitText();S.slide=i;S.selected=null;renderDeck();},'thumb-button'+(i===S.slide?' selected':''));b.setAttribute('aria-label',`슬라이드 ${i+1}`);const mini=slideDOM(s);mini.classList.add('mini');b.append(mini,el('small',null,String(i+1).padStart(2,'0')));return b;}));
  }
  function renderLayers(){
    $('layer-list').replaceChildren(...[...currentSlide().elements].sort((a,b)=>b.z-a.z).map(e=>btn((e.locked?'🔒 ':'')+(e.type==='text'?e.content.slice(0,20):e.type==='image'?'이미지':'도형'),()=>select(e.element_id),e.element_id===S.selected?'active':'')));
  }
  function select(id){S.selected=id;document.querySelectorAll('#slide-canvas .deck-element').forEach(n=>{n.classList.toggle('selected',S.edit&&n.dataset.elementId===id);n.querySelector('.resize-handle')?.remove();if(S.edit&&n.dataset.elementId===id&&!selected().locked)n.append(el('span','resize-handle'));});renderProperties();renderLayers();}
  function record(){S.history.record(S.deck);$('deck-saved').textContent='저장하지 않은 변경';$('undo').disabled=!S.history.past.length;$('redo').disabled=!S.history.future.length;}
  function mutation(fn){if(!S.edit)return;commitText();fn();try{Code1Core.validateDeck(S.deck);}catch(e){S.deck=clone(S.history.present);fail(e);}record();renderDeck();}
  $('view-mode').addEventListener('click',()=>{commitText();S.edit=false;S.selected=null;renderDeck();});
  $('edit-mode').addEventListener('click',()=>{if(!S.boot.canEditDeck)return;S.edit=true;renderDeck();});
  function slideMove(n){commitText();S.slide=Math.max(0,Math.min(S.deck.slides.length-1,S.slide+n));S.selected=null;renderDeck();}
  $('prev-slide').addEventListener('click',()=>slideMove(-1));$('next-slide').addEventListener('click',()=>slideMove(1));
  $('undo').addEventListener('click',()=>{if(!S.edit)return;S.deck=S.history.undo();S.selected=null;$('deck-saved').textContent='저장하지 않은 변경';renderDeck();});
  $('redo').addEventListener('click',()=>{if(!S.edit)return;S.deck=S.history.redo();S.selected=null;$('deck-saved').textContent='저장하지 않은 변경';renderDeck();});
  let editingNode=null,editingBefore='';
  function commitText(){if(editingNode)editingNode.blur();}
  $('slide-canvas').addEventListener('dblclick',e=>{
    const n=e.target.closest('.deck-element'),item=n&&currentSlide().elements.find(x=>x.element_id===n.dataset.elementId);if(!S.edit||!item||item.locked||item.type!=='text')return;
    select(item.element_id);n.querySelector('.resize-handle')?.remove();n.contentEditable='true';n.setAttribute('role','textbox');n.setAttribute('aria-label','슬라이드 텍스트 편집');editingNode=n;editingBefore=item.content;n.focus();
    n.onpaste=ev=>{ev.preventDefault();const text=ev.clipboardData.getData('text/plain'),selection=getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const t=document.createTextNode(text);range.insertNode(t);range.setStartAfter(t);range.collapse(true);selection.removeAllRanges();selection.addRange(range);};
    n.addEventListener('blur',()=>{item.content=n.innerText.slice(0,10000);n.contentEditable='false';n.removeAttribute('role');n.removeAttribute('aria-label');editingNode=null;if(item.content!==editingBefore)record();renderThumbnails();renderLayers();select(item.element_id);},{once:true});
    n.onkeydown=ev=>{if(ev.isComposing)return;if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();n.blur();saveDeck(false);return;}if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();n.blur();}if(ev.key==='Escape'){ev.preventDefault();n.textContent=editingBefore;n.blur();}};
  });
  $('slide-canvas').addEventListener('pointerdown',ev=>{
    if(!S.edit||ev.button!==0||ev.target.closest('[contenteditable=true]'))return;const n=ev.target.closest('.deck-element');if(!n){select(null);return;}
    const item=currentSlide().elements.find(e=>e.element_id===n.dataset.elementId),resize=ev.target.classList.contains('resize-handle');select(item.element_id);if(item.locked)return;
    drag={id:item.element_id,node:n,initial:clone(item),px:ev.clientX,py:ev.clientY,scale:$('canvas-viewport').clientWidth/1920,resize,moved:false,pointer:ev.pointerId};n.setPointerCapture(ev.pointerId);ev.preventDefault();
  });
  $('slide-canvas').addEventListener('pointermove',ev=>{if(!drag||ev.pointerId!==drag.pointer)return;const dx=(ev.clientX-drag.px)/drag.scale,dy=(ev.clientY-drag.py)/drag.scale;if(Math.abs(dx)+Math.abs(dy)<3)return;drag.moved=true;const item=currentSlide().elements.find(e=>e.element_id===drag.id);Object.assign(item,clone(drag.initial));if(drag.resize)Code1Core.resize(item,dx,dy,ev.shiftKey||$('aspect-lock')?.checked);else Code1Core.move(item,dx,dy);applyElementStyle(drag.node,item);});
  function endDrag(ev){if(!drag||ev.pointerId!==drag.pointer)return;if(drag.moved){record();renderThumbnails();renderProperties();}if(drag.node.hasPointerCapture(ev.pointerId))drag.node.releasePointerCapture(ev.pointerId);drag=null;}
  $('slide-canvas').addEventListener('pointerup',endDrag);$('slide-canvas').addEventListener('pointercancel',ev=>{if(!drag)return;const item=currentSlide().elements.find(e=>e.element_id===drag.id);Object.assign(item,drag.initial);drag=null;renderDeck();});
  function field(label,value,type,change,options){
    const l=el('label',null,label),n=el(options?'select':'input');n.setAttribute('aria-label',label);
    if(options)options.forEach(o=>{const v=typeof o==='string'?o:o.value,caption=typeof o==='string'?o:o.label;const option=el('option',null,caption);option.value=v;n.append(option);});else n.type=type||'text';n.value=value??'';n.addEventListener('change',()=>change(n.type==='number'?Number(n.value):n.value));l.append(n);return l;
  }
  function pair(...fields){const p=el('div','prop-pair');p.append(...fields);return p;}
  function renderProperties(){
    const root=$('property-fields');root.replaceChildren();const item=selected();
    if(!S.edit||!item){root.append(el('p','muted',S.edit?'바꾸고 싶은 글이나 사진을 눌러 주세요.':'편집 버튼을 누르면 글과 사진을 수정할 수 있습니다.'));return;}
    root.append(el('p','selected-kind',item.type==='text'?'글 편집':item.type==='image'?'사진 편집':'도형 편집'),btn(item.locked?'잠금 해제':'요소 잠금',()=>mutation(()=>item.locked=!item.locked)));
    if(item.locked){root.append(el('p','muted','잠금을 풀어야 이동하거나 수정할 수 있습니다.'));return;}
    const set=(k,v)=>mutation(()=>item[k]=v),style=(k,v)=>mutation(()=>item.style[k]=v);
    if(item.type==='text'){const label=el('label',null,'글 내용'),text=el('textarea');text.value=item.content;text.rows=4;text.addEventListener('change',()=>mutation(()=>item.content=text.value.slice(0,10000)));label.append(text);root.append(label);}

    root.append(pair(field('X',item.x,'number',v=>set('x',v)),field('Y',item.y,'number',v=>set('y',v))),pair(field('너비',item.width,'number',v=>set('width',v)),field('높이',item.height,'number',v=>set('height',v))));
    if(item.type==='text')root.append(field('폰트',item.style.fontFamily||'Pretendard Variable',null,v=>style('fontFamily',v),['Pretendard Variable','Pretendard']),pair(field('글자 크기',item.style.fontSize||32,'number',v=>style('fontSize',v)),field('굵기',item.style.fontWeight||400,'number',v=>style('fontWeight',v))),pair(field('줄 높이',item.style.lineHeight||1.3,'number',v=>style('lineHeight',v)),field('자간',item.style.letterSpacing||0,'number',v=>style('letterSpacing',v))),field('텍스트 색상',item.style.color||'#111111','color',v=>style('color',v)),field('정렬',item.style.textAlign||'left',null,v=>style('textAlign',v),[{value:'left',label:'왼쪽'},{value:'center',label:'가운데'},{value:'right',label:'오른쪽'}]),field('기울임',item.style.fontStyle||'normal',null,v=>style('fontStyle',v),['normal','italic']),field('밑줄',item.style.textDecoration||'none',null,v=>style('textDecoration',v),['none','underline']));
    if(item.type==='image'){
      const aspect=el('label','check'),box=el('input');box.type='checkbox';box.id='aspect-lock';box.checked=true;aspect.append(box,document.createTextNode('비율 유지'));root.append(aspect,field('이미지 맞춤',item.style.objectFit||'cover',null,v=>style('objectFit',v),[{value:'cover',label:'Cover · 채우기'},{value:'contain',label:'Contain · 전체 보기'},{value:'original',label:'Original ratio · 비율 유지'}]),field('크롭 위치',item.style.objectPosition||'center',null,v=>style('objectPosition',v),['center','top','bottom','left','right']),field('모서리 반경',item.style.borderRadius||0,'number',v=>style('borderRadius',v)),btn('이미지 교체',()=>chooseDeckImage('replace')));
    }
    if(item.type==='shape')root.append(field('채우기',item.style.backgroundColor||'#111111','color',v=>style('backgroundColor',v)));
    root.append(pair(field('불투명도',item.style.opacity??1,'number',v=>style('opacity',v)),field('회전',item.style.rotation||0,'number',v=>style('rotation',v))));
    const controls=el('div');for(const [label,dir] of [['앞으로',1],['뒤로',-1],['맨 앞으로',100],['맨 뒤로',-100]])controls.append(btn(label,()=>mutation(()=>{const list=[...currentSlide().elements].sort((a,b)=>a.z-b.z);const from=list.findIndex(x=>x.element_id===item.element_id),to=Math.max(0,Math.min(list.length-1,from+dir));list.splice(from,1);list.splice(to,0,item);list.forEach((e,i)=>e.z=i);})));root.append(controls);
  }
  $('add-text').addEventListener('click',()=>mutation(()=>{const item={element_id:'E_'+uid(),type:'text',x:150,y:280,width:780,height:130,z:Math.max(0,...currentSlide().elements.map(e=>e.z))+1,locked:false,style:{fontFamily:'Pretendard Variable',fontSize:50,fontWeight:700,lineHeight:1.3,color:'#111111'},content:'더블클릭해서 내용을 입력해 주세요.'};currentSlide().elements.push(item);S.selected=item.element_id;}));
  $('delete-element').addEventListener('click',()=>{const item=selected();if(!item||item.locked)return;mutation(()=>{currentSlide().elements=currentSlide().elements.filter(x=>x!==item);S.selected=null;});toast('요소를 삭제했습니다. 실행 취소로 복원할 수 있습니다.');});
  let imageIntent='add',imageTarget=null;
  const INTERNAL_DECK_RIGHTS_NOTE='CODE1 내부 작업본 · 원본 권리자 및 외부 사용권 확인 전';
  async function attachDeckAsset(m,intent,target){S.assets[m.upload_id]=await rpc('media',{id:m.upload_id});if(target){const i=S.deck.slides.findIndex(s=>s.slide_id===target.slide);if(i<0)throw Error('이미지를 넣을 슬라이드가 삭제되었습니다.');S.slide=i;S.selected=target.element;}mutation(()=>{if(intent==='background')currentSlide().background.mediaRef=m.upload_id;else if(intent==='replace'&&selected())selected().mediaRef=m.upload_id;else{const item={element_id:'E_'+uid(),type:'image',x:240,y:250,width:720,height:480,z:Math.max(0,...currentSlide().elements.map(e=>e.z))+1,locked:false,style:{objectFit:'contain',objectPosition:'center',opacity:1},mediaRef:m.upload_id};currentSlide().elements.push(item);S.selected=item.element_id;}});}
  $('deck-drive-image').addEventListener('click',async()=>{if(!S.edit||S.boot.user.role!=='OWNER'){toast('Drive 기존 파일 연결은 소유자가 이용할 수 있습니다.');return;}const value=prompt('비공개 업로드 폴더에 있는 이미지의 Drive 링크 또는 ID');if(!value)return;try{const m=await rpc('linkDrive',{fileId:driveId(value),kind:'DECK',requestId:uid(),metadata:{rights_owner:INTERNAL_DECK_RIGHTS_NOTE,b2b_use:'미확인'}});await attachDeckAsset(m,'add');}catch(e){fail(e);}});
  $('duplicate-slide').addEventListener('click',()=>mutation(()=>{const copy=clone(currentSlide());copy.slide_id='S_'+uid();copy.elements.forEach(e=>e.element_id='E_'+uid());S.deck.slides.splice(S.slide+1,0,copy);S.slide++;S.selected=null;}));
  $('delete-slide').addEventListener('click',()=>{if(!S.edit||S.deck.slides.length===1)return;if(confirm('현재 슬라이드를 삭제할까요? 실행 취소로 복원할 수 있습니다.'))mutation(()=>{S.deck.slides.splice(S.slide,1);S.slide=Math.min(S.slide,S.deck.slides.length-1);S.selected=null;});});
  function chooseDeckImage(intent){if(!S.edit)return;imageIntent=intent;imageTarget={slide:currentSlide().slide_id,element:S.selected};$('deck-image-file').click();}
  $('add-image').addEventListener('click',()=>chooseDeckImage('add'));
  $('deck-image-file').addEventListener('change',async()=>{
    const f=$('deck-image-file').files[0];if(!f)return;const target=imageTarget,intent=imageIntent;
    try{toast('이미지 원본을 저장하고 있습니다.');const m=await uploadFile(f,{kind:'DECK',metadata:{rights_owner:INTERNAL_DECK_RIGHTS_NOTE,b2b_use:'미확인',caption:'아자몰 작업본 이미지'}});await attachDeckAsset(m,intent,target);toast('이미지를 넣었습니다. 저장을 누르면 다음에도 이어서 볼 수 있습니다.');}catch(e){fail(e);}finally{$('deck-image-file').value='';}
  });
  $('background-edit').addEventListener('click',()=>{
    if(!S.edit)return;select(null);const b=currentSlide().background,root=$('property-fields');root.replaceChildren(el('h3',null,'슬라이드 배경'));
    const change=(k,v)=>{mutation(()=>b[k]=v);$('background-edit').click();};
    root.append(field('배경색',b.color,'color',v=>change('color',v)),btn('배경 이미지 교체',()=>chooseDeckImage('background')),btn('단색 배경으로',()=>change('mediaRef',undefined)),field('배경 이미지 맞춤',b.fit,null,v=>change('fit',v),['cover','contain']),field('배경 이미지 위치',b.position,null,v=>change('position',v),['center','top','bottom','left','right']),field('배경 확대',b.zoom,'number',v=>change('zoom',v)),field('배경 불투명도',b.opacity,'number',v=>change('opacity',v)),field('오버레이 색상',b.overlayColor,'color',v=>change('overlayColor',v)),field('오버레이 불투명도',b.overlayOpacity,'number',v=>change('overlayOpacity',v)));
  });
  let deckSaving=false;
  async function saveDeck(newVersion=false){
    if(deckSaving||!S.boot.canEditDeck)return;commitText();const summary=newVersion?'새 디자인 작업본 저장':'현재 작업본 수정';
    deckSaving=true;$('deck-saved').textContent='저장 중…';try{const d=Code1Core.validateDeck(S.deck),savedModel=deckSnapshot(d),r=await rpc('saveDeck',{deck:d,baseVersion:S.baseVersion,newVersion,summary,requestId:uid()});S.baseVersion=r.version;S.deck.version=r.version;S.deck.version_label=r.versionLabel||S.deck.version_label;S.savedDeckSlides=savedModel;$('deck-saved').textContent=(savedModel===deckSnapshot(S.deck)?'저장됨 · r':'저장하지 않은 추가 변경 · 저장된 r')+r.version;toast('작업본을 저장했습니다. 기존 CURRENT는 그대로입니다.');}catch(e){$('deck-saved').textContent='저장 실패 · 변경 내용은 현재 창에 남아 있습니다.';fail(e);}finally{deckSaving=false;}
  }
  $('deck-save').addEventListener('click',()=>saveDeck(false));$('version-save').addEventListener('click',()=>saveDeck(true));
  $('preview').addEventListener('click',()=>{commitText();S.edit=false;S.selected=null;document.body.classList.add('preview-mode');renderDeck();});
  const exitPreview=btn('미리보기 닫기',()=>{document.body.classList.remove('preview-mode');renderDeck();});document.querySelector('.slide-nav').append(exitPreview);
  $('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(fail);else $('deck-page').requestFullscreen?.().catch(fail);});
  window.addEventListener('keydown',ev=>{
    if(!S.boot||$('deck-page').hidden)return;const typing=ev.target.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);if(typing||ev.isComposing)return;
    if(ev.key==='Escape'){document.body.classList.remove('preview-mode');S.selected=null;renderDeck();return;}
    if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='s'){ev.preventDefault();saveDeck(false);return;}
    if(S.edit&&(ev.ctrlKey||ev.metaKey)&&['z','y'].includes(ev.key.toLowerCase())){ev.preventDefault();(ev.key.toLowerCase()==='y'||ev.shiftKey?$('redo'):$('undo')).click();return;}
    if(S.edit&&selected()&&['Delete','Backspace'].includes(ev.key)){ev.preventDefault();$('delete-element').click();return;}
    if(ev.key.startsWith('Arrow')){ev.preventDefault();if(S.edit&&selected()){const step=ev.shiftKey?10:1;mutation(()=>Code1Core.move(selected(),ev.key==='ArrowRight'?step:ev.key==='ArrowLeft'?-step:0,ev.key==='ArrowDown'?step:ev.key==='ArrowUp'?-step:0));}else if(['ArrowRight','ArrowDown'].includes(ev.key))slideMove(1);else slideMove(-1);}
  });
  let exportBlocking=false;
  async function preparePrint(){
    commitText();const errors=[],warnings=Code1Core.copyWarnings(S.deck);$('print-deck').replaceChildren(...S.deck.slides.map(s=>{const p=el('section','print-page');p.append(slideDOM(s));return p;}));
    // Temporarily lay out the SAME DOM tree for font/image/overflow checks.
    const print=$('print-deck');Object.assign(print.style,{display:'block',position:'absolute',left:'-2200px',top:'0',visibility:'hidden'});
    try{
      const words=S.deck.slides.flatMap(s=>s.elements.filter(e=>e.type==='text').map(e=>e.content)).join('');
      const loaded=await document.fonts.load('400 32px "Pretendard Variable"',words);await document.fonts.ready;if(!loaded.length)errors.push('Pretendard Variable을 불러오지 못했습니다. 폰트가 준비되기 전에는 출력할 수 없습니다.');
      await Promise.all(Array.from(print.querySelectorAll('img')).map(im=>im.decode().catch(()=>errors.push('이미지가 로딩되지 않았습니다. 원본 접근 상태를 확인해 주세요.'))));
      print.querySelectorAll('[data-missing-image]').forEach(()=>errors.push('누락된 이미지가 있습니다.'));
      print.querySelectorAll('.deck-element').forEach(n=>{if(n.textContent.trim()&&(n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2))errors.push(n.dataset.elementId+': 글자가 텍스트 상자를 넘습니다.');});
    }catch(e){errors.push(errorText(e));}
    print.style.cssText='';

    $('qa-list').replaceChildren(...errors.map(t=>el('li','qa-error',t)));exportBlocking=errors.length>0;if(exportBlocking){$('confirm-print').disabled=true;$('export-dialog').showModal();return;}window.print();
  }
  $('pdf').addEventListener('click',()=>preparePrint().catch(fail));$('print').addEventListener('click',()=>preparePrint().catch(fail));$('qa-confirm').addEventListener('change',()=>{$('confirm-print').disabled=exportBlocking||!$('qa-confirm').checked;});$('cancel-print').addEventListener('click',()=>$('export-dialog').close());
  $('confirm-print').addEventListener('click',()=>{if(exportBlocking||!$('qa-confirm').checked)return;$('export-dialog').close();window.print();});
  window.addEventListener('beforeunload',e=>{if(hasUnsavedChanges()){e.preventDefault();e.returnValue='';}});
  const F=Code1Farm;
  function sectionQuestions(code){return S.boot.catalog.filter(q=>q.section_code===code);}
  function renderGroupNavigation(){
    const active=F.groups.find(g=>g.codes.includes(S.category))||F.groups[0];
    $('categories').replaceChildren(...F.groups.map((g,i)=>{const items=S.boot.catalog.filter(q=>g.codes.includes(q.section_code)),p=F.progress(items,S.form);const b=btn('',()=>{S.category=g.codes[0];S.questionPage=0;S.questionQuery='';$('question-search').value='';renderCategory();},'group-card'+(g.id===active.id?' active':''));b.setAttribute('aria-current',g.id===active.id?'step':'false');b.append(el('span','group-number',String(i+1).padStart(2,'0')),el('strong',null,g.name),el('small',null,g.hint),el('span','group-progress',`${p.done} / ${p.total} 확인`));return b;}));
    $('subcategories').replaceChildren(...active.codes.map(code=>{const q=S.boot.catalog.find(q=>q.section_code===code),p=F.progress(sectionQuestions(code),S.form);const b=btn((q?.section_name||'사진·영상')+` ${p.done}/${p.total}`,()=>{S.category=code;S.questionPage=0;renderCategory();},code===S.category?'active':'');b.setAttribute('aria-current',code===S.category?'page':'false');return b;}));
  }
  function refreshProgress(){if(!S.boot||!S.form)return;const p=F.progress(S.boot.catalog,S.form);$('progress-heading').textContent=`${p.done}개 확인했어요`;$('progress-detail').textContent=`전체 ${p.total}개 중 ${p.left}개가 남았어요. 아는 내용부터 조금씩 채워 주세요.`;$('farm-progress').value=p.percent;$('farm-progress').setAttribute('aria-label',`${p.percent}% 수집 완료`);const cards=$('categories').children;F.groups.forEach((g,i)=>{const summary=F.progress(S.boot.catalog.filter(q=>g.codes.includes(q.section_code)),S.form);const label=cards[i]?.querySelector('.group-progress');if(label)label.textContent=`${summary.done} / ${summary.total} 확인`;});}
  function turnQuestion(direction){S.questionPage+=direction;renderCategory();$('category-title').scrollIntoView({behavior:'smooth',block:'start'});$('question-form').querySelector('input,textarea,select')?.focus({preventScroll:true});}
  $('question-search').addEventListener('input',()=>{S.questionQuery=$('question-search').value;S.questionPage=0;renderCategory();});
  $('question-filter').addEventListener('change',()=>{S.questionFilter=$('question-filter').value;S.questionPage=0;renderCategory();});
  function jumpToQuestion(q){S.category=q.section_code;S.questionQuery='';S.questionFilter='all';$('question-search').value='';$('question-filter').value='all';S.questionPage=Math.floor(sectionQuestions(q.section_code).findIndex(x=>x.item_key===q.item_key)/5);renderCategory();if(q.input_type==='SHOT'){$('shot-select').value=q.item_key;renderShotGuide();$('media-panel').scrollIntoView({behavior:'smooth'});}else{$('q-'+q.item_key)?.focus();}}
  $('answer-summary').addEventListener('click',()=>{
    const root=$('summary-content');root.replaceChildren();
    const answered=S.boot.catalog.filter(q=>F.hasValue(S.form.answers[q.item_key])||F.received(q,S.form));
    if(!answered.length)root.append(el('p','empty','아직 입력한 내용이 없습니다. 알고 계신 내용부터 적어 주세요.'));
    for(const g of F.groups){const items=answered.filter(q=>g.codes.includes(q.section_code));if(!items.length)continue;root.append(el('h3',null,g.name));for(const q of items){const row=btn('',()=>{$('summary-dialog').close();jumpToQuestion(q);},'summary-row');let value=S.form.answers[q.item_key];if(['SHOT','file'].includes(q.input_type))value=(S.form.media||[]).filter(m=>q.input_type==='SHOT'?m.shot_code===q.item_key:m.upload_id===value).map(m=>m.file_name).join(', ')||'첨부 확인 필요';row.append(el('strong',null,q.item_label),el('span',null,Array.isArray(value)?value.join(', '):String(value)));root.append(row);}}
    $('summary-dialog').showModal();
  });
  $('close-summary').addEventListener('click',()=>$('summary-dialog').close());
  $('close-request').addEventListener('click',()=>$('request-dialog').close());
  function updateRequestCount(){const n=$('request-items').querySelectorAll('input:checked').length;$('request-count').textContent=`${n}개 선택`;$('request-download').disabled=!n;}
  $('request-pdf').addEventListener('click',()=>{
    const root=$('request-items');root.replaceChildren();const items=F.missing(S.boot.catalog,S.form);
    for(const g of F.groups){const groupItems=items.filter(q=>g.codes.includes(q.section_code));if(!groupItems.length)continue;const group=el('section','request-group');group.append(el('h3',null,g.name));for(const q of groupItems){const label=el('label','request-item'),input=el('input');input.type='checkbox';input.value=q.item_key;input.checked=true;input.addEventListener('change',updateRequestCount);label.append(input,el('span',null,q.plain_question||q.item_label));group.append(label);}root.append(group);}
    if(!items.length)root.append(el('p','empty','요청할 미입력 자료가 없습니다.'));
    updateRequestCount();$('request-dialog').showModal();
  });
  $('request-select-all').addEventListener('click',()=>{$('request-items').querySelectorAll('input').forEach(n=>n.checked=true);updateRequestCount();});
  $('request-select-none').addEventListener('click',()=>{$('request-items').querySelectorAll('input').forEach(n=>n.checked=false);updateRequestCount();});
  $('request-download').addEventListener('click',async()=>{
    const button=$('request-download');button.disabled=true;button.textContent='PDF 만드는 중…';
    try{const keys=new Set([...$('request-items').querySelectorAll('input:checked')].map(n=>n.value));const items=F.missing(S.boot.catalog,S.form).filter(q=>keys.has(q.item_key));if(!items.length)throw Error('요청할 항목을 선택해 주세요.');await Code1Pdf.downloadRequest({name:S.form.name||'농가',items,due:$('request-date').value,contact:$('request-contact').value,note:$('request-note').value});toast('농가에 보낼 요청서를 다운로드했습니다.');}catch(e){fail(e);}finally{button.textContent='선택한 자료 PDF 다운로드';updateRequestCount();}
  });
  const reloadDeck=btn('다시 불러오기',async()=>{if(hasUnsavedChanges()){toast('저장하지 않은 내용이 있습니다. 먼저 저장해 주세요.');return;}reloadDeck.disabled=true;try{const b=await rpc('bootstrap');S.deck=Code1Core.validateDeck(b.deck);S.baseVersion=S.deck.version;S.savedDeckSlides=deckSnapshot(S.deck);S.history=new Code1Core.History(S.deck);S.assets=await rpc('deckAssets');S.selected=null;renderDeck();toast('저장된 제안서를 불러왔습니다.');}catch(e){fail(e);}finally{reloadDeck.disabled=false;}});
  document.querySelector('.deck-toolbar').append(reloadDeck);

  async function restoreSession(){try{const response=await fetch('/api/session');const data=await response.json();if(!data.configured){$('login-status').textContent='운영 연결 설정 중입니다. 관리자 설정이 끝나면 여기에서 로그인할 수 있습니다.';$('sign-in').disabled=true;return;}if(data.authenticated)await bootstrap();else if(new URLSearchParams(location.search).get('login')==='failed')$('login-status').textContent='로그인하지 못했습니다. 등록된 계정인지 확인하고 다시 시도해 주세요.';}catch(e){$('login-status').textContent='서버 연결을 확인할 수 없습니다. 잠시 후 새로고침해 주세요.';}}
  restoreSession();
})();
