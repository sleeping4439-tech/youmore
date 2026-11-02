(()=>{
 'use strict';
 const canvas=document.querySelector('#sheet'),ctx=canvas.getContext('2d'),status=document.querySelector('#status'),save=document.querySelector('#save');
 const uuid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');
 const API=document.querySelector('meta[name="canvas-api"]').content;
 let color='#252525',shared=[],draft=[],active=null,pointer=null,sheet=null,cursor=0,nextReset=0,clockOffset=0,pending=null,saving=false,syncing=false,resetTimer;
 const pointCount=()=>draft.reduce((n,s)=>n+s.points.length,0)+(active?.points.length||0);
 function controls(){save.disabled=saving||sheet===null||(!draft.length&&!pending);document.querySelector('#undo').disabled=saving||!!pending||!draft.length;document.querySelector('#clear').disabled=saving||!!pending||!draft.length;}
 function stroke(s){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.strokeStyle=ctx.fillStyle=s.color;ctx.lineWidth=w/450*2.2;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();s.points.forEach((p,i)=>i?ctx.lineTo(p[0]*w,p[1]*h):ctx.moveTo(p[0]*w,p[1]*h));if(s.points.length===1){ctx.arc(s.points[0][0]*w,s.points[0][1]*h,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
 function render(){ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);shared.forEach(e=>e.strokes.forEach(stroke));draft.forEach(stroke);if(active)stroke(active);controls();}
 function size(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);render();}
 function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))].map(v=>Math.round(v*10000)/10000);}
 function end(){if(active)draft.push(active);active=null;pointer=null;render();}
 canvas.addEventListener('pointerdown',e=>{if(pointer!==null||saving||pending||sheet===null||(e.pointerType==='mouse'&&e.button!==0))return;if(draft.length>=40||pointCount()>=1600){status.textContent='いったん「残す」を押してから、続きをどうぞ。';return;}pointer=e.pointerId;canvas.setPointerCapture(pointer);active={color,points:[point(e)]};render();});
 canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!active)return;if(active.points.length>=300||pointCount()>=1600){end();status.textContent='いったん「残す」を押してから、続きをどうぞ。';return;}const p=point(e),last=active.points.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>.0015){active.points.push(p);render();}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===pointer)end();});
 document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
 document.querySelector('#undo').addEventListener('click',()=>{if(!saving&&!pending){draft.pop();render();}});
 document.querySelector('#clear').addEventListener('click',()=>{if(!saving&&!pending){draft=[];active=null;pointer=null;render();status.textContent='まだ残していない線だけを消しました。';}});
 async function request(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url,{...options,signal:controller.signal,cache:'no-store',credentials:'omit'});let data;try{data=await r.json();}catch{throw Error('通信に失敗しました。');}if(!r.ok){const e=Error(data.error||'network');e.code=r.status;throw e;}return data;}finally{clearTimeout(timer);}}
 function expire(){shared=[];draft=[];active=null;pointer=null;pending=null;sheet=null;cursor=0;render();status.textContent='新しい週の白紙に切り替えています。';sync();}
 function armReset(){clearTimeout(resetTimer);resetTimer=setTimeout(expire,Math.max(1,nextReset-(Date.now()+clockOffset)));}
 async function sync(){if(syncing||saving||!API)return;syncing=true;try{let more=true;while(more){const data=await request(`${API}?sheet=${sheet??''}&after=${cursor}`);if(sheet!==null&&sheet!==data.sheet){shared=[];draft=[];active=null;pointer=null;pending=null;cursor=0;status.textContent='新しい週の白紙になりました。';}sheet=data.sheet;nextReset=data.nextReset;clockOffset=data.serverTime-Date.now();for(const e of data.entries){if(!shared.some(x=>x.id===e.id))shared.push(e);if(pending?.id===e.id){draft=[];pending=null;status.textContent='みんなの紙に残しました。';}}cursor=data.cursor;more=data.more;render();}armReset();}catch(e){if(e.code===409){sheet=null;cursor=0;shared=[];render();}status.textContent=e.code===429?'少し時間をおいて再接続します。':'共有の紙に接続できません。書きかけはこの画面に保持しています。';}finally{syncing=false;controls();}}
 save.addEventListener('click',async()=>{if(saving||sheet===null||(!draft.length&&!pending))return;end();saving=true;pending??={id:uuid(),sheet,strokes:structuredClone(draft)};controls();status.textContent='残しています…';try{await request(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});draft=[];pending=null;status.textContent='みんなの紙に残しました。';}catch(e){if(e.code===409&&e.message==='week_changed'){expire();}else if(e.code===507){pending=null;status.textContent='今週の紙は保存容量に達しました。月曜0時に白紙になります。';}else if(e.code===429){status.textContent='保存が続いたため、1分ほど待って「残す」を押してください。';}else{status.textContent='保存を確認できません。「残す」で同じ線を重複なく再確認できます。';}}finally{saving=false;render();await sync();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(nextReset&&Date.now()+clockOffset>=nextReset)expire();else sync();}});
 setInterval(()=>{if(!document.hidden)sync();},10000);
 window.addEventListener('beforeunload',e=>{if(draft.length||pending){e.preventDefault();e.returnValue='';}});
 new ResizeObserver(size).observe(canvas);size();
 if(API)sync();else status.textContent='共有機能の接続準備中です。';
})();
