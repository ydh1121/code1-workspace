#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) throw new Error('AUDIT_JSON_PATH_REQUIRED');
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
const prod = new Set(Object.keys(pkg.dependencies || {}));
const dev = new Set(Object.keys(pkg.devDependencies || {}));
const vulns = raw && raw.vulnerabilities && typeof raw.vulnerabilities === 'object'
  ? Object.entries(raw.vulnerabilities)
  : [];

function directKind(name, entry) {
  if (prod.has(name)) return 'direct-prod';
  if (dev.has(name)) return 'direct-dev';
  if (entry?.isDirect) return 'direct-other';
  return 'transitive';
}

function viaSummary(via) {
  if (!Array.isArray(via)) return [];
  return via.map(item => {
    if (typeof item === 'string') return `package:${item}`;
    if (!item || typeof item !== 'object') return 'unknown';
    const source = item.source ?? 'n/a';
    const title = String(item.title || '').replace(/\s+/g, ' ').trim();
    const url = String(item.url || '').trim();
    const range = String(item.range || '').trim();
    return `advisory:${source}|${title}|range=${range}|url=${url}`;
  });
}

const counts = raw?.metadata?.vulnerabilities || {};
console.log('CODE1 NPM AUDIT READ-ONLY REPORT');
console.log(`AUDIT_COUNTS info=${counts.info ?? 0} low=${counts.low ?? 0} moderate=${counts.moderate ?? 0} high=${counts.high ?? 0} critical=${counts.critical ?? 0} total=${counts.total ?? vulns.length}`);
console.log(`DIRECT_DEPENDENCIES prod=${prod.size} dev=${dev.size}`);

const severityRank = {critical: 5, high: 4, moderate: 3, low: 2, info: 1};
vulns.sort((a, b) => (severityRank[b[1]?.severity] || 0) - (severityRank[a[1]?.severity] || 0) || a[0].localeCompare(b[0]));
for (const [name, entry] of vulns) {
  const kind = directKind(name, entry);
  const fix = entry?.fixAvailable === false ? 'none' : JSON.stringify(entry?.fixAvailable ?? null);
  const nodes = Array.isArray(entry?.nodes) ? entry.nodes.length : 0;
  console.log(`AUDIT_ITEM name=${name} severity=${entry?.severity || 'unknown'} kind=${kind} range=${String(entry?.range || '')} nodes=${nodes} fixAvailable=${fix}`);
  for (const via of viaSummary(entry?.via)) console.log(`AUDIT_VIA name=${name} ${via}`);
}

console.log('NPM_AUDIT_REMOTE_MUTATION=NONE');
console.log('NPM_AUDIT_FIX_APPLIED=NONE');
