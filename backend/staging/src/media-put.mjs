import {verifyUploadAuthorization} from './upload-auth.mjs';

export async function handleAuthorizedMediaPut(request, env) {
  if(request.method!=='PUT')return new Response('METHOD_NOT_ALLOWED',{status:405});
  if(!env.CODE1_MEDIA_BUCKET)return new Response('R2_BINDING_REQUIRED',{status:503});
  const token=new URL(request.url).searchParams.get('token'),claims=await verifyUploadAuthorization(env,token);
  if(!claims)return new Response('FORBIDDEN',{status:403});
  const len=Number(request.headers.get('Content-Length'));
  if(!Number.isFinite(len)||len<=0||len>claims.maxBytes||len!==claims.maxBytes)return new Response('INVALID_CONTENT_LENGTH',{status:413});
  const supplied=(request.headers.get('Content-Type')||'application/octet-stream').toLowerCase();
  if(claims.mimeType&&claims.mimeType!=='application/octet-stream'&&supplied!==claims.mimeType.toLowerCase())return new Response('MIME_MISMATCH',{status:415});
  await env.CODE1_MEDIA_BUCKET.put(claims.objectKey,request.body,{httpMetadata:{contentType:claims.mimeType},customMetadata:{mediaId:claims.mediaId,farmId:claims.farmId,submissionId:claims.submissionId}});
  return new Response(JSON.stringify({ok:true,mediaId:claims.mediaId}),{status:201,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
