(() => {
  'use strict';

  const form=document.getElementById('question-form');
  const summaryText='왜 필요한가 · 입력 도움말';
  const missingText='이 항목의 수집 이유가 아직 등록되지 않았습니다. 입력 항목 관리에서 운영 필요성을 검토해 주세요.';
  let revealScheduled=false;
  function reveal(){
    revealScheduled=false;
    if(!form)return;
    form.querySelectorAll('details.why').forEach(details=>{
      if(!details.open)details.open=true;
      if(!details.classList.contains('question-context-visible'))details.classList.add('question-context-visible');
      const summary=details.querySelector('summary');
      if(summary&&summary.textContent!==summaryText)summary.textContent=summaryText;
      const paragraphs=details.querySelectorAll('p');
      if(paragraphs[0]&&!paragraphs[0].textContent.trim())paragraphs[0].textContent=missingText;
    });
  }
  function scheduleReveal(){if(revealScheduled)return;revealScheduled=true;requestAnimationFrame(reveal);}
  if(form){new MutationObserver(scheduleReveal).observe(form,{childList:true,subtree:true});scheduleReveal();}

  // Temporary internal-workspace hot path.
  // Apps Script/Sheets remains the durable store, but draft saves, revisiting farms and
  // media deletion must not freeze navigation while the durable write finishes.
  const upstreamFetch=window.fetch.bind(window);
  const rpcPath='/api/rpc';
  const entries=new Map();
  const prefetching=new Map();
  const perf=[];
  let outstandingWrites=0;
  let prefetchGeneration=0;

  const clone=value=>value==null?value:structuredClone(value);
  const uid=()=>crypto.randomUUID().replace(/-/g,'');
  const synthetic=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  const requestUrl=input=>typeof input==='string'?input:(input&&input.url)||'';
  const statusNode=()=>document.getElementById('save-status');
  const toastNode=()=>document.getElementById('toast');

  function notePerf(action,started,kind='network'){
    const ms=Math.round(performance.now()-started),row={at:new Date().toISOString(),action,ms,kind};
    perf.push(row);if(perf.length>120)perf.splice(0,perf.length-120);
    window.__CODE1_PERF__=perf;
    console.info('[CODE1 perf]',action,ms+'ms',kind);
  }
  function showBackgroundError(message){
    const text='백그라운드 저장 실패 · '+String(message||'자료 저장소 연결을 확인해 주세요.').replace(/^Error:\s*/,'');
    const s=statusNode();if(s)s.textContent=text;
    const t=toastNode();if(t){t.textContent=text+' 입력 내용은 현재 화면에 남아 있습니다.';t.hidden=false;}
  }
  function pendingStatus(text='저장 중 · 화면 이동 가능'){
    setTimeout(()=>{const s=statusNode();if(s)s.textContent=text;},0);
  }
  function parseRpc(input,init){
    if(!requestUrl(input).endsWith(rpcPath)||String(init?.method||'GET').toUpperCase()!=='POST'||typeof init?.body!=='string')return null;
    try{const body=JSON.parse(init.body);return body&&typeof body.action==='string'?body:null;}catch{return null;}
  }
  function entryFor(id){
    id=String(id||'');if(!entries.has(id))entries.set(id,{id,serverRevision:null,data:null,pending:null,saving:null,error:null});return entries.get(id);
  }
  function captureBootstrap(data){
    const generation=++prefetchGeneration;
    (data?.submissions||[]).forEach(s=>{if(!s?.id)return;const e=entryFor(s.id);e.serverRevision=Number(s.revision)||0;});
    // Warm farm pages after the blocking bootstrap has finished. Reads are limited to
    // two at a time so Apps Script is not flooded, but common farm switching becomes
    // memory-only once a page has been visited or prefetched.
    const ids=(data?.submissions||[]).map(s=>s?.id).filter(Boolean);
    setTimeout(()=>prefetchSubmissions(ids,generation),700);
  }
  function captureSubmission(data){
    if(!data?.id)return data;const e=entryFor(data.id);e.data=clone(data);e.serverRevision=Number(data.revision)||0;e.error=null;return data;
  }
  function localSubmissionFromSave(e,p,revision){
    const base=e.data||{id:p.id,farmId:p.farmId||'',name:p.name||'',status:'DRAFT',revision:0,answers:{},media:[]};
    const next={...clone(base),id:p.id,farmId:p.farmId||base.farmId||'',name:p.name||base.name||'',status:p.status||'DRAFT',revision,answers:clone(p.answers||{})};
    if(!Array.isArray(next.media))next.media=[];
    return next;
  }
  async function upstreamRpc(action,payload){
    const started=performance.now();
    const response=await upstreamFetch(rpcPath,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload})});
    let body;try{body=await response.clone().json();}catch{body=null;}
    notePerf(action,started,'background');
    if(!response.ok||body?.error)throw Error((body?.error||'REQUEST_FAILED')+': '+(body?.message||'요청을 완료하지 못했습니다.'));
    return body?.data;
  }
  async function flushDraft(e){
    if(e.saving)return e.saving;
    e.saving=(async()=>{
      outstandingWrites++;
      try{
        while(e.pending){
          const desired=e.pending;e.pending=null;
          const baseRevision=Number.isInteger(e.serverRevision)?e.serverRevision:(Number(desired.baseRevision)||0);
          const payload={...clone(desired),baseRevision,requestId:uid()};
          const data=await upstreamRpc('saveSubmission',payload);
          e.serverRevision=Number(data?.revision)||baseRevision;e.error=null;
          if(e.data){
            e.data.revision=e.serverRevision;
            e.data.status=data?.status||e.data.status;
            e.data.farmId=data?.farmId||e.data.farmId;
          }
        }
        const s=statusNode();if(s)s.textContent='서버 저장 완료 · r'+(e.serverRevision||0);
      }catch(error){e.error=error;showBackgroundError(error.message||error);}
      finally{outstandingWrites--;e.saving=null;if(e.pending)flushDraft(e);}
    })();
    return e.saving;
  }
  function queueDraft(p){
    const e=entryFor(p.id),base=Number.isInteger(e.serverRevision)?e.serverRevision:(Number(p.baseRevision)||0);
    const optimisticRevision=Math.max(Number(e.data?.revision)||0,base+1);
    e.data=localSubmissionFromSave(e,p,optimisticRevision);
    e.pending=clone(p);e.error=null;
    pendingStatus();
    flushDraft(e);
    return {revision:optimisticRevision,status:p.status||'DRAFT',farmId:p.farmId||e.data.farmId||'',pending:true};
  }
  async function flushBefore(action,payload){
    const id=String(payload?.id||payload?.submissionId||'');
    if(!id)return;
    const e=entries.get(id);if(!e)return;
    if(e.pending||e.saving)await flushDraft(e);
    if(e.error)throw e.error;
    if(Number.isInteger(e.serverRevision)&&(action==='saveSubmission'||action==='review'))payload.baseRevision=e.serverRevision;
  }
  async function serverSubmission(id){
    id=String(id||'');if(!id)return null;
    if(prefetching.has(id))return prefetching.get(id);
    const task=(async()=>{
      try{const data=await upstreamRpc('getSubmission',{id});return captureSubmission(data);}
      catch(error){return null;}
      finally{prefetching.delete(id);}
    })();
    prefetching.set(id,task);return task;
  }
  async function prefetchSubmissions(ids,generation){
    let cursor=0;
    async function worker(){
      while(generation===prefetchGeneration&&cursor<ids.length){
        const id=ids[cursor++],e=entries.get(id);
        if(e?.data||e?.pending||e?.saving)continue;
        await serverSubmission(id);
        await new Promise(resolve=>setTimeout(resolve,80));
      }
    }
    await Promise.all([worker(),worker()]);
  }
  function markMediaDeleted(id){
    entries.forEach(e=>{if(!Array.isArray(e.data?.media))return;const m=e.data.media.find(x=>String(x?.upload_id||'')===String(id));if(m)m.status='DELETED';});
  }
  function queueMediaDelete(payload){
    const id=String(payload?.id||'');markMediaDeleted(id);outstandingWrites++;
    upstreamRpc('deleteMedia',clone(payload)).catch(error=>showBackgroundError('사진 삭제를 저장하지 못했습니다. 새로고침 후 다시 확인해 주세요. '+(error.message||error))).finally(()=>{outstandingWrites--;});
    return {id,deleted:true,pending:true};
  }

  window.addEventListener('beforeunload',event=>{
    if(!outstandingWrites&&!Array.from(entries.values()).some(e=>e.pending||e.saving))return;
    event.preventDefault();event.returnValue='';
  });

  window.fetch=async function(input,init){
    const meta=parseRpc(input,init);
    if(!meta)return upstreamFetch(input,init);
    const action=meta.action,payload=meta.payload||{},started=performance.now();

    // Drafts are write-behind. The durable Apps Script write starts immediately,
    // but navigation and editing are no longer blocked on that round trip.
    if(action==='saveSubmission'&&String(payload.status||'DRAFT')==='DRAFT'){
      const data=queueDraft(payload);notePerf(action,started,'write-behind');return synthetic({data});
    }

    // Reopening a farm that has already been read/prefetched is memory-only.
    if(action==='getSubmission'){
      const e=entries.get(String(payload.id||''));
      if(e?.data){notePerf(action,started,'memory-cache');return synthetic({data:clone(e.data)});}
      const prefetched=prefetching.get(String(payload.id||''));
      if(prefetched){const data=await prefetched;if(data){notePerf(action,started,'prefetch-join');return synthetic({data:clone(data)});}}
    }

    // Removing a photo is optimistic in the UI. Drive trash + audit still run in
    // the background and a failed durable delete is surfaced prominently.
    if(action==='deleteMedia'){
      const data=queueMediaDelete(payload);notePerf(action,started,'write-behind');return synthetic({data});
    }

    // Actions that depend on a durable submission wait only for that dependency,
    // not ordinary farm-to-farm navigation.
    if(['upload','linkDrive','mediaUpload.begin','review'].includes(action)||(action==='saveSubmission'&&payload.status!=='DRAFT'))await flushBefore(action,payload);

    const nextInit={...init,body:JSON.stringify({action,payload})};
    const response=await upstreamFetch(input,nextInit);
    try{
      const body=await response.clone().json();
      if(response.ok&&!body?.error){
        if(action==='bootstrap')captureBootstrap(body.data);
        if(action==='getSubmission')captureSubmission(body.data);
        if(action==='saveSubmission'&&body.data){const e=entryFor(payload.id);e.serverRevision=Number(body.data.revision)||e.serverRevision;e.data=localSubmissionFromSave(e,payload,e.serverRevision||Number(payload.baseRevision)||0);}
      }
    }catch(_){ }
    notePerf(action,started,'network');
    return response;
  };
})();
