import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function database(){const db=new DatabaseSync(':memory:');let time=null;db.function('unixepoch',()=>Math.floor((time??Date.now())/1000));db.exec(readFileSync(new URL('../canvas-schema.sql',import.meta.url),'utf8'));
 const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),run:async()=>({meta:db.prepare(sql).run(...args)}),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)})});
 return {prepare:wrap,batch:async stmts=>{db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},db,setTime:t=>{time=t;}};
}
