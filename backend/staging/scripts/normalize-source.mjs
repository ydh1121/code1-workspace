import fs from 'node:fs';
import {normalizeSource,verifyNormalized} from '../src/source-normalizer.mjs';
import {normalizePlanningSource,verifyPlanningNormalized} from '../src/planning-source-normalizer.mjs';

const input=process.argv[2],output=process.argv[3]||'normalized.json';
if(!input)throw Error('usage: node normalize-source.mjs source.json [normalized.json]');
const source=JSON.parse(fs.readFileSync(input,'utf8'));
const normalized=normalizeSource(source);
normalized.planning=normalizePlanningSource(source);
const runtime=verifyNormalized(normalized),planning=verifyPlanningNormalized(normalized.planning);
const report={ok:runtime.ok&&planning.ok,runtime,planning};
if(!report.ok){console.error(JSON.stringify(report,null,2));process.exit(2);}
fs.writeFileSync(output,JSON.stringify(normalized,null,2));
console.log(JSON.stringify(report,null,2));
