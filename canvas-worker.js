// Public, unmoderated shared drawing. No credentials or user identities are stored.
const WEEK=604800, MONDAY=313200; // 1970-01-05 00:00 JST
export const sheetAt=(ms=Date.now())=>Math.floor((ms/1000-MONDAY)/WEEK);
const sqlSheet='CAST((unixepoch()-313200)/604800 AS INTEGER)';
const COLORS=['#252525','#ad2334','#2f4b85'];
function reply(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':origin,'Vary':'Origin',...(status===429?{'Retry-After':'60'}:{})}})}
export async function reset(db){await db.batch([db.prepare(`DELETE FROM canvas_entries WHERE sheet < ${sqlSheet}`),db.prepare('DELETE FROM strokes')]);}
async function limitedJSON(request){
 const reader=request.body?.getReader();if(!reader)throw 400;
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32000){await reader.cancel();throw 413;}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw 400;}
}
export function validate(b){
 if(!b||typeof b!=='object'||!Number.isSafeInteger(b.sheet)||typeof b.id!=='string'||! /^[a-f0-9-]{36}$/.test(b.id)||!Array.isArray(b.strokes)||b.strokes.length<1||b.strokes.length>40)throw 400;
 let n=0;const strokes=b.strokes.map(s=>{
  if(!s||!COLORS.includes(s.color)||!Array.isArray(s.points)||!s.points.length||s.points.length>300)throw 400;
  n+=s.points.length;
  const points=s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw 400;return p.map(v=>Math.round(v*10000)/10000);});
  return {color:s.color,points};
 });if(n>1600)throw 400;return {payload:JSON.stringify(strokes),points:n};
}
export default {
 async fetch(request,env){
  const allowed=env.ALLOWED_ORIGIN||'https://sleeping4439-tech.github.io',origin=request.headers.get('Origin')||'',cors=origin===allowed?origin:'';
  if(origin&&origin!==allowed)return reply({error:'origin'},403,'');
  const url=new URL(request.url);
  if(url.pathname!=='/canvas')return reply({error:'not_found'},404,cors);
  if(request.method==='OPTIONS')return new Response(null,{status:cors?204:403,headers:{'Access-Control-Allow-Origin':cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if(!['GET','POST'].includes(request.method))return reply({error:'method'},405,cors);
  if(!env.DB||!env.READ_LIMITER||!env.WRITE_LIMITER)return reply({error:'not_configured'},503,cors);
  try{
   const limiter=request.method==='POST'?env.WRITE_LIMITER:env.READ_LIMITER;
   const {success}=await limiter.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
   if(!success)return reply({error:'rate_limit'},429,cors);
   const current=sheetAt(),nextReset=(MONDAY+(current+1)*WEEK)*1000;
   if(request.method==='GET'){
    const after=Number(url.searchParams.get('after')||0),clientSheet=Number(url.searchParams.get('sheet'));
    if(!Number.isSafeInteger(after)||after<0)return reply({error:'cursor'},400,cors);
    const cursor=clientSheet===current?after:0;
    const rows=await env.DB.prepare(`SELECT seq,id,payload FROM canvas_entries WHERE sheet=${sqlSheet} AND seq>? ORDER BY seq LIMIT 51`).bind(cursor).all();
    // A request crossing midnight must never label new-week data as old-week data.
    if(sheetAt()!==current)return reply({error:'week_changed'},409,cors);
    const entries=rows.results.slice(0,50).map(r=>({seq:r.seq,id:r.id,strokes:JSON.parse(r.payload)}));
    return reply({sheet:current,nextReset,serverTime:Date.now(),entries,more:rows.results.length>50,cursor:entries.at(-1)?.seq||cursor},200,cors);
   }
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'content_type'},415,cors);
   if(Number(request.headers.get('Content-Length'))>32000)return reply({error:'too_large'},413,cors);
   const body=await limitedJSON(request),v=validate(body);
   if(body.sheet!==sheetAt())return reply({error:'week_changed'},409,cors);
   // One atomic INSERT + trigger enforces global weekly storage/point caps, even on concurrent writes.
   await env.DB.prepare('INSERT INTO canvas_entries(sheet,id,payload,points,bytes) VALUES(?,?,?,?,?) ON CONFLICT(sheet,id) DO NOTHING').bind(body.sheet,body.id,v.payload,v.points,v.payload.length).run();
   const saved=await env.DB.prepare('SELECT payload FROM canvas_entries WHERE sheet=? AND id=?').bind(body.sheet,body.id).first();
   if(!saved||saved.payload!==v.payload)return reply({error:'id_conflict'},409,cors);
   if(sheetAt()!==body.sheet)return reply({error:'week_changed'},409,cors);
   return reply({ok:true,sheet:body.sheet,id:body.id},200,cors);
  }catch(e){
   if(e===400||e===413)return reply({error:e===413?'too_large':'invalid_input'},e,cors);
   if(String(e).includes('canvas_capacity'))return reply({error:'capacity'},507,cors);
   if(String(e).includes('canvas_week'))return reply({error:'week_changed'},409,cors);
   return reply({error:'temporarily_unavailable'},503,cors);
  }
 },
 async scheduled(_event,env){await reset(env.DB);}
};
