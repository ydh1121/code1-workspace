(() => {
  'use strict';
  const state={user:null,permissions:null,submissionId:'',submissionStatus:'',farmId:'',farmName:'',media:[],deleted:new Set()};
  const nativeFetch=window.fetch.bind(window);
  const rpcUrl=url=>typeof url==='string'?url:(url&&url.url)||'';
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const isAdmin=()=>['SUPER_ADMIN','ADMIN'].includes(state.user?.role);
  const mediaAssetCache=new Map(),mediaBatchWaiters=new Map();let mediaBatchTimer=null;
  function mediaStatus(text,kind){const n=document.getElementById('media-status');if(!n)return;n.textContent=text;n.dataset.kind=kind||'';}
  function synthetic(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
  function queueMediaAsset(id){
    id=String(id||'');if(!id)return Promise.resolve(synthetic({error:'INVALID_REQUEST'},400));
    if(mediaAssetCache.has(id))return Promise.resolve(synthetic({data:mediaAssetCache.get(id)}));
    return new Promise(resolve=>{const waiters=mediaBatchWaiters.get(id)||[];waiters.push(resolve);mediaBatchWaiters.set(id,waiters);if(!mediaBatchTimer)mediaBatchTimer=setTimeout(flushMediaAssets,16);});
  }
  async function flushMediaAssets(){
    mediaBatchTimer=null;const ids=[...mediaBatchWaiters.keys()].slice(0,32);if(!ids.length)return;
    try{
      const response=await nativeFetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'mediaBatch',payload:{ids}})});
      let body;try{body=await response.json();}catch{body={error:'REQUEST_FAILED',message:'이미지를 불러오지 못했습니다.'};}
      ids.forEach(id=>{const waiters=mediaBatchWaiters.get(id)||[];mediaBatchWaiters.delete(id);const item=body?.data?.[id];if(response.ok&&!body?.error&&item&&!item.error){mediaAssetCache.set(id,item);waiters.forEach(done=>done(synthetic({data:item})));}else{const payload=body?.error?body:{error:'REQUEST_FAILED',message:item?.error||'이미지를 불러오지 못했습니다.'};waiters.forEach(done=>done(synthetic(payload,response.ok?400:(response.status||400))));}});
    }catch(_){ids.forEach(id=>{const waiters=mediaBatchWaiters.get(id)||[];mediaBatchWaiters.delete(id);waiters.forEach(done=>done(synthetic({error:'REQUEST_FAILED',message:'이미지를 불러오지 못했습니다.'},502)));});}
    if(mediaBatchWaiters.size)mediaBatchTimer=setTimeout(flushMediaAssets,0);
  }
  function handleRpc(action,payload,data){
    if(action==='bootstrap'&&data){state.user=data.user||null;state.permissions=data.permissions||null;}
    if(action==='saveSubmission'&&data){state.submissionId=String(payload?.id||state.submissionId);state.submissionStatus=String(data.status||'');state.farmId=String(data.farmId||state.farmId);state.farmName=String(payload?.name||state.farmName);}
    if(action==='getSubmission'&&data){state.submissionId=String(data.id||payload?.id||'');state.submissionStatus=String(data.status||'');state.farmId=String(data.farmId||data.farm_id||'');state.farmName=String(data.name||data.farmName||data.farm_name||'');state.media=Array.isArray(data.media)?data.media.filter(m=>m.status!=='DELETED'):[];state.deleted=new Set();}
    if((action==='upload'||action==='linkDrive')&&data?.upload_id){state.media.push(data);if(data.organization)setTimeout(()=>organizationMessage(data.organization),0);}
    if(action==='mediaUpload.finish'&&data?.media){state.media.push(data.media);if(data.organization)setTimeout(()=>organizationMessage(data.organization),0);}
    if(action==='reviewMedia'&&data?.upload_id){const m=state.media.find(x=>x.upload_id===data.upload_id);if(m)Object.assign(m,data);}
    if(action==='deleteMedia'&&data?.id){mediaAssetCache.delete(String(data.id));state.deleted.add(data.id);const m=state.media.find(x=>x.upload_id===data.id);if(m)m.status='DELETED';}
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
    if(meta?.action==='media'&&meta.payload?.id)return queueMediaAsset(meta.payload.id);
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
    input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;setTimeout(()=>{const box=document.getElementById('media-file-preview');if(!box)return;box.querySelector('.media-original-note')?.remove();const legacy=box.querySelector('.media-file-info b');if(chunkedRequired(file)&&file.size<=250*1024*1024){if(legacy)legacy.textContent='8MB 직접 전송 한도를 넘겨 고화질 원본 분할 업로드로 자동 전환합니다.';const note=document.createElement('b');note.className='media-original-note';note.textContent='압축·리사이즈 없이 촬영 원본 그대로 Drive에 저장';note.dataset.kind='ok';box.append(note);}else if(file.size>250*1024*1024){if(legacy)legacy.textContent='250MB 초과 · 비공개 Drive 원본 연결을 사용해 주세요.';const note=document.createElement('b');note.className='media-original-note';note.textContent='대형 영상은 Drive에 먼저 올린 뒤 원본 연결';note.dataset.kind='warn';box.append(note);}},0);});
    form.addEventListener('submit',async e=>{const file=input.files?.[0];if(!chunkedRequired(file))return;e.preventDefault();e.stopImmediatePropagation();const button=e.submitter;if(button)button.disabled=true;try{if(!form.reportValidity())return;await highResolutionUpload(file,button);}catch(err){mediaStatus(String(err.message||err).replace(/^Error:\s*/,''),'error');}finally{if(button)button.disabled=false;}},true);
  }
  function visibleMedia(){return state.media.filter(m=>m&&m.status!=='DELETED'&&!state.deleted.has(m.upload_id));}
  function canDelete(){return state.permissions?.farm==='edit'&&!['APPROVED','REFLECTED'].includes(state.submissionStatus);}
  async function removeMedia(m,card){
    if(!canDelete())return;if(!confirm(`“${m.file_name||m.shot_label||'이 파일'}”을 삭제할까요?\n\nDrive 원본은 휴지통으로 이동하고 삭제 이력은 남습니다.`))return;
    const reason=prompt('삭제 사유를 간단히 적어 주세요.','잘못 업로드한 자료');if(reason===null)return;
    try{await rpc('deleteMedia',{id:m.upload_id,reason:reason||'사용자 삭제',requestId:uid()});card?.remove();mediaStatus('파일을 삭제했습니다. Drive 원본은 휴지통으로 이동했고 이력은 보존됩니다.','ok');ensureMediaCards();}catch(e){mediaStatus(String(e.message||e).replace(/^Error:\s*/,''),'error');}
  }
  function makeFallbackCard(m){const card=document.createElement('article');card.className='media-card';if(/^image\//.test(m.mime_type||'')){const im=document.createElement('img');im.loading='lazy';im.decoding='async';im.alt=m.caption||m.shot_label||'업로드 이미지';card.append(im);rpc('media',{id:m.upload_id}).then(a=>{if(a?.url)im.src=a.url;}).catch(()=>im.remove());}const strong=document.createElement('strong');strong.textContent=m.shot_label||m.shot_code||'자료';const p=document.createElement('p');p.textContent=m.file_name||'';const small=document.createElement('small');small.textContent=m.status==='APPROVED'?'사용권 검토 승인':m.status==='REJECTED'?'사용 보류':'사용권 검토 대기';card.append(strong,p,small);return card;}
  function enhanceCard(card,m){if(!card||!m)return;card.dataset.mediaId=m.upload_id||'';const img=card.querySelector('img');if(img){img.loading='lazy';img.decoding='async';}if(card.querySelector('.media-delete'))return;if(canDelete()){const b=document.createElement('button');b.type='button';b.className='media-delete danger';b.textContent='자료 삭제';b.addEventListener('click',()=>removeMedia(m,card));card.append(b);}}
  function ensureMediaCards(){const list=document.getElementById('media-list');if(!list)return;const media=visibleMedia();let cards=[...list.querySelectorAll('.media-card')];for(let i=0;i<Math.min(cards.length,media.length);i++)enhanceCard(cards[i],media[i]);if(cards.length<media.length){for(let i=cards.length;i<media.length;i++){const card=makeFallbackCard(media[i]);enhanceCard(card,media[i]);list.append(card);}}cards=[...list.querySelectorAll('.media-card')];cards.forEach(card=>{const id=card.dataset.mediaId;if(id&&state.deleted.has(id))card.remove();});const count=document.getElementById('media-history-count');if(count)count.textContent=`${visibleMedia().length}개`;}
  function repairControls(status){
    const panel=document.getElementById('media-panel');if(!panel)return;let wrap=document.getElementById('media-organizer-tools');if(!wrap){wrap=document.createElement('div');wrap.id='media-organizer-tools';wrap.className='media-organizer-tools';const history=panel.querySelector('.media-history')||document.getElementById('media-list');panel.insertBefore(wrap,history||null);}
    wrap.replaceChildren();
    if(!status.installed){const p=document.createElement('p');p.textContent='자동 분류 모듈이 Apps Script 배포에 없습니다. 원본은 저장되지만 폴더 이동·표준 파일명·정리 이력이 실행되지 않습니다.';wrap.append(p);return;}
    if(Number(status.unorganizedCount)>0&&isAdmin()){
      const p=document.createElement('p');p.textContent=`기존 미정리 파일 ${status.unorganizedCount}개가 있습니다. 이전 업로드도 표준 폴더와 파일명으로 정리할 수 있습니다.`;
      const b=document.createElement('button');b.type='button';b.className='primary';b.textContent=`기존 미정리 파일 ${status.unorganizedCount}개 정리`;
      b.addEventListener('click',async()=>{if(!confirm(`${status.unorganizedCount}개 파일을 농가별 폴더로 이동하고 표준 파일명으로 변경할까요? 원본 바이트는 변경하지 않습니다.`))return;b.disabled=true;try{mediaStatus('기존 파일 자동정리 중…','progress');const r=await rpc('mediaOrganizer.repair',{limit:50});const failed=(r.results||[]).filter(x=>!x.organized);mediaStatus(failed.length?`${r.processed-failed.length}건 정리 완료 · ${failed.length}건 확인 필요`:`${r.processed}건 자동정리 완료 · 파일명과 24_WEB_미디어정리_이력을 갱신했습니다.` ,failed.length?'warn':'ok');await refreshOrganizerStatus();}catch(e){mediaStatus(String(e.message||e).replace(/^Error:\s*/,''),'error');}finally{b.disabled=false;}});wrap.append(p,b);
    }else if(Number(status.unorganizedCount)===0){const p=document.createElement('p');p.className='muted';p.textContent='Drive 자동 분류 상태 정상 · 새 업로드는 농가별 폴더와 표준 파일명으로 정리됩니다.';wrap.append(p);}
  }
  async function refreshOrganizerStatus(){try{const s=await rpc('mediaOrganizer.status');repairControls(s);if(!s.installed)mediaStatus('자동 분류 모듈이 아직 Apps Script 배포에 반영되지 않았습니다. 원본은 저장되지만 폴더 정리와 파일명 변경은 실행되지 않습니다.','warn');return s;}catch(e){const text=String(e.message||e);if(/MEDIA_LIFECYCLE_UPDATE_REQUIRED|PERFORMANCE_READ_UPDATE_REQUIRED|UNKNOWN_ACTION/.test(text))mediaStatus('Apps Script의 미디어/성능 연결 파일과 최신 CloudflareBridge.gs를 새 버전으로 배포해야 합니다.','warn');return null;}}
  function installOrganizerStatus(){document.addEventListener('code1-ready',()=>refreshOrganizerStatus());}
  const list=document.getElementById('media-list');if(list)new MutationObserver(()=>queueMicrotask(ensureMediaCards)).observe(list,{childList:true});
  installHighRes();installOrganizerStatus();ensureMediaCards();
})();
