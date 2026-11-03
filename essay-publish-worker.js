import {verifyJWT} from './essay-auth.js';
import {EDITOR_HTML,EDITOR_JS,ARTICLE_TEMPLATE} from './essay-admin-assets.js';
const REPO='sleeping4439-tech/youmore', SITE='https://sleeping4439-tech.github.io/youmore/';
const enc=new TextEncoder();
const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://sleeping4439-tech.github.io; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...security,'Content-Type':'application/json; charset=utf-8'}});
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validId=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
const imagePath=s=>typeof s==='string'&&/^assets\/essays\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(s);
const imageURL=s=>typeof s==='string'&&(imagePath(s)||/^assets\/editorial\/[\w.-]+\.(png|jpg|jpeg|webp)$/.test(s));
function inline(nodes,depth=0){
 if(!Array.isArray(nodes)||nodes.length>2000||depth>8)throw Error('本文の構造が複雑すぎます');
 return nodes.map(n=>{
  if(n.type==='text'&&typeof n.text==='string'&&n.text.length<=20000)return escapeHTML(n.text);
  if(n.type==='br')return '<br>';
  if(['strong','em'].includes(n.type))return `<${n.type}>${inline(n.children,depth+1)}</${n.type}>`;
  if(n.type==='link'&&typeof n.href==='string'&&/^https:\/\//.test(n.href)&&n.href.length<2000)return `<a href="${escapeHTML(n.href)}" rel="noopener noreferrer">${inline(n.children,depth+1)}</a>`;
  throw Error('本文に未対応の形式があります');
 }).join('');
}
export function bodyToHTML(blocks){
 if(!Array.isArray(blocks)||!blocks.length||blocks.length>200)throw Error('本文を入力してください（200ブロックまで）');
 return blocks.map(b=>{
  if(['p','h2','blockquote'].includes(b.type))return `<${b.type}>${inline(b.children)}</${b.type}>`;
  if(['ul','ol'].includes(b.type)&&Array.isArray(b.items)&&b.items.length<=100)return `<${b.type}>${b.items.map(i=>'<li>'+inline(i)+'</li>').join('')}</${b.type}>`;
  if(b.type==='image'&&imageURL(b.url))return `<figure><img src="${escapeHTML(b.url)}" alt="${escapeHTML(b.alt||'')}" loading="lazy"></figure>`;
  throw Error('本文の画像または形式を確認してください');
 }).join('\n');
}
export function articleHTML(title,body,mv,date){
 let html=ARTICLE_TEMPLATE.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHTML(title)+' | ゆうもれ</title>');
 html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="'+escapeHTML(title)+'">');
 html=html.replace(/<img class="article-mv"[^>]*>/,mv?'<img class="article-mv" src="'+escapeHTML(mv)+'" alt="">':'');
 html=html.replace(/<h1>[\s\S]*?<\/h1>/,'<h1>'+escapeHTML(title)+'</h1>').replace(/<div class="meta">[\s\S]*?<\/div>/,'<div class="meta">'+date+'</div>');
 html=html.replace(/<article>[\s\S]*?<\/article>/,'<article>'+body+'</article>');
 return html.replace('</style>','article img{display:block;max-width:100%;height:auto}article figure{margin:2em 0}article h2{font-size:1.4em}article a{overflow-wrap:anywhere}</style>');
}
export function prependCard(html,cls,card){
 const re=new RegExp('(<div class="'+cls+'"[^>]*>)');
 if(!re.test(html))throw Error('一覧の構造が変わっています。公開を中止しました');
 return html.replace(re,(_,open)=>open+card);
}
function card(path,title,mv,date,home){
 const img=escapeHTML(mv||'assets/editorial/01_essay_leaves.png'),name=escapeHTML(title);
 return home?`<a class="essay-thumb-card" href="${path}"><span class="essay-thumb-image"><img src="${img}" alt="" loading="lazy"></span><span class="essay-thumb-title"><span class="essay-thumb-dot" aria-hidden="true"></span>${name}</span><span class="essay-thumb-caption">${date}</span></a>`:`<a class="essay-card" href="${path}"><span class="essay-card-image"><img src="${img}" alt="" loading="lazy"></span><span class="essay-card-title">${name}</span><span class="essay-card-meta">${date}</span></a>`;
}
export async function boundedJSON(req,max){
 const reader=req.body?.getReader();if(!reader)throw Error('本文がありません');let total=0,chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw Error('送信容量が大きすぎます')}chunks.push(value)}
 const out=new Uint8Array(total);let i=0;for(const c of chunks){out.set(c,i);i+=c.length}return JSON.parse(new TextDecoder().decode(out));
}
export async function validateImage(data){
 const m=typeof data==='string'&&data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m)throw Error('JPEG・PNG・WebPを選んでください');
 const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));if(bytes.length<12||bytes.length>4*1024*1024)throw Error('画像は4MB以下にしてください');
 const ok=m[1]==='png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):m[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!ok)throw Error('画像形式を確認してください');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return {path:`assets/essays/${hash}.${m[1]==='jpeg'?'jpg':m[1]}`,base64:m[2]};
}
async function gh(env,path,method='GET',body){
 const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'youmore-editor','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const e=Error('GitHubへの接続に失敗しました（'+r.status+'）');e.status=r.status;throw e}return r.json();
}
async function read(env,path,ref){const d=await gh(env,'/contents/'+path+'?ref='+ref);return new TextDecoder().decode(Uint8Array.from(atob(d.content.replace(/\s/g,'')),c=>c.charCodeAt(0)))}
export async function publish(env,data){
 if(!validId(data.id)||typeof data.title!=='string'||!data.title.trim()||data.title.length>120)throw Error('タイトルは1〜120文字にしてください');
 if(data.mv&&!imageURL(data.mv))throw Error('メイン画像を確認してください');
 const body=bodyToHTML(data.blocks),title=data.title.trim(),mv=data.mv||'',path='essay-'+data.id+'.html';
 const assets=data.assets||[];if(!Array.isArray(assets)||assets.length>20||!assets.every(a=>imagePath(a.path)&&/^[a-f0-9]{40}$/.test(a.sha)))throw Error('画像情報が不正です');
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const html=articleHTML(title,body,mv,date);
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify({title,blocks:data.blocks,mv}))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 for(let attempt=0;attempt<3;attempt++){
  const ref=await gh(env,'/git/ref/heads/main'),head=ref.object.sha;
  try{const old=JSON.parse(await read(env,'content/essays/'+data.id+'.json',head));if(old.digest!==digest)throw Error('この公開済み原稿は内容が変わっています。新規原稿として作成してください');return {ok:true,url:SITE+path,path,duplicate:true}}catch(e){if(e.status!==404)throw e}
  const [blog,home,commit]=await Promise.all([read(env,'blog.html',head),read(env,'index.html',head),gh(env,'/git/commits/'+head)]);
  // All files become visible together, only after the fast-forward branch update succeeds.
  const files=[{path,content:html},{path:'blog.html',content:prependCard(blog,'essay-card-grid',card(path,title,mv,date,false))},{path:'index.html',content:prependCard(home,'essay-thumb-strip',card(path,title,mv,date,true))},{path:'content/essays/'+data.id+'.json',content:JSON.stringify({id:data.id,title,blocks:data.blocks,mv,date,digest})}];
  const tree=await gh(env,'/git/trees','POST',{base_tree:commit.tree.sha,tree:[...files.map(f=>({...f,mode:'100644',type:'blob'})),...assets.map(a=>({...a,mode:'100644',type:'blob'}))]});
  const next=await gh(env,'/git/commits','POST',{message:'Publish ESSAY: '+title,tree:tree.sha,parents:[head]});
  try{await gh(env,'/git/refs/heads/main','PATCH',{sha:next.sha,force:false});return {ok:true,path,url:SITE+path,commit:next.sha}}catch(e){if(![409,422].includes(e.status)||attempt===2)throw e}
 }
}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(!env.ACCESS_TEAM_DOMAIN||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)||!env.ACCESS_AUD||!env.OWNER_EMAIL||!env.GITHUB_TOKEN||!env.EDITOR_ORIGIN||!env.ADMIN_LIMITER)return json({error:'管理者認証の設定待ちです'},503);
 let ok=false;try{ok=await verifyJWT(req.headers.get('Cf-Access-Jwt-Assertion'),env)}catch{}
 if(!ok)return json({error:'本人認証が必要です'},401);
 if(url.origin!==env.EDITOR_ORIGIN)return json({error:'Origin denied'},403);
 if(req.method==='GET'){
  if(url.pathname==='/api/session')return json({ok:true});
  if(['/', '/essay-editor.html','/essay-editor.js'].includes(url.pathname))return new Response(url.pathname==='/essay-editor.js'?EDITOR_JS:EDITOR_HTML,{headers:{...security,'Content-Type':url.pathname==='/essay-editor.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8'}});
  return json({error:'Not found'},404);
 }
 if(req.method!=='POST'||!['/upload','/publish'].includes(url.pathname))return json({error:'Not found'},404);
 if(req.headers.get('Origin')!==env.EDITOR_ORIGIN||req.headers.get('X-Youmore-Editor')!=='1')return json({error:'Origin denied'},403);
 if(req.headers.get('Content-Type')?.split(';')[0]!=='application/json')return json({error:'JSON required'},415);
 if(!(await env.ADMIN_LIMITER.limit({key:env.OWNER_EMAIL})).success)return json({error:'少し待ってから再度お試しください'},429);
 try{
  const data=await boundedJSON(req,url.pathname==='/upload'?5700000:500000);
  if(url.pathname==='/upload'){const img=await validateImage(data.data);const blob=await gh(env,'/git/blobs','POST',{content:img.base64,encoding:'base64'});return json({ok:true,path:img.path,sha:blob.sha})}
  return json(await publish(env,data));
 }catch(e){return json({error:e.status?'公開処理を完了できませんでした。原稿を保ったまま再試行してください':e.message},e.status?502:400)}
}};
