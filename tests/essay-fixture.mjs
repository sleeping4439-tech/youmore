import {readFileSync} from 'node:fs';
export async function fixture(){
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
 const b64=s=>Buffer.from(s).toString('base64url');
 async function token(extra={}){const base=b64(JSON.stringify({alg:'RS256',kid:jwk.kid}))+'.'+b64(JSON.stringify({iss:'https://test.cloudflareaccess.com',aud:['test-aud'],email:'owner@example.com',exp:Date.now()/1000+600,...extra}));return base+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(base))).toString('base64url')}
 let head='head0',seq=0;const files=new Map(['blog.html','index.html'].map(p=>[p,readFileSync(p,'utf8')]));const blobs=new Map(),trees=new Map(),commits=new Map();
 const response=(j,status=200)=>new Response(JSON.stringify(j),{status});
 async function network(url,init={}){
  if(String(url).endsWith('/cdn-cgi/access/certs'))return response({keys:[jwk]});
  const u=new URL(url),path=u.pathname.replace('/repos/sleeping4439-tech/youmore',''),body=init.body?JSON.parse(init.body):null;
  if(path==='/git/ref/heads/main')return response({object:{sha:head}});
  if(path.startsWith('/git/commits/')&&!body)return response({tree:{sha:head}});
  if(path.startsWith('/contents/')){const f=files.get(path.slice(10));return f===undefined?response({},404):response({content:Buffer.from(f).toString('base64')})}
  if(path==='/git/blobs'){const sha=(++seq).toString(16).padStart(40,'0');blobs.set(sha,body.content);return response({sha})}
  if(path==='/git/trees'){const sha='tree'+(++seq);trees.set(sha,body.tree);return response({sha})}
  if(path==='/git/commits'){const sha='commit'+(++seq);commits.set(sha,body);return response({sha})}
  if(path==='/git/refs/heads/main'){const c=commits.get(body.sha);if(c.parents[0]!==head)return response({},422);for(const f of trees.get(c.tree))files.set(f.path,f.content??Buffer.from(blobs.get(f.sha),'base64'));head=body.sha;return response({object:{sha:head}})}
  throw Error('Unexpected fixture request '+path);
 }
 const env={ACCESS_TEAM_DOMAIN:'https://test.cloudflareaccess.com',ACCESS_AUD:'test-aud',OWNER_EMAIL:'owner@example.com',GITHUB_TOKEN:'fixture-only',EDITOR_ORIGIN:'https://admin.test',ADMIN_LIMITER:{limit:async()=>({success:true})}};
 return {token,network,env,files,blobs};
}
