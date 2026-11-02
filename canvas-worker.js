// Cloudflare Worker + D1. Bind DB to a D1 database and set ALLOWED_ORIGIN.
// Run the SQL in canvas-schema.sql before deployment.
const JST=9*60*60*1000;
function week(now=Date.now()){const d=new Date(now+JST),day=(d.getUTCDay()+6)%7;return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day)-JST).toISOString().slice(0,10)}
function reply(data,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'}})}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://sleeping4439-tech.github.io';
  const cors=origin===allowed?origin:'';
  if(request.method==='OPTIONS')return new Response(null,{status:cors?204:403,headers:{'Access-Control-Allow-Origin':cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if(origin&&!cors)return reply({error:'Origin not allowed'},403);
  const url=new URL(request.url);
  if(url.pathname!=='/canvas')return reply({error:'Not found'},404,cors);
  if(!env.DB)return reply({error:'Database not configured'},503,cors);
  const current=week();
  if(request.method==='GET'){
   const result=await env.DB.prepare('SELECT id, color, points FROM strokes WHERE sheet=? ORDER BY id ASC LIMIT 12000').bind(current).all();
   return reply({sheet:current,strokes:result.results.map(s=>({id:s.id,color:s.color,points:JSON.parse(s.points)}))},200,cors);
  }
  if(request.method!=='POST')return reply({error:'Method not allowed'},405,cors);
  if(Number(request.headers.get('Content-Length')||0)>25000)return reply({error:'Too large'},413,cors);
  let raw;try{raw=await request.text()}catch{return reply({error:'Invalid body'},400,cors)}
  if(raw.length>25000)return reply({error:'Too large'},413,cors);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400,cors)}
  if(body.sheet!==current)return reply({error:'The sheet has changed',sheet:current},409,cors);
  if(!Array.isArray(body.strokes)||body.strokes.length<1||body.strokes.length>40)return reply({error:'Invalid strokes'},400,cors);
  let pointsTotal=0;
  for(const s of body.strokes){
   if(!['#252525','#ad2334','#2f4b85'].includes(s.color)||!Array.isArray(s.points)||s.points.length<1||s.points.length>300)return reply({error:'Invalid stroke'},400,cors);
   pointsTotal+=s.points.length;
   if(!s.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)))return reply({error:'Invalid point'},400,cors);
  }
  if(pointsTotal>2000)return reply({error:'Too many points'},400,cors);
  // Rate limit is enforced at the edge using Cloudflare WAF rate limiting (see README).
  // D1 writes use bound parameters; no user-controlled SQL or executable markup.
  const statements=body.strokes.map(s=>env.DB.prepare('INSERT INTO strokes(sheet,color,points) VALUES(?,?,?)').bind(current,s.color,JSON.stringify(s.points)));
  await env.DB.batch(statements);
  return reply({ok:true,sheet:current},200,cors);
 },
 async scheduled(event,env){
  const current=week();
  await env.DB.prepare('DELETE FROM strokes WHERE sheet<>?').bind(current).run();
 }
};