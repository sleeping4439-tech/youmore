// Local QA only. Fake repository and test signing key never enter production.
import http from 'node:http';import worker from '../essay-publish-worker.js';import {fixture} from './essay-fixture.mjs';
const f=await fixture();global.fetch=f.network;
http.createServer(async(req,res)=>{try{const host='http://'+req.headers.host,url=new URL(req.url,host);f.env.EDITOR_ORIGIN=host;
if(url.pathname==='/mobile'){res.end('<style>body{margin:0}iframe{width:390px;height:844px;border:0}</style><iframe src="/"></iframe>');return}
if(url.pathname.startsWith('/site/')){const p=url.pathname.slice(6),data=f.files.get(p);res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.png')?'image/png':'text/plain');res.end(data||'Not found');return}
const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers(req.headers);headers.set('Cf-Access-Jwt-Assertion',await f.token());const r=await worker.fetch(new Request(host+req.url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),f.env);const out=Object.fromEntries(r.headers);delete out['content-security-policy'];res.writeHead(r.status,out);res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.writeHead(500);res.end(String(e))}}).listen(4173,'0.0.0.0');
