// Secure ESSAY API for Cloudflare Worker behind Cloudflare Access.
// Configure Access application for this Worker hostname; JWT verified here as defense in depth.
// Secrets: GH_TOKEN (fine-grained Contents: read/write on sleeping4439-tech/youmore).
// Variables: ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAIL, ALLOWED_ORIGIN.
// KV binding: DRAFTS. Do not expose this Worker without configuring Access.
const REPO='sleeping4439-tech/youmore';
const enc=new TextEncoder();
const json=(body,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'}});
function b64url(input){return Uint8Array.from(atob(input.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-input.length%4)%4)),c=>c.charCodeAt(0))}
async function authorized(req,env){
 const jwt=req.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.ADMIN_EMAIL)return false;
 const parts=jwt.split('.');if(parts.length!==3)return false;
 try{
  const header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  if(header.alg!=='RS256'||!header.kid)return false;
  const team=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');
  if(claims.iss!==team||!(Array.isArray(claims.aud)?claims.aud:[claims.aud]).includes(env.ACCESS_AUD)||claims.email?.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase()||claims.exp*1000<Date.now()||claims.nbf*1000>Date.now())return false;
  const keys=await fetch(team+'/cdn-cgi/access/certs',{cf:{cacheTtl:3600,cacheEverything:true}}).then(r=>r.json());
  const jwk=keys.keys.find(k=>k.kid===header.kid);if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),enc.encode(parts[0]+'.'+parts[1]));
 }catch{return false}
}
function validate(body){
 if(!body||typeof body!=='object'||typeof body.title!=='string'||!body.title.trim()||body.title.length>150||typeof body.body!=='string'||body.body.length>150000||typeof body.mv!=='string'||body.mv.length>4000000)return false;
 // Inline HTML is NOT accepted: avoid injecting scripts into published GitHub Pages.
 if(/<|>|data:/i.test(body.body)||body.mv&&!/^https:\/\//.test(body.mv))return false;
 return true;
}
async function github(env,path,method='GET',payload){
 const url='https://api.github.com/repos/'+REPO+'/contents/'+path;
 const r=await fetch(url,{method,headers:{'Authorization':'Bearer '+env.GH_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'youmore-essay-editor','Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('GitHub '+r.status+' '+JSON.stringify(data).slice(0,300));return data;
}
function toBase64(str){const bytes=enc.encode(str);let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(out)}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin')||'';
 const allowed=env.ALLOWED_ORIGIN||'https://sleeping4439-tech.github.io';
 if(req.method==='OPTIONS')return new Response(null,{status:origin===allowed?204:403,headers:{'Access-Control-Allow-Origin':origin===allowed?origin:'','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
 if(origin&&origin!==allowed)return json({error:'Forbidden origin'},403);
 if(!await authorized(req,env))return json({error:'Unauthorized'},401,origin);
 if(!env.GH_TOKEN||!env.DRAFTS)return json({error:'Backend not configured'},503,origin);
 const path=new URL(req.url).pathname;
 try{
  if(path==='/api/essay/draft'&&req.method==='GET')return json({draft:await env.DRAFTS.get('current','json')},200,origin);
  if(path==='/api/essay/draft'&&req.method==='POST'){
   if(Number(req.headers.get('Content-Length')||0)>180000)return json({error:'Too large'},413,origin);
   const raw=await req.text();if(raw.length>180000)return json({error:'Too large'},413,origin);
   const draft=JSON.parse(raw);if(!validate(draft))return json({error:'Invalid draft: use plain text/Markdown and a hosted HTTPS image URL'},400,origin);
   await env.DRAFTS.put('current',JSON.stringify({...draft,updatedAt:new Date().toISOString()}));return json({ok:true},200,origin);
  }
  if(path==='/api/essay/publish'&&req.method==='POST'){
   const draft=await env.DRAFTS.get('current','json');if(!validate(draft))return json({error:'No valid draft'},400,origin);
   const slug=crypto.randomUUID();const filename='essays/'+slug+'.json';
   const article={title:draft.title,body:draft.body,mv:draft.mv,date:new Date().toISOString().slice(0,10),slug};
   const result=await github(env,filename,'PUT',{message:'Publish ESSAY: '+draft.title.slice(0,70),content:toBase64(JSON.stringify(article,null,2))});
   return json({ok:true,slug,commit:result.commit?.sha,note:'Article data committed. Site rendering requires a separate build workflow.'},200,origin);
  }
  return json({error:'Not found'},404,origin);
 }catch(e){return json({error:String(e.message||e)},500,origin)}
}};
