import { failure } from '../../_shared/security.js';
import { handleAuthorizedMediaPut } from '../../../backend/staging/src/media-put.mjs';
import { useSupabaseStaging } from '../../../backend/staging/src/runtime-mode.mjs';

export async function onRequest({request,env}){
  try{
    if(!useSupabaseStaging(env))return new Response('NOT_FOUND',{status:404});
    return await handleAuthorizedMediaPut(request,env);
  }catch(e){return failure(e);}
}
