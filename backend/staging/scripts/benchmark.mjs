import {performance} from 'node:perf_hooks';
import {percentile} from '../src/core.mjs';
const base=(process.env.CODE1_BENCH_BASE_URL||'').replace(/\/$/,'');
const cookie=process.env.CODE1_BENCH_COOKIE||'';
const runs=Math.max(3,Math.min(100,Number(process.env.CODE1_BENCH_RUNS||10)));
if(!base||!cookie)throw Error('CODE1_BENCH_BASE_URL and CODE1_BENCH_COOKIE are required. Never commit cookie values.');
const cases=JSON.parse(process.env.CODE1_BENCH_CASES||'[]');
if(!Array.isArray(cases)||!cases.length)throw Error('CODE1_BENCH_CASES JSON array is required');
for(const c of cases){const samples=[];for(let i=0;i<runs;i++){const t=performance.now();const r=await fetch(base+c.path,{method:c.method||'POST',headers:{'Content-Type':'application/json','Cookie':cookie,...(c.headers||{})},body:c.body===undefined?undefined:JSON.stringify(c.body)});await r.arrayBuffer();const elapsed=performance.now()-t;if(!r.ok)throw Error(`${c.name} HTTP ${r.status}`);samples.push(elapsed);}console.log(JSON.stringify({name:c.name,runs,p50_ms:Math.round(percentile(samples,.5)*10)/10,p95_ms:Math.round(percentile(samples,.95)*10)/10,min_ms:Math.round(Math.min(...samples)*10)/10,max_ms:Math.round(Math.max(...samples)*10)/10}));}
