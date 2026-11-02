// v2/main.js — game loop, player, entities, input, camera, HUD, audio
'use strict';
(function(){
  const HASH=Object.fromEntries(location.hash.slice(1).split('&').filter(Boolean).map(kv=>kv.split('=')));
  const canvas=document.getElementById('c'), hud=document.getElementById('hud'), hctx=hud.getContext('2d');
  const isTouch=('ontouchstart' in window);
  const small=Math.min(window.innerWidth,window.innerHeight)<700||isTouch;
  const W=+HASH.w||(small?1024:2048), H=+HASH.h||(small?512:1024);
  const world=GEN.build(W,H,+HASH.seed||7);
  try{ SIM.init(canvas,W,H,world.mask,world.src); }catch(e){ document.body.innerHTML='<p style="color:#fff;font:16px sans-serif;padding:20px">This needs WebGL2 with float textures: '+e.message+'</p>'; throw e; }
  const PARAMS={tau:0.58,buoy:0.0022,ign:0.45,burnP:0.012,adv:1.4,burnRate:0.06,cool:0.004,lifeF:0.9,lifeK:0.06,diff:0.08};
  let zoom=small?2.0:2.5, sw=0,sh=0,dpr=1;
  function resize(){ dpr=Math.min(small?1.5:2,window.devicePixelRatio||1); sw=Math.floor(window.innerWidth*dpr); sh=Math.floor(window.innerHeight*dpr); canvas.width=sw; canvas.height=sh; hud.width=sw; hud.height=sh; zoom=(small?2.0:2.5)*dpr; }
  window.addEventListener('resize',resize); resize();

  // ---------- audio ----------
  const AUDIO={ctx:null,muted:false,init(){ if(this.ctx) return; try{ const C=window.AudioContext||window.webkitAudioContext; this.ctx=new C(); const sr=this.ctx.sampleRate; const buf=this.ctx.createBuffer(1,sr*2,sr); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; this.nb=buf;
      this.master=this.ctx.createGain(); this.master.gain.value=0.35; this.master.connect(this.ctx.destination); this.out=this.master;
      const mk=(f,q,type)=>{ const s=this.ctx.createBufferSource(); s.buffer=buf; s.loop=true; const fl=this.ctx.createBiquadFilter(); fl.type=type||'bandpass'; fl.frequency.value=f; fl.Q.value=q; const g=this.ctx.createGain(); g.gain.value=0; s.connect(fl); fl.connect(g); g.connect(this.out); s.start(); return {g,fl}; };
      this.wind=mk(320,0.7,'lowpass'); this.roar=mk(120,0.8); this.hiss=mk(3000,0.6);
      // two voices of the self: together they hum in the middle; as you spread they drift apart and detune
      const voice=()=>{ const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.value=110; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; const g=this.ctx.createGain(); g.gain.value=0; const p=this.ctx.createStereoPanner(); o.connect(f); f.connect(g); g.connect(p); p.connect(this.out); o.start(); return {o,g,p}; };
      this.vA=voice(); this.vB=voice(); }catch(e){} },
    self(mass,spread,elong,pan,dead){ if(!this.ctx||this.muted||!this.vA) return; const t=this.ctx.currentTime;
      const r0=Math.sqrt(Math.max(1,mass)/Math.PI/0.9)*0.72;          // rms radius of a compact blob of this mass
      const stretch=Math.max(0,Math.min(1,(spread/r0-1.0)/1.4));       // 0 round .. 1 torn apart
      const vol=dead?0:Math.min(0.03,0.006+mass/170*0.022);
      const w=stretch*0.9; const pa=Math.max(-1,Math.min(1,pan-w)), pb=Math.max(-1,Math.min(1,pan+w));
      const base=96+Math.min(1,mass/170)*28; const det=stretch*stretch*18+Math.max(0,elong-1.3)*3;
      this.vA.o.frequency.setTargetAtTime(base,t,0.3); this.vB.o.frequency.setTargetAtTime(base+det,t,0.3);
      this.vA.g.gain.setTargetAtTime(vol*(1-stretch*0.3),t,0.3); this.vB.g.gain.setTargetAtTime(vol*(0.6+stretch*0.4),t,0.3);
      this.vA.p.pan.setTargetAtTime(pa,t,0.3); this.vB.p.pan.setTargetAtTime(pb,t,0.3); },
    tone(f0,f1,dur,type,vol){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); o.connect(g); g.connect(this.out||this.ctx.destination); o.start(t); o.stop(t+dur+0.02); },
    noise(dur,vol,freq){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const s=this.ctx.createBufferSource(); s.buffer=this.nb; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.2),t+dur); const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); s.connect(f); f.connect(g); g.connect(this.out||this.ctx.destination); s.start(t); s.stop(t+dur+0.02); },
    ambience(speed,heat){ if(!this.ctx||this.muted||!this.wind) return; const t=this.ctx.currentTime;
      // speed is the gas speed at your centroid in lattice units (vent jets are about 0.18, the cap is 0.3).
      // normalised to a hard maximum, then mapped on a dB-linear curve: silent in drift and your own wake, loud only in a real gust.
      const x=Math.max(0,Math.min(1,(speed-0.03)/0.20));
      const WIND_MAX=0.10; const g=WIND_MAX*(Math.pow(10,2.2*x)-1)/(Math.pow(10,2.2)-1);
      this.wind.g.gain.setTargetAtTime(g,t,0.25); this.wind.fl.frequency.setTargetAtTime(220+x*520,t,0.25);
      this.roar.g.gain.setTargetAtTime(Math.min(0.05,Math.max(0,heat-0.2)*0.15),t,0.4); this.hiss.g.gain.setTargetAtTime(Math.min(0.02,Math.max(0,heat-0.5)*0.1),t,0.4); } };

  // ---------- input ----------
  const keys={}; let sparkQ=false, puffQ=false, debug=0, muted=false;
  window.addEventListener('keydown',e=>{ AUDIO.init(); if(e.repeat) return; keys[e.code]=true; if(/^(Arrow|Key[WASD])/.test(e.code)) target.x=null; if(e.code==='Space'||e.code==='KeyX') sparkQ=true; if(e.code==='KeyC'||e.code==='ShiftLeft') puffQ=true; if(e.code==='KeyV') debug=(debug+1)%5; if(e.code==='KeyM') AUDIO.muted=!AUDIO.muted; if(e.code==='KeyR'&&(player.dead||player.won)) restart(); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  window.addEventListener('keyup',e=>{ keys[e.code]=false; });
  const touches=new Map();
  // touch / mouse: wherever you touch or drag becomes the target point on the map. It stays set when you let go.
  // second finger tap = spark; holding one finger still = contract
  const target={x:null,y:null,set:0};
  const DEAD=10;
  const setTarget=(cx,cy)=>{ const wx=camX+cx*dpr/zoom, wy=camY+cy*dpr/zoom; for(let i=1;i<3;i++){ if(selves[i].live&&selves[i].mass>6&&Math.hypot(selves[i].x-wx,selves[i].y-wy)<16){ adopt(i); return; } } target.x=wx; target.y=wy; target.set=performance.now(); };
  canvas.addEventListener('pointerdown',e=>{ AUDIO.init(); if(AUDIO.ctx&&AUDIO.ctx.state==='suspended') AUDIO.ctx.resume();
    if(touches.size>=1){ sparkQ=true; } else setTarget(e.clientX,e.clientY);
    touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,primary:touches.size===0});
    if(player.dead||(player.won&&player.winT>120)) restart(); e.preventDefault(); });
  canvas.addEventListener('pointermove',e=>{ const t=touches.get(e.pointerId); if(t){ t.x=e.clientX; t.y=e.clientY; if(Math.hypot(t.x-t.x0,t.y-t.y0)>DEAD) t.moved=true; if(t.primary) setTarget(e.clientX,e.clientY); } e.preventDefault(); });
  const up=e=>{ touches.delete(e.pointerId); e.preventDefault(); }; canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up); canvas.addEventListener('pointerout',up);
  canvas.addEventListener('contextmenu',e=>e.preventDefault()); document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  function readInput(){
    let tx=0,ty=0,puff=false;
    if(keys.ArrowLeft||keys.KeyA) tx-=1; if(keys.ArrowRight||keys.KeyD) tx+=1; if(keys.ArrowUp||keys.KeyW) ty-=1; if(keys.ArrowDown||keys.KeyS) ty+=1;
    if(keys.KeyC||keys.ShiftLeft) puff=true;
    for(const t of touches.values()){ if(t.primary&&!t.moved&&performance.now()-t.t>300) puff=true; }
    if(target.x!==null&&tx===0&&ty===0){ const dx=target.x-player.x, dy=target.y-player.y, d=Math.hypot(dx,dy); if(d>2.5){ const k=Math.min(1,0.35+d/30); tx=dx/d*k; ty=dy/d*k; } }
    const n=Math.hypot(tx,ty); if(n>1){ tx/=n; ty/=n; }
    return {tx,ty,spark:sparkQ,puff}; }

  // ---------- player (a cloud of matter inside the simulation) & entities ----------
  const BODY={massMax:170, rnear:12, rfar:30, swim:0.11, push:0.022, coh:2.4, spawnR:8};
  const player={x:0,y:0,mass:0,hp:1,hurt:0,dead:false,deadT:0,won:false,winT:0,facing:1,cores:0,deaths:0,kills:0,checkpoint:null,cpIndex:0,sparkCd:0,respawnT:0,burning:0,vx:0,vy:0,px:0,py:0};
  let cores=[], drones=[];
  let pendingInjectB=null;
  // selves: up to three fragments tracked by the reduction. index 0 is "you"; the others are ghosts.
  const selves=[{x:0,y:0,mass:0,live:true},{x:0,y:0,mass:0,live:false},{x:0,y:0,mass:0,live:false}];
  function pushCentres(){ let n=0; for(let i=0;i<3;i++){ if(selves[i].live){ SIM.centres[n*2]=selves[i].x; SIM.centres[n*2+1]=selves[i].y; n++; } } SIM.nC=Math.max(1,n); }
  function updateSelves(red){
    const cl=red.clusters; if(!cl||cl.length<3) return;
    let k=0; const live=[]; for(let i=0;i<3;i++){ if(selves[i].live){ const c=cl[k++]; selves[i].mass=c.mass; if(c.mass>0.5){ selves[i].x=c.cx; selves[i].y=c.cy; } live.push(selves[i]); } }
    for(const s of live){ if(s!==selves[0] && s.mass<6){ s.live=false; } }
    let best=selves[0]; for(const s of selves){ if(s.live&&s.mass>best.mass*1.15) best=s; }
    if(best!==selves[0]){ const i=selves.indexOf(best); const tmp=selves[0]; selves[0]=best; selves[i]=tmp; }
    if(red.far && red.far.d>BODY.rfar*0.9){ const f=red.far; let farFromAll=true; for(const s of selves){ if(s.live && Math.hypot(s.x-f.x,s.y-f.y)<BODY.rfar*0.9) farFromAll=false; }
      if(farFromAll){ const slot=selves.find(s=>!s.live); if(slot){ slot.live=true; slot.x=f.x; slot.y=f.y; slot.mass=0; } } }
    pushCentres();
  }
  function adopt(i){ if(i<=0||!selves[i].live) return; const tmp=selves[0]; selves[0]=selves[i]; selves[i]=tmp; pushCentres(); target.x=null; AUDIO.tone(500,700,0.15,'sine',0.06); }
  function restart(){ player.x=world.spawn.x; player.y=world.spawn.y; player.px=player.x; player.py=player.y; player.mass=0; player.hp=1; player.dead=false; player.won=false; player.cores=0; player.deaths=0; player.kills=0; player.checkpoint={x:world.spawn.x,y:world.spawn.y}; player.cpIndex=0;
    cores=world.cores.map(c=>({x:c.x,y:c.y,vx:0,vy:0,alive:true})); drones=world.drones.map(d=>({x:d.x,y:d.y,vx:0,vy:0,alive:true,hp:1})); SIM.frame=0;
    pendingInjectB=[player.x,player.y,BODY.spawnR,1.0]; player.respawnT=30;
    selves[0].x=player.x; selves[0].y=player.y; selves[0].mass=0; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); }
  restart();
  const solidAt=(x,y)=>{ const xi=x|0, yi=y|0; if(xi<0||yi<0||xi>=W||yi>=H) return true; const t=world.type[yi*W+xi]; return t===1||t>=5&&t<=8; };
  function collide(e,r){
    let hit=false;
    for(let k=0;k<4;k++){ const ax=k<2?(k===0?-r:r):0, ay=k<2?0:(k===2?-r:r); if(solidAt(e.x+ax,e.y+ay)){ hit=true; if(k===0){ e.x+=0.6; if(e.vx<0) e.vx*=-0.3; } else if(k===1){ e.x-=0.6; if(e.vx>0) e.vx*=-0.3; } else if(k===2){ e.y+=0.6; if(e.vy<0) e.vy*=-0.3; } else { e.y-=0.6; if(e.vy>0) e.vy*=-0.3; } } }
    if(solidAt(e.x,e.y)){ for(let rr=1;rr<12&&solidAt(e.x,e.y);rr++) for(let a=0;a<8;a++){ const nx=e.x+Math.cos(a*0.785)*rr, ny=e.y+Math.sin(a*0.785)*rr; if(!solidAt(nx,ny)){ e.x=nx; e.y=ny; break; } } }
    return hit; }
  function machineHit(e,r){
    let dmg=0; const t=SIM.frame;
    for(const m of world.machines){ if(m.kind==='fan'){ const dx=e.x-m.x, dy=e.y-m.y, d=Math.hypot(dx,dy); if(d<m.r+r){ dmg+=0.008; const k=(m.r+r-d+1)/(d||1); e.vx+=dx*k*0.3+(-m.omega*dy)*3; e.vy+=dy*k*0.3+(m.omega*dx)*3; } }
      else if(m.kind==='door'){ const open=(Math.sin(m.phase+t*2*Math.PI/m.period)>0.2); if(!open && Math.abs(e.x-m.x)<m.h/2+r && Math.abs(e.y-m.y)<m.w/2+r){ e.x+=(e.x<m.x?-1:1)*1.2; e.vx*=-0.3; } }
      else if(m.kind==='piston'){ const ph=(Math.sin(m.phase+t*m.speed)*0.5+0.5)*m.len; const dirY=m.y<=H/2?1:-1; const y0=Math.min(m.y,m.y+dirY*ph), y1=Math.max(m.y,m.y+dirY*ph); if(e.x>m.x-m.w/2-r&&e.x<m.x+m.w/2+r&&e.y>y0-r&&e.y<y1+r){ dmg+=0.012; e.vy+=dirY*0.5; e.x+= (e.x<m.x?-1:1)*0.8; } } }
    return dmg; }
  const probePts=new Float32Array(128), droneArr=new Float32Array(32);
  let inject=null, shake=0, steps=small?2:3;
  const dirS=[0,0];
  const bd={dir:[0,0],push:0,swim:0,coh:BODY.coh,centroid:[0,0],rnear:BODY.rnear,rfar:BODY.rfar,grow:0,injectB:null,drones:droneArr,nDrones:0,droneR:5};
  function tick(){
    const inp=readInput(); sparkQ=false;
    // probe at the centroid, visible cores and drones
    let n=0; const list=[];
    probePts[0]=player.x; probePts[1]=player.y; n=1;
    for(const c of cores){ if(!c.alive||n>=64) continue; if(Math.abs(c.x-player.x)>sw/zoom||Math.abs(c.y-player.y)>sh/zoom) continue; probePts[n*2]=c.x; probePts[n*2+1]=c.y; list.push(c); n++; }
    let nd=0;
    for(const d of drones){ if(!d.alive||n>=64) continue; if(Math.abs(d.x-player.x)>sw/zoom*1.2||Math.abs(d.y-player.y)>sh/zoom*1.2) continue; probePts[n*2]=d.x; probePts[n*2+1]=d.y; list.push(d); n++; if(nd<16){ droneArr[nd*2]=d.x; droneArr[nd*2+1]=d.y; nd++; } }
    const [pb,pb2,red]=SIM.collect();
    const ux=pb[0]*PARAMS.adv*3, uy=pb[1]*PARAMS.adv*3, heat=pb[2];
    // --- intent -> body parameters ---
    const alive=!player.dead;
    const contract=alive&&inp.puff;
    dirS[0]+=((alive?inp.tx:0)-dirS[0])*0.12; dirS[1]+=((alive?inp.ty:0)-dirS[1])*0.12;
    bd.dir[0]=dirS[0]; bd.dir[1]=dirS[1];
    const effort=Math.min(1,Math.hypot(dirS[0],dirS[1]));
    bd.push=alive?BODY.push:0; bd.swim=contract?BODY.swim*0.4:(alive?BODY.swim:0); bd.coh=contract?BODY.coh*2.6:BODY.coh*(1.0+1.2*(1-effort));
    bd.centroid[0]=player.x; bd.centroid[1]=player.y;
    bd.grow=alive?0.07*Math.max(0,1-player.mass/BODY.massMax):0;
    bd.nDrones=nd; bd.injectB=pendingInjectB; pendingInjectB=null;
    if(inp.tx!==0) player.facing=inp.tx>0?1:-1;
    inject=null;
    if(alive){
      if(player.sparkCd>0) player.sparkCd--;
      if(inp.spark&&player.sparkCd===0){ player.sparkCd=24; inject={x:player.x+player.facing*14,y:player.y,r:5,fuel:0.25,heat:1.4,smoke:0.1,life:0}; AUDIO.noise(0.25,0.2,1500); AUDIO.tone(800,200,0.12,'square',0.05); shake=Math.max(shake,1); }
    }
    // --- cores & drones ---
    let k=1;
    for(const e of list){
      const eux=pb[k*4]*PARAMS.adv*3, euy=pb[k*4+1]*PARAMS.adv*3, eheat=pb[k*4+2], eself=pb2[k*4+3]; k++;
      if(e.hp===undefined){
        e.vx+=(eux-e.vx)*0.1; e.vy+=(euy-e.vy)*0.1+0.004; e.vx*=0.98; e.vy*=0.98; e.x+=e.vx; e.y+=e.vy; collide(e,1.5);
        if(alive&&eself>0.25){ e.alive=false; player.cores++; pendingInjectB=[player.x,player.y,7,0.9]; AUDIO.tone(880,880,0.08,'sine',0.07); setTimeout(()=>AUDIO.tone(1320,1320,0.14,'sine',0.07),70); }
      } else {
        const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy)||1;
        if(alive&&d<180){ e.vx+=dx/d*0.02; e.vy+=dy/d*0.02; }
        e.vx+=(eux-e.vx)*0.05; e.vy+=(euy-e.vy)*0.05; e.vx*=0.97; e.vy*=0.97; e.x+=e.vx; e.y+=e.vy; collide(e,1.8); e.hp-=machineHit(e,1.8);
        if(eheat>0.5) e.hp-=(eheat-0.5)*0.05;
        if(contract&&eself>0.55) e.hp-=0.03;      // squeezed by the body
        if(e.hp<=0){ e.alive=false; inject=inject||{x:e.x,y:e.y,r:7,fuel:0.5,heat:1.0,smoke:0.6,life:0}; player.kills++; AUDIO.tone(500,120,0.2,'square',0.08); AUDIO.noise(0.3,0.2,900); }
      }
    }
    // --- simulate ---
    SIM.updateMask(world.machines,SIM.frame);
    for(let s=0;s<steps;s++){ SIM.step(PARAMS,s===0?inject:null,bd); bd.injectB=null; }
    SIM.lightStep(3);
    SIM.probe(probePts,n);
    updateSelves(red);
    player.mass=red.mass; player.burning=red.burning;
    if(selves[0].mass>0.5){ player.vx=selves[0].x-player.px; player.vy=selves[0].y-player.py; player.px=selves[0].x; player.py=selves[0].y; player.x=selves[0].x; player.y=selves[0].y; }
    player.hp=Math.min(1,player.mass/BODY.massMax);
    player.hurt=Math.min(1,player.hurt*0.9+red.burning*0.02);
    if(red.burning>2&&SIM.frame%12===0) AUDIO.tone(200,90,0.15,'sawtooth',0.05);
    if(alive){
      if(player.respawnT>0) player.respawnT--;
      else if(selves[0].mass<22){ player.dead=true; player.deadT=90; player.deaths++; shake=4; AUDIO.tone(300,40,0.7,'sawtooth',0.15); AUDIO.noise(0.6,0.25,600); }
      { const ci=world.checkpoints.findIndex(c=>Math.hypot(c.x-player.x,c.y-player.y)<12); if(ci>=0&&ci>=player.cpIndex){ const cp=world.checkpoints[ci]; player.checkpoint={x:cp.x,y:cp.y}; player.cpIndex=ci+1; pendingInjectB=[player.x,player.y,10,1.0]; AUDIO.tone(600,900,0.2,'sine',0.08); } }
      if(Math.hypot(player.x-world.exit.x,player.y-world.exit.y)<14&&!player.won){ player.won=true; player.winT=0; [523,659,784,1046].forEach((f,i)=>setTimeout(()=>AUDIO.tone(f,f,0.3,'square',0.08),i*120)); }
      if(player.won) player.winT++;
      AUDIO.ambience(Math.hypot(pb[0],pb[1]),heat);
    } else if(--player.deadT<=0){ player.dead=false; player.x=player.checkpoint.x; player.y=player.checkpoint.y; player.px=player.x; player.py=player.y; pendingInjectB=[player.x,player.y,BODY.spawnR,1.0]; player.respawnT=40; selves[0].x=player.x; selves[0].y=player.y; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); }
    { const vw=sw/zoom; const pan=Math.max(-1,Math.min(1,((player.x-camX)/vw-0.5)*2)); AUDIO.self(player.mass,red.spread||0,red.elong||1,pan,player.dead); }
    shake*=0.85;
  }

  // ---------- camera / render ----------
  let camX=0,camY=0; const ents=new Float32Array(48*4);
  let lastNow=0, dtAvg=16.7;
  function frame(now){
    const t0=performance.now();
    if(lastNow){ const dt=Math.min(100,now-lastNow); dtAvg+=(dt-dtAvg)*0.05; }
    lastNow=now;
    if(SIM.frame%120===0){ if(dtAvg>24&&steps>1) steps--; else if(dtAvg<17.5&&steps<(small?2:3)) steps++; }
    tick();
    const vw=sw/zoom, vh=sh/zoom;
    const tx=player.x-vw/2, ty=player.y-vh/2;
    camX+=(tx-camX)*0.08; camY+=(ty-camY)*0.08;
    camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    const sx=(Math.random()-0.5)*shake, sy=(Math.random()-0.5)*shake;
    let n=0;
    for(const c of cores){ if(!c.alive||n>=48) continue; if(c.x<camX-10||c.x>camX+vw+10||c.y<camY-10||c.y>camY+vh+10) continue; ents[n*4]=c.x; ents[n*4+1]=c.y; ents[n*4+2]=0; ents[n*4+3]=1.8; n++; }
    for(const d of drones){ if(!d.alive||n>=48) continue; if(d.x<camX-10||d.x>camX+vw+10||d.y<camY-10||d.y>camY+vh+10) continue; ents[n*4]=d.x; ents[n*4+1]=d.y; ents[n*4+2]=1; ents[n*4+3]=2.0; n++; }
    SIM.render([camX+sx,camY+sy],zoom,sw,sh,debug,[player.x,player.y,player.dead?0:BODY.rnear,player.facing],ents,n,player.hurt,player.hp);
    drawHud(now-t0);
    requestAnimationFrame(frame);
  }
  function drawHud(ms){
    const c=hctx, s=dpr; c.clearRect(0,0,sw,sh); const pad=6*s;
    if(HASH.hud){ const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='top'; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`mass ${player.mass|0}  ${dtAvg.toFixed(0)}ms ×${steps}`,pad,pad); }
    // ghosts: a faint slow pulse around each other self; tap it to become it
    for(let i=1;i<3;i++){ const g=selves[i]; if(!g.live||g.mass<6||player.dead) continue; const px=(g.x-camX)*zoom, py=(g.y-camY)*zoom; const ph=(performance.now()/1600+i*0.5)%1;
      c.strokeStyle=`rgba(150,190,255,${0.35*(1-ph)})`; c.lineWidth=1.5*s; c.beginPath(); c.arc(px,py,(10+14*ph)*s,0,6.283); c.stroke(); }
    // target point: a soft animated marker where you asked the body to go
    if(target.x!==null&&!player.dead){ const px=(target.x-camX)*zoom, py=(target.y-camY)*zoom; const ph=(performance.now()/700)%1;
      c.strokeStyle=`rgba(140,220,255,${0.55*(1-ph)})`; c.lineWidth=2*s; c.beginPath(); c.arc(px,py,(6+16*ph)*s,0,6.283); c.stroke();
      c.fillStyle='rgba(140,220,255,0.5)'; c.beginPath(); c.arc(px,py,3.5*s,0,6.283); c.fill(); }
    // guide arrow to the next checkpoint or the exit
    if(!player.dead&&!player.won){
      const tgt=player.cpIndex<world.checkpoints.length?world.checkpoints[player.cpIndex]:world.exit;
      const dx=tgt.x-player.x, dy=tgt.y-player.y, d=Math.hypot(dx,dy);
      if(d>30){ const px=(player.x-camX)*zoom, py=(player.y-camY)*zoom; const ax=px+dx/d*34*s, ay=py+dy/d*34*s; const ang=Math.atan2(dy,dx);
        c.save(); c.translate(ax,ay); c.rotate(ang); c.fillStyle= tgt===world.exit?'rgba(255,220,80,0.9)':'rgba(120,255,160,0.85)'; c.beginPath(); c.moveTo(9*s,0); c.lineTo(-6*s,6*s); c.lineTo(-3*s,0); c.lineTo(-6*s,-6*s); c.closePath(); c.fill(); c.restore();
        c.font=`${Math.round(10*s)}px -apple-system,Helvetica,Arial,sans-serif`; c.fillStyle='rgba(255,255,255,0.7)'; c.fillText(`${Math.round(d)}`,ax+10*s,ay-16*s); }
    }
    let msg=null;
    if(player.won) msg= player.winT<240?'YOU REACHED THE CORE EXIT':`exit reached · ${player.cores} cores · ${player.deaths} deaths · tap or R to restart`;
    else if(player.dead) msg='dispersed...';
    else if(SIM.frame<700) msg= isTouch? 'touch the map to set where you want to go · hold still to pull yourself together · second finger: spark' : 'click the map to set where you want to go · hold C to pull yourself together · space: spark · V: views';
    if(msg){ const f2=Math.round(15*s); c.font=`${f2}px -apple-system,Helvetica,Arial,sans-serif`; let lines=[msg]; if(c.measureText(msg).width>sw-pad*6) lines=msg.split(' · '); let my=sh*0.3;
      for(const ln of lines){ const mw=c.measureText(ln).width, mx=(sw-mw)/2; c.fillStyle='rgba(0,0,0,0.45)'; c.fillRect(mx-pad*2,my-pad,mw+pad*4,f2+pad*2); c.fillStyle='#fff'; c.fillText(ln,mx,my); my+=f2+pad*3; } }
  }
  // headless test mode: run N ticks synchronously, render once, report
  if(HASH.test){
    if(HASH.zoom) zoom=+HASH.zoom*dpr;
    let ig=null; if(HASH.ignite){ for(let i=0;i<W*H;i++){ if(world.type[i]===7){ ig={x:i%W,y:(i/W|0)+6}; break; } } if(ig){ HASH.cx=ig.x; HASH.cy=ig.y; } }
    const N=+HASH.n||120; const t0=performance.now(); const trace=[];
    let bestX=0, stuck=0;
    for(let i=0;i<N;i++){ if(HASH.ax){ keys.KeyD=true; if(player.x>bestX+2){ bestX=player.x; stuck=0; } else stuck++; player.maxX=bestX; keys.KeyW=stuck>40&&((stuck/120)|0)%2===0; keys.KeyS=stuck>40&&((stuck/120)|0)%2===1; if(stuck>600){ keys.KeyA=true; keys.KeyD=false; if(stuck>700) stuck=0; } else keys.KeyA=false; } if(ig&&i===+HASH.ignite){ player.x=ig.x-20; player.y=ig.y+10; sparkQ=true; player.facing=1; inject={x:ig.x,y:ig.y,r:6,fuel:0,heat:1.5,smoke:0,life:0}; SIM.step(PARAMS,inject,bd); } tick(); if(HASH.trace&&i%+HASH.trace===0) trace.push(`${i}:${player.mass.toFixed(0)}@${player.x.toFixed(0)},${player.y.toFixed(0)}`); }
    SIM.gl.finish(); const ms=performance.now()-t0;
    const vw=sw/zoom, vh=sh/zoom; camX=(+HASH.cx||player.x)-vw/2; camY=(+HASH.cy||player.y)-vh/2; camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    SIM.render([camX,camY],zoom,sw,sh,+HASH.dbg||0,[player.x,player.y,BODY.rnear,1],ents,0,0,1);
    SIM.probe(probePts,1); const [pb]=SIM.collect();
    document.title=`test ${N} ticks ${ms.toFixed(0)}ms player ${player.x.toFixed(0)},${player.y.toFixed(0)} mass ${player.mass.toFixed(0)} selves ${selves.filter(s=>s.live).map(s=>s.mass.toFixed(0)).join('/')} spread ${(SIM.red.spread||0).toFixed(1)} elong ${(SIM.red.elong||0).toFixed(2)} deaths ${player.deaths} cores ${player.cores} kills ${player.kills||0} hp ${player.hp.toFixed(2)} u ${pb[0].toFixed(3)},${pb[1].toFixed(3)} heat ${pb[2].toFixed(2)} glerr ${SIM.gl.getError()} rooms ${world.rooms.length} trace ${trace.join(' ')}`;
  } else requestAnimationFrame(frame);
})();
