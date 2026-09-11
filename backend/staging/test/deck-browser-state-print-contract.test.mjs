import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,'../../../public/assets/print-controls.js'),'utf8');

test('Deck browser state persists page and slide across authenticated refresh',()=>{
  assert.match(source,/VIEW_STATE_KEY='code1\.workspace\.view\.v1'/);
  assert.match(source,/sessionStorage\.setItem\(VIEW_STATE_KEY/);
  assert.match(source,/window\.addEventListener\('code1-ready'/);
  assert.match(source,/page:'deck',deckSlide:slide/);
  assert.match(source,/restoreDeckSlide\(Number\(state\.deckSlide\)\|\|0\)/);
});

test('Deck print path prewarms cloned output and explains browser header footer control',()=>{
  assert.match(source,/schedulePrintCache\(\)/);
  assert.match(source,/if\(printCacheDirty\|\|!printDeck\.querySelector\('\.print-page'\)\)buildPrintDeck\(\)/);
  assert.match(source,/머리글과 바닥글/);
  assert.match(source,/브라우저 기본 머리글\/바닥글/);
});
