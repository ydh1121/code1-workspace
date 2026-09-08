(() => {
  'use strict';
  const state={user:null,permissions:null,submissionId:'',submissionStatus:'',farmId:'',farmName:'',media:[],deleted:new Set()};
  const nativeFetch=window.fetch.bind(window);
  const rpcUrl=url=>typeof url==='string'?url:(url&&url.url)||'';
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  function mediaStatus(text,kind){const n=document.getElementById('media-status');if(!n)return;n.textContent=text;n.dataset.kind=kind||'';}
  function handleRpc(action,payload,data){
    if(action==='bootstrap'&&data){state.user=data.user||null;state.permissions=data.permissions||null;}
    if(action==='saveSubmission'&&data){state.submissionId=String(payload?.id||state.submissionId);state.submissionStatus=String(data.status||'');state.farmId=String(data.farmId||state.farmId);state.farmName=String(payload?.name||state.farmName);}
    if(action==='getSubmission'&&data){state.submissionId=String(data.id||payload?.id||'');state.submissionStatus=String(data.status||'');state.farmId=String(data.farmId||data.farm_id||'');state.farmName=String(data.name||data.farmName||data.farm_name||'');state.media=Array.isArray(data.media)?data.media.filter(m=>m.status!=='DELETED'):[];state.deleted=new Set();}
    if((action==='upload'||action==='linkDrive')&&data?.upload_id){state.media.push(data);if(data.organization)setTimeout(()=>organizationMessage(data.organization),0);}
    if(action==='mediaUpload.finish'&&data?.media){state.media.push(data.media);if(data.organization)setTimeout(()=>organizationMessage(data.organization),0);}
    if(action==='reviewMedia'&&data?.upload_id){const m=state.media.find(x=>x.upload_id===data.upload_id);if(m)Object.assign(m,data);}
    if(action==='deleteMedia'&&data?.id){state.deleted.add(data.id);const m=state.media.find(x=>x.upload_id===data.id);if(m)m.status='DELETED';}
  }
  function organizationMessage(org){
    if(!org)return;
    if(org.organized)mediaStatus(`원본 저장 및 자동정리 완료 · ${org.folderPath||'농가별 폴더'}`,'ok');
    else if(org.error==='MEDIA_ORGANIZER_NOT_INSTALLED')mediaStatus('원본은 저장됐지만 자동 분류가 실행되지 않았습니다. Apps Script의 MediaOrganizer.gs와 최신 CloudflareBridge.gs 배포를 확인해 주세요.','warn');
    else if(org.error)mediaStatus(`원본은 저장됐지만 자동 분류 실패 · ${org.error}`,'warn');
  }
  window.fetch=async function(input,init){
    let meta=null;
    try{if(rpcUrl(input).endsWith('/api/rpc')&&init?.method?.toUpperCase()==='POST'&&typeof init.body==='string'){const b=JSON.parse(init.body);meta={action:b.action,payload:b.payload||{}};}}catch{}
    const response=await nativeFetch(input,init);
    if(meta){try{const body=await response.clone().json();if(response.ok&&!body.error)handleRpc(meta.action,meta.payload,body.data);}catch{}}
    return response;
  };
  async function rpc(action,payload={}){const r=await window.fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const j=await r.json();if(!r.ok||j.error)throw Error((j.error||'REQUEST_FAILED')+': '+(j.message||''));return j.data;}
  function waitForSubmission(timeout=7000){return new Promise((resolve,reject)=>{const started=Date.now(),tick=()=>{if(state.submissionId)return resolve(state.submissionId);if(Date.now()-started>timeout)return reject(Error('대용량 원본 업로드 전에 현재 농가 자료를 임시저장해 주세요.'));setTimeout(tick,120);};tick();});}
  function ext(name){const m=String(name||'').toLowerCase().match(/\.([a-z0-9]{1,8})$/);return m?m[1]:'';}
  function chunkedRequired(file){return !!file&&(file.size>8*1024*1024||['heic','heif','tif','tiff','dng','cr2','cr3','nef','arw','raf','rw2','orf','pef','mov'].includes(ext(file.name)));}
  function allowedOriginal(file){return !!file&&['jpg','jpeg','png','webp','heic','heif','tif','tiff','dng','cr2','cr3','nef','arw','raf','rw2','orf','pef','pdf','mp4','mov'].includes(ext(file.name));}
  function metadata(){const get=id=>document.getElementById(id)?.value||'',m={caption:get('media-caption'),photographer:get('media-photographer'),taken_at:get('media-date'),rights_owner:get('media-rights'),face_present:get('media-face'),face_consent:get('media-consent'),b2b_use:get('media-usage'),privacy_checked:get('media-privacy')};document.querySelectorAll('[data-media-meta]').forEach(n=>m[n.dataset.mediaMeta]=n.value);return m;}
  function bytesToBase64(buffer){const bytes=new Uint8Array(buffer),step=0x8000,parts=[];for(let i=0;i<bytes.length;i+=step)parts.push(String.fromCharCode(...bytes.subarray(i,i+step)));return btoa(parts.join(''));}
  async function highResolutionUpload(file,button){
    if(!allowedOriginal(file))throw Error('지원하는 원본 형식이 아닙니다. JPG·PNG·WebP·HEIC·TIFF·RAW·PDF·MP4·MOV를 사용해 주세요.');
    if(file.size>250*1024*1024)throw Error('250MB를 넘는 대형 영상·원본은 비공개 Drive 원본 연결을 사용해 주세요.');
    if(!state.submissionId){document.getElementById('draft-save')?.click();await waitForSubmission();}
    const shot=document.getElementById('shot-select')?.value;if(!shot)throw Error('촬영 항목을 먼저 선택해 주세요.');
    const begin=await rpc('mediaUpload.begin',{submissionId:state.submissionId,shotCode:shot,fileName:file.name,mimeType:file.type||'',fileSize:file.size,metadata:metadata(),requestId:uid()});
    const chunkSize=Number(begin.chunkBytes)||4*1024*1024;let offset=0;
    while(offset<file.size){const end=Math.min(file.size,offset+chunkSize),buf=await file.slice(offset,end).arrayBuffer();mediaStatus(`고화질 원본 업로드 중 · ${Math.floor(offset/file.size*100)}% · 원본은 압축하지 않습니다.`,'progress');const part=await rpc('mediaUpload.chunk',{sessionId:begin.sessionId,offset,total:file.size,base64:bytesToBase64(buf),requestId:uid()});offset=Number(part.received);if(!Number.isFinite(offset)||offset<=0)throw Error('UPLOAD_PROGRESS_INVALID');}
    mediaStatus('원본 업로드 완료 · Drive 기록과 자동 분류 마무리 중…','progress');const done=await rpc('mediaUpload.finish',{sessionId:begin.sessionId,requestId:uid()});organizationMessage(done.organization);const input=document.getElementById('media-file');if(input){input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));}ensureMediaCards();return done;
  }
  function installHighRes(){
    const form=document.getElementById('media-form'),input=document.getElementById('media-file');if(!form||!input||form.dataset.lifecycle==='1')return;form.dataset.lifecycle='1';
    input.accept='.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff,.dng,.cr2,.cr3,.nef,.arw,.raf,.rw2,.orf,.pef,.pdf,.mp4,.mov,image/*,video/mp4,video/quicktime,application/pdf';
    input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;setTimeout(()=>{const box=document.getElementById('media-file-preview');if(!box)return;const old=box.querySelector('.media-original-note');old?.remove();const note=document.createElement('b');note.className='media-original-note';if(chunkedRequired(file)&&file.size<=250*1024*1024){note.textContent='고화질 원본 분할 업로드 · 압축/리사이즈 없이 Drive에 원본 그대로 저장';note.dataset.kind='ok';}else if(file.size>250*1024*1024){note.textContent='250MB 초과 · 비공개 Drive 원본 연결 사용';note.dataset.kind='warn';}else return;box.append(note);},0);});
    form.addEventListener('submit',async e=>{const file=input.files?.[0];if(!chunkedRequired(file))return;e.preventDefault();e.stopImmediatePropagation();const button=e.submitter;if(button)button.disabled=true;try{if(!form.reportValidity())return;await highResolutionUpload(file,button);}catch(err){mediaStatus(String(err.message||err).replace(/^Error:\s*/,''),'error');}finally{if(button)button.disabled=false;}},true);
  }
  function visibleMedia(){return state.media.filter(m=>m&&m.status!=='DELETED'&&!state.deleted.has(m.upload_id));}
  function canDelete(){return state.permissions?.farm==='edit'&&!['APPROVED','REFLECTED'].includes(state.submissionStatus);}
  async function removeMedia(m,card){
    if(!canDelete())return;if(!confirm(`“${m.file_name||m.shot_label||'이 파일'}”을 삭제할까요?\n\nDrive 원본은 휴지통으로 이동하고 삭제 이력은 남습니다.`))return;
    const reason=prompt('삭제 사유를 간단히 적어 주세요.','잘못 업로드한 자료');if(reason===null)return;
    try{await rpc('deleteMedia',{id:m.upload_id,reason:reason||'사용자 삭제',requestId:uid()});card?.remove();mediaStatus('파일을 삭제했습니다. Drive 원본은 휴지통으로 이동했고 이력은 보존됩니다.','ok');ensureMediaCards();}catch(e){mediaStatus(String(e.message||e).replace(/^Error:\s*/,''),'error');}
  }
  function makeFallbackCard(m){const card=document.createElement('article');card.className='media-card';if(/^image\//.test(m.mime_type||'')){const im=document.createElement('img');im.alt=m.caption||m.shot_label||'업로드 이미지';card.append(im);rpc('media',{id:m.upload_id}).then(a=>{if(a?.url)im.src=a.url;}).catch(()=>im.remove());}const strong=document.createElement('strong');strong.textContent=m.shot_label||m.shot_code||'자료';const p=document.createElement('p');p.textContent=m.file_name||'';const small=document.createElement('small');small.textContent=m.status==='APPROVED'?'사용권 검토 승인':m.status==='REJECTED'?'사용 보류':'사용권 검토 대기';card.append(strong,p,small);return card;}
  function enhanceCard(card,m){if(!card||!m)return;card.dataset.mediaId=m.upload_id||'';if(card.querySelector('.media-delete'))return;if(canDelete()){const b=document.createElement('button');b.type='button';b.className='media-delete danger';b.textContent='자료 삭제';b.addEventListener('click',()=>removeMedia(m,card));card.append(b);}}
  function ensureMediaCards(){const list=document.getElementById('media-list');if(!list)return;const media=visibleMedia();let cards=[...list.querySelectorAll('.media-card')];for(let i=0;i<Math.min(cards.length,media.length);i++)enhanceCard(cards[i],media[i]);if(cards.length<media.length){for(let i=cards.length;i<media.length;i++){const card=makeFallbackCard(media[i]);enhanceCard(card,media[i]);list.append(card);}}cards=[...list.querySelectorAll('.media-card')];cards.forEach(card=>{const id=card.dataset.mediaId;if(id&&state.deleted.has(id))card.remove();});const count=document.getElementById('media-history-count');if(count)count.textContent=`${visibleMedia().length}개`;}
  function installOrganizerStatus(){document.addEventListener('code1-ready',async()=>{try{const s=await rpc('mediaOrganizer.status');if(!s.installed)mediaStatus('자동 분류 모듈이 아직 Apps Script 배포에 반영되지 않았습니다. 원본은 저장되지만 폴더 정리와 파일명 변경은 실행되지 않습니다.','warn');}catch{}},{once:false});}
  const list=document.getElementById('media-list');if(list)new MutationObserver(()=>queueMicrotask(ensureMediaCards)).observe(list,{childList:true});
  installHighRes();installOrganizerStatus();ensureMediaCards();
})();
