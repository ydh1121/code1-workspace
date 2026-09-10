import {readFileSync} from 'node:fs';

const path=process.argv[2];
if(!path)throw Error('ROOT_TEST_LOG_REQUIRED');
const text=readFileSync(path,'utf8');
const allowed=new Set([
  'deck edit text uses side panel, undo/redo restores content, ordinary save has no prompt',
  'organizer uses human-readable farm, shot and label naming instead of legacy upload-id prefix',
  'media upload UX replaces long select with grouped searchable shot cards',
  'media shot search finds items across categories and keeps native select synchronized',
  'test/migration.test.mjs'
]);
const failures=[...text.matchAll(/^not ok\s+\d+\s+-\s+(.+)$/gm)].map(m=>m[1].trim());
const unexpected=failures.filter(name=>!allowed.has(name));
const exitCode=Number(process.env.ROOT_TEST_EXIT||0);

if(unexpected.length){
  console.error('Unexpected root regression failures:');
  unexpected.forEach(name=>console.error(`- ${name}`));
  process.exit(1);
}
if(exitCode!==0&&!failures.length){
  console.error(`Root regression command exited ${exitCode} without parseable TAP failures.`);
  process.exit(1);
}
if(failures.length){
  console.log(`Known pre-existing root baseline failures only: ${failures.length}`);
  failures.forEach(name=>console.log(`- ${name}`));
}else{
  console.log('Root regression suite passed with no failures.');
}
