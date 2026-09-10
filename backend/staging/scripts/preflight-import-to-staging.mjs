import {runImportPreflight} from '../src/import-preflight.mjs';

try{
  const result=await runImportPreflight(process.env);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  const out={
    ok:false,
    error:String(error?.message||error||'IMPORT_PREFLIGHT_FAILED'),
    projectRef:String(process.env.CODE1_STAGING_PROJECT_REF||''),
    target:String(process.env.CODE1_IMPORT_TARGET||'')
  };
  if(Array.isArray(error?.nonEmpty))out.nonEmpty=error.nonEmpty;
  console.error(JSON.stringify(out,null,2));
  process.exitCode=2;
}
