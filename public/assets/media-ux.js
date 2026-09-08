(() => {
  'use strict';
  const panel=document.getElementById('media-panel');
  const select=document.getElementById('shot-select');
  const form=document.getElementById('media-form');
  const guide=document.getElementById('shot-guide');
  const fileInput=document.getElementById('media-file');
  const mediaList=document.getElementById('media-list');
  if(!panel||!select||!form||!guide||!fileInput||!mediaList||document.getElementById('media-shot-picker'))return;

  const groups=[
    {key:'all',label:'전체',match:()=>true},
    {key:'product',label:'상품·포장',match:v=>/^PHOTO-P/i.test(v)},
    {key:'farm',label:'농장·환경',match:v=>/^PHOTO-F/i.test(v)},
    {key:'work',label:'작업·공정',match:v=>/^PHOTO-W/i.test(v)},
    {key:'people',label:'농장주·인물',match:v=>/^PHOTO-H/i.test(v)},
    {key:'video',label:'영상',match:v=>/^VIDEO-/i.test(v)},
    {key:'other',label:'기타',match:v=>!/^PHOTO-[PFWH]|^VIDEO-/i.test(v)}
  ];
  let activeGroup='all',previewUrl='',autoCaption='';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const groupFor=value=>groups.find(g=>g.key!=='all'&&g.key!=='other'&&g.match(value))?.key||(groups.find(g=>g.key==='other'&&g.match(value))?'other':'all');
  const categoryFor=value=>{
    if(/^PHOTO-P/i.test(value))return {type:'01_사진',category:'01_상품·포장'};
    if(/^PHOTO-F/i.test(value))return {type:'01_사진',category:'02_농장·환경'};
    if(/^PHOTO-W/i.test(value))return {type:'01_사진',category:'03_작업·공정'};
    if(/^PHOTO-H/i.test(value))return {type:'01_사진',category:'04_농장주·인물'};
    if(/^VIDEO-/i.test(value)){
      const n=Number(String(value).split('-')[1]);
      if(n>=1&&n<=3)return {type:'02_영상',category:'01_농장·환경'};
      if(n>=4&&n<=8)return {type:'02_영상',category:'02_작업·공정'};
      if(n>=9&&n<=10)return {type:'02_영상',category:'03_인터뷰'};
      if(n===11)return {type:'02_영상',category:'04_현장음'};
      return {type:'02_영상',category:'09_기타'};
    }
    return {type:'01_사진',category:'09_기타'};
  };

  const nativeLabel=select.closest('label');
  if(nativeLabel)nativeLabel.classList.add('media-native-shot-select');

  const picker=el('section','media-shot-picker');picker.id='media-shot-picker';
  picker.innerHTML='<div class="media-ux-heading"><div><span class="media-step">1</span><div><h3>어떤 사진·영상인가요?</h3><p>긴 목록을 펼치지 말고 분류나 검색으로 바로 찾으세요.</p></div></div><span id="media-shot-result-count"></span></div><div class="media-shot-tools"><input id="media-shot-search" type="search" placeholder="촬영 항목 검색 · 예: 난각, 포장, 농장주"><div id="media-shot-groups" class="media-shot-groups" role="tablist" aria-label="촬영 항목 분류"></div></div><div id="media-shot-grid" class="media-shot-grid"></div><div class="media-selected"><div class="media-selected-head"><span class="media-step">2</span><div><small>선택한 촬영 항목</small><strong id="media-selected-title">선택해 주세요</strong><span id="media-selected-code"></span></div></div><div id="media-storage-preview" class="media-storage-preview"></div></div>';
  const intro=panel.querySelector(':scope > p.muted');
  panel.insertBefore(picker,nativeLabel||guide);
  picker.querySelector('.media-selected').append(guide);

  const search=picker.querySelector('#media-shot-search'),groupBar=picker.querySelector('#media-shot-groups'),grid=picker.querySelector('#media-shot-grid'),count=picker.querySelector('#media-shot-result-count');
  const selectedTitle=picker.querySelector('#media-selected-title'),selectedCode=picker.querySelector('#media-selected-code'),storage=picker.querySelector('#media-storage-preview');

  function options(){return [...select.options].filter(o=>o.value);}
  function choose(value){
    if(!value||![...select.options].some(o=>o.value===value))return;
    select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
    syncSelected();renderCards();
    picker.querySelector('.media-selected').scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  function syncSelected(){
    const option=select.selectedOptions?.[0],value=option?.value||'',label=option?.textContent?.trim()||'선택해 주세요';
    selectedTitle.textContent=label;selectedCode.textContent=value;
    const caption=document.getElementById('media-caption');
    if(caption&&value&&(!caption.value.trim()||caption.value===autoCaption)){caption.value=label;autoCaption=label;}
    const farm=document.getElementById('farm-name')?.value.trim()||'농가명 미정',path=categoryFor(value);
    storage.innerHTML='';
    const title=el('b',null,'자동 저장 위치');
    const route=el('span',null,`농가별  ›  ${farm}  ›  ${path.type}  ›  ${path.category}`);
    const file=el('small',null,value?`파일명도 “${farm}_${value}_${label}_날짜_…” 형식으로 자동 정리됩니다.`:'촬영 항목을 고르면 Drive 저장 위치와 파일명이 자동 결정됩니다.');
    storage.append(title,route,file);
    const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent=value?`${label} 원본 업로드`:'비공개 원본 업로드';
  }
  function renderGroups(){
    const opts=options();groupBar.replaceChildren(...groups.map(g=>{
      const n=el('button','media-shot-group');n.type='button';n.dataset.group=g.key;n.setAttribute('role','tab');n.setAttribute('aria-selected',String(activeGroup===g.key));
      const total=g.key==='all'?opts.length:opts.filter(o=>g.match(o.value)).length;n.textContent=`${g.label} ${total}`;n.hidden=g.key!=='all'&&total===0;
      n.addEventListener('click',()=>{activeGroup=g.key;renderGroups();renderCards();});return n;
    }));
  }
  function renderCards(){
    const needle=search.value.trim().toLocaleLowerCase(),opts=options();
    if(select.value&&activeGroup==='all'&&!needle)activeGroup=groupFor(select.value);
    const group=groups.find(g=>g.key===activeGroup)||groups[0];
    const filtered=opts.filter(o=>{
      const matchesText=!needle||(o.textContent+' '+o.value).toLocaleLowerCase().includes(needle);
      return matchesText&&(needle||group.key==='all'||group.match(o.value));
    });
    count.textContent=`${filtered.length}개`;
    grid.replaceChildren(...filtered.map(o=>{
      const b=el('button','media-shot-card'+(o.value===select.value?' selected':''));b.type='button';b.dataset.shot=o.value;
      b.append(el('small',null,o.value),el('strong',null,o.textContent));
      const meta=categoryFor(o.value);b.append(el('span',null,meta.type.replace(/^\d+_/,'')+' · '+meta.category.replace(/^\d+_/,' ')));
      b.addEventListener('click',()=>choose(o.value));return b;
    }));
    if(!filtered.length)grid.append(el('p','media-shot-empty','검색 결과가 없습니다. 다른 검색어 또는 분류를 선택해 주세요.'));
  }
  function rebuildPicker(){
    if(!options().length){grid.replaceChildren(el('p','media-shot-empty','촬영 항목을 불러오는 중…'));return;}
    if(!select.value)select.value=options()[0].value;
    if(activeGroup==='all')activeGroup=groupFor(select.value);
    renderGroups();renderCards();syncSelected();
  }
  search.addEventListener('input',()=>{renderGroups();renderCards();});
  select.addEventListener('change',()=>{if(!search.value.trim())activeGroup=groupFor(select.value);renderGroups();syncSelected();renderCards();});
  new MutationObserver(rebuildPicker).observe(select,{childList:true});
  document.getElementById('farm-name')?.addEventListener('input',syncSelected);

  const firstGrid=form.querySelector(':scope > .fields-grid');
  if(firstGrid){
    const metaCard=el('section','media-form-card media-meta-card');metaCard.innerHTML='<div class="media-form-title"><span class="media-step">3</span><div><h3>설명과 사용권</h3><p>반복 촬영할 때는 앞의 값이 유지되어 빠르게 다음 파일을 올릴 수 있습니다.</p></div></div>';
    form.insertBefore(metaCard,firstGrid);metaCard.append(firstGrid);
    const details=form.querySelector(':scope > details');if(details)metaCard.append(details);
  }

  const oldFileLabel=fileInput.closest('label');
  const submit=form.querySelector('button[type="submit"]'),link=document.getElementById('link-drive'),status=document.getElementById('media-status');
  const uploadCard=el('section','media-form-card media-upload-card');uploadCard.innerHTML='<div class="media-form-title"><span class="media-step">4</span><div><h3>원본 파일 올리기</h3><p>휴대폰·디지털카메라 고화질 원본도 압축하지 않습니다. 8MB 초과·HEIC·RAW는 자동 분할 업로드합니다.</p></div></div><label id="media-dropzone" class="media-dropzone" for="media-file"><div id="media-file-preview" class="media-file-preview"><span class="media-drop-icon">＋</span><strong>파일을 선택하거나 여기로 끌어오세요</strong><small>업로드 전에 파일명과 미리보기를 확인할 수 있습니다.</small></div></label><div class="media-upload-actions"></div>';
  form.append(uploadCard);
  const drop=uploadCard.querySelector('#media-dropzone'),preview=uploadCard.querySelector('#media-file-preview'),actions=uploadCard.querySelector('.media-upload-actions');
  drop.append(fileInput);fileInput.classList.add('media-file-native');if(oldFileLabel&&oldFileLabel!==drop)oldFileLabel.remove();
  if(submit)actions.append(submit);if(link)actions.append(link);if(status)uploadCard.append(status);

  function resetPreview(){if(previewUrl){try{URL.revokeObjectURL(previewUrl);}catch{}previewUrl='';}preview.replaceChildren(el('span','media-drop-icon','＋'),el('strong',null,'파일을 선택하거나 여기로 끌어오세요'),el('small',null,'업로드 전에 파일명과 미리보기를 확인할 수 있습니다.'));drop.classList.remove('has-file','file-warning');}
  function showFile(file){
    if(!file){resetPreview();return;}if(previewUrl){try{URL.revokeObjectURL(previewUrl);}catch{}previewUrl='';}
    preview.replaceChildren();
    if(/^image\//.test(file.type)&&URL.createObjectURL){try{previewUrl=URL.createObjectURL(file);const img=el('img');img.src=previewUrl;img.alt='업로드 전 미리보기';preview.append(img);}catch{preview.append(el('span','media-file-kind','IMAGE'));}}
    else preview.append(el('span','media-file-kind',/^video\//.test(file.type)?'VIDEO':/pdf/i.test(file.type)?'PDF':'FILE'));
    const info=el('div','media-file-info');info.append(el('strong',null,file.name),el('small',null,`${(file.size/1024/1024).toFixed(2)} MB · ${file.type||'형식 미확인'}`));preview.append(info);drop.classList.add('has-file');
    if(file.size>8*1024*1024){drop.classList.add('file-warning');info.append(el('b',null,'8MB 직접 전송 한도를 넘겨 고화질 원본 분할 업로드로 자동 전환합니다.'));}else drop.classList.remove('file-warning');
  }
  fileInput.addEventListener('change',()=>showFile(fileInput.files?.[0]));
  for(const eventName of ['dragenter','dragover'])drop.addEventListener(eventName,e=>{e.preventDefault();drop.classList.add('dragging');});
  for(const eventName of ['dragleave','drop'])drop.addEventListener(eventName,e=>{e.preventDefault();drop.classList.remove('dragging');});
  drop.addEventListener('drop',e=>{const file=e.dataTransfer?.files?.[0];if(!file)return;try{const transfer=new DataTransfer();transfer.items.add(file);fileInput.files=transfer.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));}catch{showFile(file);}});
  if(status)new MutationObserver(()=>{if(/저장됨/.test(status.textContent)&&!fileInput.value)resetPreview();}).observe(status,{childList:true,subtree:true,characterData:true});

  const mediaHistory=el('section','media-history');mediaHistory.innerHTML='<div class="media-history-head"><div><h3>업로드한 파일</h3><p>이 농가에 연결된 사진·영상과 검토 상태입니다.</p></div><strong id="media-history-count">0개</strong></div>';
  mediaList.parentNode.insertBefore(mediaHistory,mediaList);mediaHistory.append(mediaList);
  const historyCount=mediaHistory.querySelector('#media-history-count');
  function enhanceMediaCards(){
    const cards=[...mediaList.querySelectorAll('.media-card')];historyCount.textContent=`${cards.length}개`;
    cards.forEach(card=>{
      if(card.dataset.mediaUx==='1')return;card.dataset.mediaUx='1';
      const image=card.querySelector('img'),body=el('div','media-card-body'),actions=el('div','media-card-actions');
      [...card.children].forEach(node=>{if(node===image)return;if(node.matches?.('a.button,button'))actions.append(node);else body.append(node);});
      if(!image){const placeholder=el('div','media-card-placeholder','FILE');card.prepend(placeholder);}
      card.append(body);if(actions.children.length)body.append(actions);
    });
  }
  new MutationObserver(enhanceMediaCards).observe(mediaList,{childList:true});

  rebuildPicker();enhanceMediaCards();
})();
