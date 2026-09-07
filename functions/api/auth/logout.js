import {sameOrigin,cookie,failure} from '../../_shared/security.js';
export async function onRequestPost({request,env}) {try{sameOrigin(request,env);return new Response('{}',{headers:{'Set-Cookie':cookie('__Host-code1','',0),'Content-Type':'application/json','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
