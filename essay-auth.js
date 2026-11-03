const encoder=new TextEncoder();
function b64url(input){const padded=input.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(padded+'='.repeat((4-padded.length%4)%4)),c=>c.charCodeAt(0))}
export async function verifyJWT(token,env){
 if(!token||token.length>12000)return false;
 const parts=token.split('.');if(parts.length!==3)return false;
 let header,payload;try{header=JSON.parse(new TextDecoder().decode(b64url(parts[0])));payload=JSON.parse(new TextDecoder().decode(b64url(parts[1])))}catch{return false}
 if(header.alg!=='RS256'||!header.kid||payload.iss!==env.ACCESS_TEAM_DOMAIN||payload.aud!==env.ACCESS_AUD&&!(Array.isArray(payload.aud)&&payload.aud.includes(env.ACCESS_AUD))||payload.email?.toLowerCase()!==env.OWNER_EMAIL?.toLowerCase()||typeof payload.exp!=='number'||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000||(payload.nbf!==undefined&&(typeof payload.nbf!=='number'||payload.nbf>Date.now()/1000)))return false;
 const certs=await fetch(env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'')+'/cdn-cgi/access/certs',{cf:{cacheTtl:300}});if(!certs.ok)return false;
 const jwks=await certs.json();const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)return false;
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
}
