// Private ESSAY publishing API for Cloudflare Workers.
// REQUIRED: Cloudflare Access application in front of this Worker, with an allow policy
// for the owner's email. Verify Access JWT here as defense in depth.
// Secrets: GITHUB_TOKEN (fine-grained contents write, only sleeping4439-tech/youmore)
// Variables: ACCESS_TEAM_DOMAIN (e.g. https://team.cloudflareaccess.com),
// ACCESS_AUD, OWNER_EMAIL, EDITOR_ORIGIN (the editor's exact HTTPS origin).
const repo='sleeping4439-tech/youmore';
const encoder=new TextEncoder();
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
function b64url(input){const padded=input.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(padded+'='.repeat((4-padded.length%4)%4)),c=>c.charCodeAt(0))}
async function verifyJWT(token,env){
 if(!token||token.length>12000)return false;
 const parts=token.split('.');if(parts.length!==3)return false;
 let header,payload;try{header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));payload=JSON.parse(new TextDecoder().decode(b64url(parts[1])))}catch{return false}
 if(header.alg!=='RS256'||!header.kid||payload.iss!==env.ACCESS_TEAM_DOMAIN||payload.aud!==env.ACCESS_AUD&&!(Array.isArray(payload.aud)&&payload.aud.includes(env.ACCESS_AUD))||payload.email?.toLowerCase()!==env.OWNER_EMAIL?.toLowerCase()||!payload.exp||payload.exp<=Date.now()/1000||payload.nbf>Date.now()/1000)return false;
 const certs=await fetch(env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'')+'/cdn-cgi/access/certs',{cf:{cacheTtl:300}});if(!certs.ok)return false;
 const jwks=await certs.json();const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return false;
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cleanText(s,max){return typeof s==='string'?s.slice(0,max):''}
function bodyToHTML(blocks){return blocks.map(b=>{
 const t=escapeHTML(cleanText(b.text,20000)).replace(/\n/g,'<br>');
 if(b.type==='h2')return '<h2>'+t+'</h2>';
 if(b.type==='image'&&/^https:\/\//.test(b.url||''))return '<figure><img src="'+escapeHTML(b.url)+'" alt=""></figure>';
 return '<p>'+t+'</p>';
 }).join('\n')}
function articleHTML(title,body,mv,date){return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)} | ゆうもれ</title><style>body{margin:0;background:#f0e5df;color:#191414;font-family:"Hiragino Mincho ProN","Yu Mincho",serif}header,main,footer{padding:24px clamp(22px,6vw,90px)}header{border-bottom:1px solid #cbbeb5}a{color:inherit}main{max-width:900px;margin:60px auto 100px}.mv{display:block;width:100%;aspect-ratio:1.35;object-fit:cover}h1{font-size:clamp(38px,7vw,78px);font-weight:400;line-height:1.5}article{max-width:660px;margin:80px auto;font-size:18px;line-height:2.5}article p{margin:0 0 2em}article img{max-width:100%}footer{background:#d4000d;color:#f0e5df}</style></head><body><header><a href="index.html">← ゆうもれ</a>　<a href="blog.html">ESSAY / 言</a></header><main>${mv?'<img class="mv" src="'+escapeHTML(mv)+'" alt="">':''}<h1>${escapeHTML(title)}</h1><small>${date}</small><article>${body}</article><a href="blog.html">← ESSAY一覧へ戻る</a></main><footer>ゆうもれ</footer></body></html>`}
async function gh(env,path,content){const endpoint='https://api.github.com/repos/'+repo+'/contents/'+path;const headers={'Authorization':'Bearer '+env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'youmore-editor'};const old=await fetch(endpoint,{headers});if(old.status!==404&&!old.ok)throw Error('GitHub read '+old.status);const sha=old.ok?(await old.json()).sha:undefined;const bytes=encoder.encode(content);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const res=await fetch(endpoint,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Publish essay '+path,content:btoa(binary),...(sha?{sha}:{})})});if(!res.ok)throw Error('GitHub write '+res.status);return res.json()}
async function readGitHubText(env,path){
 const url='https://api.github.com/repos/'+repo+'/contents/'+path;
 const res=await fetch(url,{headers:{'Authorization':'Bearer '+env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','User-Agent':'youmore-editor'}});
 if(!res.ok)throw Error('GitHub read '+path+' '+res.status);
 const data=await res.json();
 return new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
}
function prependCard(html,containerClass,card){
 const pattern=new RegExp('(<div class="'+containerClass+'"[^>]*>)');
 if(!pattern.test(html))throw Error('Listing container missing: '+containerClass);
 return html.replace(pattern,(_,open)=>open+card);
}
function listCard(path,title,mv,date,home){
 const href=escapeHTML(path),name=escapeHTML(title),image=escapeHTML(mv||'assets/editorial/01_essay_leaves.png');
 if(home)return '<a class="essay-thumb-card" href="'+href+'"><span class="essay-thumb-image"><img src="'+image+'" alt="" loading="lazy"></span><span class="essay-thumb-title"><span class="essay-thumb-dot" aria-hidden="true"></span>'+name+'</span><span class="essay-thumb-caption">'+date+'</span></a>';
 return '<a class="essay-card" href="'+href+'"><span class="essay-card-image"><img src="'+image+'" alt="" loading="lazy"></span><span class="essay-card-title">'+name+'</span><span class="essay-card-meta">'+date+'</span></a>\n';
}
export default {async fetch(req,env){
 const pathname=new URL(req.url).pathname;
 if(req.method!=='POST'||!['/publish','/upload'].includes(pathname))return json({error:'Not found'},404);
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.OWNER_EMAIL||!env.GITHUB_TOKEN||!env.EDITOR_ORIGIN)return json({error:'Not configured'},503);
 if(req.headers.get('Origin')!==env.EDITOR_ORIGIN)return json({error:'Origin denied'},403);
 if(req.headers.get('Content-Type')?.split(';')[0]!=='application/json')return json({error:'Invalid content type'},415);
 let verified=false;try{verified=await verifyJWT(req.headers.get('Cf-Access-Jwt-Assertion'),env)}catch{}
 if(!verified)return json({error:'Unauthorized'},401);
 const raw=await req.text();if(raw.length>(pathname==='/upload'?5_700_000:100000))return json({error:'Too large'},413);
 let data;try{data=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
 if(pathname==='/upload'){
  const match=typeof data.data==='string'&&data.data.match(/^data:image\\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)return json({error:'Invalid image'},400);
  const mime=match[1],base64=match[2],ext=mime==='jpeg'?'jpg':mime;
  if(base64.length>5_600_000||base64.length<20)return json({error:'Image too large or empty'},413);
  let bytes;try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0))}catch{return json({error:'Invalid encoding'},400)}
  if(bytes.length>4*1024*1024)return json({error:'Image too large'},413);
  const valid=mime==='png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:mime==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!valid)return json({error:'Image signature mismatch'},400);
  const path='assets/essays/'+crypto.randomUUID()+'.'+ext;
  const endpoint='https://api.github.com/repos/'+repo+'/contents/'+path;
  const headers={'Authorization':'Bearer '+env.GITHUB_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'youmore-editor','Content-Type':'application/json'};
  try{
   const res=await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify({message:'Upload essay image',content:base64})});
   if(!res.ok)throw Error('GitHub image write '+res.status);
   return json({ok:true,path,url:'https://sleeping4439-tech.github.io/youmore/'+path});
  }catch{return json({error:'Image upload failed'},502)}
 }
 const title=cleanText(data.title,120).trim();if(!title||!Array.isArray(data.blocks)||data.blocks.length>200)return json({error:'Invalid article'},400);
 if(!data.blocks.every(b=>b&&['p','h2','image'].includes(b.type)&&typeof b.text==='string'&&b.text.length<=20000&&(b.type!=='image'||(typeof b.url==='string'&&/^https:\/\//.test(b.url)&&b.url.length<2000))))return json({error:'Invalid blocks'},400);
 const mv=data.mv||'';if(mv&&!(typeof mv==='string'&&/^https:\/\//.test(mv)&&mv.length<2000))return json({error:'Upload images to repository first'},400);
 const slug='essay-'+crypto.randomUUID().slice(0,12)+'.html',date=new Date().toISOString().slice(0,10);
 try{
  // Validate both listing containers before creating the new article.
  const [blog,home]=await Promise.all([readGitHubText(env,'blog.html'),readGitHubText(env,'index.html')]);
  const nextBlog=prependCard(blog,'essay-card-grid',listCard(slug,title,mv,date,false));
  const nextHome=prependCard(home,'essay-thumb-strip',listCard(slug,title,mv,date,true));
  await gh(env,slug,articleHTML(title,bodyToHTML(data.blocks),mv,date));
  const updated=[];
  try{await gh(env,'blog.html',nextBlog);updated.push('blog.html');await gh(env,'index.html',nextHome);updated.push('index.html')}
  catch{return json({ok:false,partial:true,path:slug,updated,error:'Article created but listing update failed. Retry listing repair manually.'},502)}
  return json({ok:true,path:slug,url:'https://sleeping4439-tech.github.io/youmore/'+slug,updated});
 }catch{return json({error:'Publish failed before completion'},502)}
 }};