import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const script=fs.readFileSync(path.resolve(here,'../../../scripts/CODE1_DECK_PHASEC_R2_COPY.ps1'),'utf8');

test('Deck R2 operator captures Windows PowerShell native stderr for allowed negative probes',()=>{
  assert.match(script,/\$previousErrorActionPreference\s*=\s*\$ErrorActionPreference/);
  assert.match(script,/\$ErrorActionPreference\s*=\s*'Continue'/);
  assert.match(script,/\$raw\s*=\s*@\(& \$Wrangler @Arguments 2>&1\)/);
  assert.match(script,/\$_ -is \[System\.Management\.Automation\.ErrorRecord\]/);
});

test('Deck R2 operator recognizes Cloudflare missing-key response without treating other failures as absence',()=>{
  assert.match(script,/specified key does not exist/);
  assert.match(script,/R2 preflight read failed/);
  assert.match(script,/R2_OBJECT_CONFLICT/);
});

test('Deck R2 operator rejects stale repo-local Wrangler before any object write',()=>{
  assert.match(script,/ExpectedWranglerMinimum\s*=\s*\[version\]'4\.131\.1'/);
  assert.match(script,/actualWranglerVersion -lt \$ExpectedWranglerMinimum/);
  assert.match(script,/run npm ci in \$RepoRoot and retry/);
});
