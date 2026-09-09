import fs from 'node:fs';
import {verifyNormalized} from '../src/source-normalizer.mjs';
const input=process.argv[2];if(!input)throw Error('usage: node verify-migration.mjs normalized.json');
const report=verifyNormalized(JSON.parse(fs.readFileSync(input,'utf8')));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exit(2);
