import fs from 'node:fs';
import {verifyNormalized} from '../src/source-normalizer.mjs';
import {verifyPlanningNormalized} from '../src/planning-source-normalizer.mjs';

const input=process.argv[2];if(!input)throw Error('usage: node verify-migration.mjs normalized.json');
const normalized=JSON.parse(fs.readFileSync(input,'utf8'));
const runtime=verifyNormalized(normalized),planning=verifyPlanningNormalized(normalized.planning||{});
const report={ok:runtime.ok&&planning.ok,runtime,planning};
console.log(JSON.stringify(report,null,2));if(!report.ok)process.exit(2);
