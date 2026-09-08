import {build} from 'esbuild';
import {readFile,access,readdir} from 'node:fs/promises';
await build({entryPoints:['scripts/pdf-entry.js'],bundle:true,format:'iife',outfile:'public/assets/pdf.bundle.js',minify:true,target:'es2022'});
for(const path of ['public/index.html','public/assets/app.js','public/assets/accounts.js','public/assets/farm-model.js','public/assets/question-help.js','public/assets/media-ux.js','public/assets/media-ux.css','public/assets/media-lifecycle.js','public/assets/core.js','public/assets/RequestFont.ttf','functions/api/rpc.js','functions/api/accounts.js','functions/api/auth/password.js','bridge/CloudflareBridge.gs','bridge/AccessControl.gs','bridge/QuestionPolicy.gs','bridge/MediaOrganizer.gs','bridge/MediaLifecycle.gs'])await access(path);
const html=await readFile('public/index.html','utf8');if(/<\?!=|CODE1_DEMO_DATA/.test(html))throw Error('Unresolved template or demo data');
for(const name of await readdir('public/assets'))if(/seed|farm-master|service.account|private.key/i.test(name))throw Error('Private source must not be public');
console.log('Cloudflare Pages build ready: public/ + functions/. Private content stays in existing Google storage.');
