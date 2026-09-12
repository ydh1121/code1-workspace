import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve('public/assets');
const files=fs.readdirSync(root).filter(name=>name.endsWith('.js')).sort();

test('all public browser JavaScript parses before deployment',()=>{
  assert.ok(files.length>0);
  for(const name of files){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    assert.doesNotThrow(()=>new vm.Script(source,{filename:`public/assets/${name}`}),name);
  }
});
