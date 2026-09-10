import {build} from 'esbuild';
import {readFile,access,readdir,writeFile} from 'node:fs/promises';

// Keep the heavy jsPDF runtime out of the initial workspace boot. index.html
// continues to load pdf.bundle.js, but that file is now only a tiny loader.
await build({entryPoints:['scripts/pdf-entry.js'],bundle:true,format:'iife',outfile:'public/assets/pdf.runtime.js',minify:true,target:'es2022'});
await writeFile('public/assets/pdf.bundle.js',`(()=>{'use strict';let flight=null;async function runtime(){if(window.Code1Pdf&&!window.Code1Pdf.__loader)return window.Code1Pdf;if(!flight)flight=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/pdf.runtime.js';s.async=true;s.onload=()=>{const api=window.Code1Pdf;if(api&&!api.__loader)resolve(api);else reject(Error('PDF_RUNTIME_UNAVAILABLE'));};s.onerror=()=>reject(Error('PDF_RUNTIME_UNAVAILABLE'));document.head.append(s);}).catch(e=>{flight=null;throw e;});return flight;}window.Code1Pdf={__loader:true,downloadRequest:async(...args)=>(await runtime()).downloadRequest(...args),requestDocument:async(...args)=>(await runtime()).requestDocument(...args)};})();\n`,'utf8');

for(const path of [
  'public/index.html','public/assets/app.js','public/assets/accounts.js','public/assets/farm-model.js','public/assets/question-help.js','public/assets/media-ux.js','public/assets/media-ux.css','public/assets/media-lifecycle.js','public/assets/core.js','public/assets/pdf.bundle.js','public/assets/pdf.runtime.js','public/assets/RequestFont.ttf',
  'functions/api/rpc.js','functions/api/session.js','functions/api/accounts.js','functions/api/auth/password.js','functions/api/auth/callback.js','functions/api/staging/media-put.js','functions/api/staging/media-get.js',
  'backend/staging/src/runtime-mode.mjs','backend/staging/src/auth-adapter.mjs','backend/staging/src/rpc-adapter.mjs','backend/staging/src/accounts-adapter.mjs','backend/staging/src/media-put.mjs','backend/staging/src/media-read.mjs',
  'bridge/CloudflareBridge.gs','bridge/AccessControl.gs','bridge/QuestionPolicy.gs','bridge/MediaOrganizer.gs','bridge/MediaLifecycle.gs','bridge/PerformanceRead.gs'
])await access(path);
const html=await readFile('public/index.html','utf8');if(/<\?!=|CODE1_DEMO_DATA/.test(html))throw Error('Unresolved template or demo data');
for(const name of await readdir('public/assets'))if(/seed|farm-master|service.account|private.key/i.test(name))throw Error('Private source must not be public');
console.log('CODE1 workspace build ready: public/ + functions/. Runtime backend remains environment-selected and private source data is never bundled.');
