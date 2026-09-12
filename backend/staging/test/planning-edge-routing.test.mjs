import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isPlanningAction,isAdminAction} from '../src/staging-dispatch.mjs';

const edgeUrl=new URL('../../../functions/api/rpc.js',import.meta.url);

const planningActions=[
  'planning.document.current','planning.document.save','planning.feedback.add','planning.feedback.resolve',
  'planning.profit.list','planning.profit.save','planning.profit.archive'
];
const adminActions=['admin.access.list','admin.access.save'];

test('new planning actions are routed through the dedicated STAGING planning dispatcher',()=>{
  for(const action of planningActions)assert.equal(isPlanningAction(action),true,action);
});

test('access management actions remain routed through STAGING admin dispatcher',()=>{
  for(const action of adminActions)assert.equal(isAdminAction(action),true,action);
});

test('Cloudflare RPC edge allowlist admits every planning and access action used by the browser',async()=>{
  const src=await readFile(edgeUrl,'utf8');
  for(const action of [...planningActions,...adminActions])assert.match(src,new RegExp(`['"]${action.replaceAll('.','\\.')}['"]`),action);
});
