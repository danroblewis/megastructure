// report.js — error and state reporting for remote debugging. Posts to /log on the same origin (the dev server in
// tools/devserver.py). Captures uncaught errors with stacks, unhandled rejections, console.error/warn, audio panics,
// and a short state snapshot with each report. Does nothing when opened from a file:// URL.
(function(){
  if(!/^https?:/.test(location.protocol)) return;
  const q=[]; let sending=false; const sid=Math.random().toString(36).slice(2,8);
  function flush(){ if(sending||!q.length) return; sending=true; const batch=q.splice(0,20);
    fetch('log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch),keepalive:true}).catch(()=>{ q.unshift(...batch); }).finally(()=>{ sending=false; if(q.length) setTimeout(flush,500); }); }
  function snap(){ try{ const S=window.__state&&window.__state(); return S||{}; }catch(e){ return {snapErr:String(e)}; } }
  function report(type,msg,stack,extra){ q.push({sid,t:Date.now(),type,msg:String(msg).slice(0,2000),stack:stack?String(stack).slice(0,4000):undefined,extra,state:snap(),url:location.href.slice(0,300),ua:navigator.userAgent}); if(q.length>200) q.splice(0,q.length-200); setTimeout(flush,50); }
  window.REPORT=report;
  window.addEventListener('error',e=>{ report('error',e.message,e.error&&e.error.stack,{file:e.filename,line:e.lineno,col:e.colno}); },true);
  window.addEventListener('unhandledrejection',e=>{ const r=e.reason; report('rejection',r&&r.message||r,r&&r.stack); });
  for(const level of ['error','warn']){ const orig=console[level].bind(console); console[level]=(...a)=>{ orig(...a); try{ const err=a.find(x=>x instanceof Error); report('console.'+level,a.map(x=>x instanceof Error?x.message:typeof x==='object'?JSON.stringify(x).slice(0,500):String(x)).join(' '),err&&err.stack); }catch(e){} }; }
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) flush(); });
  window.addEventListener('pagehide',flush);
  report('open','page opened',null,{w:innerWidth,h:innerHeight,dpr:devicePixelRatio});
})();
