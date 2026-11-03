// v2/main.js — game loop, player, entities, input, camera, HUD, audio
'use strict';
(function(){
  const HASH=Object.fromEntries([...location.search.slice(1).split('&'),...location.hash.slice(1).split('&')].filter(Boolean).map(kv=>kv.split('=')));
  const canvas=document.getElementById('c'), hud=document.getElementById('hud'), hctx=hud.getContext('2d');
  const isTouch=('ontouchstart' in window);
  const small= HASH.small? true : (HASH.test||HASH.lab)? false : (Math.min(window.innerWidth,window.innerHeight)<700||isTouch);
  const FULLW=+HASH.w||2048, FULLH=+HASH.h||1024; const DETAIL=(()=>{ try{ return localStorage.getItem('v2detail')||'full'; }catch(e){ return 'full'; } })(); const COARSE=((small||DETAIL==='half')&&!HASH.w&&!HASH.lab)?2:1;
  const world= HASH.lab? LAB.build(512,256) : (COARSE>1? GEN.downsample(GEN.build(FULLW,FULLH,+HASH.seed||7),COARSE) : GEN.build(FULLW,FULLH,+HASH.seed||7));
  const W=world.W, H=world.H;
  try{ SIM.init(canvas,W,H,world.mask,world.src); }catch(e){ document.body.innerHTML='<p style="color:#fff;font:16px sans-serif;padding:20px">This needs WebGL2 with float textures: '+e.message+'</p>'; throw e; }
  const PARAMS={tau:0.58,buoy:0.0022,ign:0.45,burnP:0.012,adv:1.4,burnRate:0.06,cool:0.004,lifeF:0.9,lifeK:0.06,diff:0.08};
  let zoom=2.5, sw=0,sh=0,dpr=1;
  function resize(){ dpr=Math.min(small?1.5:2,window.devicePixelRatio||1); const vw=window.innerWidth, vh=window.innerHeight; sw=Math.floor(vw*dpr); sh=Math.floor(vh*dpr); canvas.width=sw; canvas.height=sh; hud.width=sw; hud.height=sh; for(const el of [canvas,hud]){ el.style.width=vw+'px'; el.style.height=vh+'px'; } zoom=(small?1.5:1.25)*COARSE*dpr; }   // CSS px per full-resolution cell: 1.25 desktop, 1.5 phone, whatever the pixel density or world resolution
  window.addEventListener('resize',resize); window.addEventListener('orientationchange',()=>setTimeout(resize,300)); if(window.visualViewport) window.visualViewport.addEventListener('resize',resize); resize();

  // ---------- audio ----------
  const AUDIO={ctx:null,muted:false,music:(localStorage.getItem('v2music')||'1')!=='0',init(){ if(this.ctx) return; try{ const C=window.AudioContext||window.webkitAudioContext; this.ctx=new C(); const sr=this.ctx.sampleRate; const buf=this.ctx.createBuffer(1,sr*2,sr); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; this.nb=buf;
      this.master=this.ctx.createGain(); this.master.gain.value=0.35; this.master.connect(this.ctx.destination); this.out=this.master; this.mbus=this.ctx.createGain(); this.mbus.gain.value=this.music?1:0; this.mbus.connect(this.master);
      const mk=(f,q,type)=>{ const s=this.ctx.createBufferSource(); s.buffer=buf; s.loop=true; const fl=this.ctx.createBiquadFilter(); fl.type=type||'bandpass'; fl.frequency.value=f; fl.Q.value=q; const g=this.ctx.createGain(); g.gain.value=0; s.connect(fl); fl.connect(g); g.connect(this.out); s.start(); return {g,fl}; };
      this.wind=mk(320,0.7,'lowpass'); this.roar=mk(120,0.8); this.hiss=mk(3000,0.6);
      // two voices of the self: together they hum in the middle; as you spread they drift apart and detune
      const voice=()=>{ const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.value=110; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; const g=this.ctx.createGain(); g.gain.value=0; const p=this.ctx.createStereoPanner(); o.connect(f); f.connect(g); g.connect(p); p.connect(this.mbus); o.start(); return {o,g,p}; };
      this.vA=voice(); this.vB=voice(); this.musicInit(); }catch(e){} },
    ps(p,v,t,tc){ const l=p._v; if(l!==undefined&&Math.abs(v-l)<=0.015*Math.max(Math.abs(l),Math.abs(v))+1e-5) return; p._v=v; p.setTargetAtTime(v,t,tc); },
    setMusic(on){ this.music=on; try{ localStorage.setItem('v2music',on?'1':'0'); }catch(e){} if(this.mbus) this.ps(this.mbus.gain,on?1:0,this.ctx.currentTime,0.1); },
    self(mass,spread,elong,pan,dead){ if(!this.ctx||this.muted||!this.vA) return; const t=this.ctx.currentTime;
      const r0=Math.sqrt(Math.max(1,mass)/Math.PI/0.9)*0.72;          // rms radius of a compact blob of this mass
      const stretch=Math.max(0,Math.min(1,(spread/r0-1.0)/1.4));       // 0 round .. 1 torn apart
      const vol=dead?0:Math.min(0.03,0.006+mass/170*0.022);
      const w=stretch*0.9; const pa=Math.max(-1,Math.min(1,pan-w)), pb=Math.max(-1,Math.min(1,pan+w));
      const base=(this.root||110)*(mass>90?0.5:1); const semi=stretch<0.25?7:stretch<0.5?5:stretch<0.75?6:1; // fifth .. fourth .. tritone .. minor second as you tear
      this.ps(this.vA.o.frequency,base,t,0.3); this.ps(this.vB.o.frequency,base*Math.pow(2,semi/12)+Math.max(0,elong-1.3)*1.5,t,0.3);
      this.ps(this.vA.g.gain,vol*(1-stretch*0.3),t,0.3); this.ps(this.vB.g.gain,vol*(0.6+stretch*0.4),t,0.3);
      this.ps(this.vA.p.pan,pa,t,0.3); this.ps(this.vB.p.pan,pb,t,0.3); },
    tone(f0,f1,dur,type,vol){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); o.connect(g); g.connect(this.out||this.ctx.destination); o.start(t); o.stop(t+dur+0.02); },
    noise(dur,vol,freq){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const s=this.ctx.createBufferSource(); s.buffer=this.nb; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.2),t+dur); const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); s.connect(f); f.connect(g); g.connect(this.out||this.ctx.destination); s.start(t); s.stop(t+dur+0.02); },
    // ---- music: everything is played by the simulation ----
    // key: each chamber has a root a fifth from the last, so moving through the structure modulates.
    // pipes: vents near you sing a scale degree, panned where they are, breathing slowly; drains hum an octave down; coolers ring like bells.
    // pulse: a plucked walk on the chamber's pentatonic, clocked by the gas speed at your body: still means silence, a jet means a run;
    //        the walk climbs in a rising current and falls in a sinking one; the register comes from your mass; stamina thins it.
    musicInit(){ const C=this.ctx; this.pipes=[]; for(let i=0;i<8;i++){ const o=C.createOscillator(); o.type=i<6?'triangle':'sine'; const f=C.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; const g=C.createGain(); g.gain.value=0; const p=C.createStereoPanner(); o.connect(f); f.connect(g); g.connect(p); p.connect(this.mbus); o.start(); this.pipes.push({o,f,g,p,src:null}); }
      this.pulsePhase=0; this.deg=4; this.lastMass=0; this.root=110; this.srcT=0; this.near=[]; },
    pluck(freq,vol,pan,dur,type){ const C=this.ctx,t=C.currentTime; const o=C.createOscillator(); o.type=type||'sine'; o.frequency.value=freq; const g=C.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); const p=C.createStereoPanner(); p.pan.value=pan; o.connect(g); g.connect(p); p.connect(this.mbus); o.start(t); o.stop(t+dur+0.02); },
    music(m){ if(!this.ctx||this.muted||!this.music||!this.pipes) return; const t=this.ctx.currentTime, C=this.ctx;
      const PENT=[0,2,4,7,9,12,14,16,19,21]; const root=55*Math.pow(2,((m.room*7)%12)/12)*2; // chamber key, A..G# by fifths, around 110 Hz
      this.root=root;
      // world sources within earshot (recomputed every half second)
      if(m.frame-this.srcT>30||!this.near.length){ this.srcT=m.frame; const near=[]; for(const q of m.srcs){ const dx=q.x-m.x, dy=q.y-m.y; const d=Math.hypot(dx,dy); if(d<260) near.push({q,d,dx}); } near.sort((a,b)=>a.d-b.d); this.near=near.slice(0,8); }
      for(let i=0;i<8;i++){ const v=this.pipes[i], n=this.near[i]; if(!n){ this.ps(v.g.gain,0,t,0.3); continue; } const q=n.q; const prox=1/(1+(n.d/70)*(n.d/70));
        let f,vol,cut; if(q.k===2){ f=root*Math.pow(2,PENT[q.h%5]/12)*2; vol=0.016*prox*(0.7+0.3*Math.sin(m.frame*0.021+q.h)); cut=700; }            // vent: a pipe breathing
        else if(q.k===3){ f=root*0.5; vol=0.012*prox*(0.6+0.4*Math.sin(m.frame*0.013+q.h)); cut=260; }                                              // drain: pulls the key down an octave
        else if(q.k===6){ f=root*Math.pow(2,PENT[5+q.h%5]/12)*4; vol=0.006*prox*Math.max(0,Math.sin(m.frame*0.03+q.h*1.7)); cut=6000; }             // cooler: a high bell that comes and goes
        else { f=root*0.75; vol=0.008*prox*(0.5+0.5*Math.sin(m.frame*0.19+q.h)); cut=180; }                                                       // burner: a hot shudder below the key
        if(v.src!==q){ v.src=q; this.ps(v.o.frequency,f,t,0.05); } this.ps(v.g.gain,vol,t,0.15); this.ps(v.f.frequency,cut,t,0.2); this.ps(v.p.pan,Math.max(-1,Math.min(1,n.dx/160)),t,0.2); }
      // pulse: tempo from the gas speed at the body
      const x=Math.max(0,Math.min(1,(m.speed-0.02)/0.18)); const rate=x<0.02?0:(0.6+x*x*7.0)/60;   // plucks per tick: ~0.6/s drifting, ~7.6/s in a full jet
      this.pulsePhase+=rate; if(this.pulsePhase>=1&&!m.dead){ this.pulsePhase-=1;
        const up=m.vy<-0.03, dn=m.vy>0.03; if(up) this.deg++; else if(dn) this.deg--; else this.deg+=Math.random()<0.5?0:(Math.random()<0.5?1:-1); if(Math.random()<0.15) this.deg+=this.deg>5?-1:1;
        this.deg=Math.max(0,Math.min(9,this.deg)); const oct=m.mass>110?1:2; const f=root*Math.pow(2,PENT[this.deg]/12)*oct;
        const vol=(0.012+0.03*x)*(0.4+0.6*Math.min(1,m.mass/150))*(0.5+0.5*m.stamina); this.pluck(f,vol,m.pan,0.35+0.4*(1-x),m.cold?'sine':'triangle'); }
      // tearing: a falling pair when a chunk goes; cold regrowth: a rising pair
      const dm=m.mass-this.lastMass; this.lastMass=m.mass; if(dm<-6&&!m.dead){ this.pluck(root*2,0.03,m.pan,0.5); setTimeout(()=>this.pluck(root*Math.pow(2,1/12),0.03,m.pan,0.8),120); }
      else if(dm>1.2&&m.cold&&m.frame%20===0){ this.pluck(root*4,0.012,m.pan,0.6); setTimeout(()=>this.pluck(root*4*Math.pow(2,7/12),0.012,m.pan,0.8),140); } },
    ambience(speed,heat){ if(!this.ctx||this.muted||!this.wind) return; const t=this.ctx.currentTime;
      // speed is the gas speed at your centroid in lattice units (vent jets are about 0.18, the cap is 0.3).
      // normalised to a hard maximum, then mapped on a dB-linear curve: silent in drift and your own wake, loud only in a real gust.
      const x=Math.max(0,Math.min(1,(speed-0.03)/0.20));
      const WIND_MAX=0.10; const g=WIND_MAX*(Math.pow(10,2.2*x)-1)/(Math.pow(10,2.2)-1);
      this.ps(this.wind.g.gain,g,t,0.25); this.ps(this.wind.fl.frequency,220+x*520,t,0.25);
      this.ps(this.roar.g.gain,Math.min(0.05,Math.max(0,heat-0.2)*0.15),t,0.4); this.ps(this.hiss.g.gain,Math.min(0.02,Math.max(0,heat-0.5)*0.1),t,0.4); } };

  // ---------- input ----------
  const keys={}; let sparkQ=false, puffQ=false, debug=0, muted=false;
  window.addEventListener('keydown',e=>{ AUDIO.init(); if(e.code==='Tab'||e.code==='Backquote'){ MENU.open=!MENU.open; e.preventDefault(); return; } if(e.repeat) return; keys[e.code]=true; if(/^(Arrow|Key[WASD])/.test(e.code)) target.x=null; if(e.code==='KeyX') sparkQ=true; if(e.code==='KeyC'||e.code==='ShiftLeft') puffQ=true; if(e.code==='KeyV') debug=(debug+1)%5; if(e.code==='KeyM') AUDIO.muted=!AUDIO.muted; if(e.code==='KeyN') AUDIO.setMusic(!AUDIO.music); if(e.code==='KeyR'&&(player.dead||player.won)) restart(); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  window.addEventListener('keyup',e=>{ keys[e.code]=false; });
  const touches=new Map();
  // touch / mouse: wherever you touch or drag becomes the target point on the map. It stays set when you let go.
  // second finger tap = spark; holding one finger still = contract
  const target={x:null,y:null,set:0};
  const DEAD=10;
  const setTarget=(cx,cy)=>{ const wx=camX+cx*dpr/zoom, wy=camY+cy*dpr/zoom; target.x=wx; target.y=wy; target.set=performance.now(); };
  canvas.addEventListener('pointerdown',e=>{ AUDIO.init(); if(AUDIO.ctx&&AUDIO.ctx.state==='suspended') AUDIO.ctx.resume();
    if(menuHit(e.clientX,e.clientY)){ e.preventDefault(); return; }
    { const ev={t:performance.now(),x:camX+e.clientX*dpr/zoom,y:camY+e.clientY*dpr/zoom,sx:e.clientX,sy:e.clientY,id:e.pointerId,up:0,dur:0}; touchLog.push(ev); if(touchLog.length>400) touchLog.shift(); if(SCHEME.onDown) SCHEME.onDown(ctxNow(),ev); }
    if(SCHEME.useTarget===false){ touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,primary:touches.size===0}); e.preventDefault(); return; }
    if(touches.size>=1){ sparkQ=true; } else setTarget(e.clientX,e.clientY);
    touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,primary:touches.size===0});
    if(player.dead||(player.won&&player.winT>120)) restart(); e.preventDefault(); });
  const hover={x:0,y:0,set:false};
  canvas.addEventListener('pointermove',e=>{ hover.x=camX+e.clientX*dpr/zoom; hover.y=camY+e.clientY*dpr/zoom; hover.set=true; const t=touches.get(e.pointerId); if(t){ t.x=e.clientX; t.y=e.clientY; if(Math.hypot(t.x-t.x0,t.y-t.y0)>DEAD) t.moved=true; if(t.primary&&SCHEME.useTarget!==false) setTarget(e.clientX,e.clientY); if(SCHEME.onMove) SCHEME.onMove(ctxNow(),{id:e.pointerId,sx:e.clientX,sy:e.clientY,x:camX+e.clientX*dpr/zoom,y:camY+e.clientY*dpr/zoom}); } e.preventDefault(); });
  const up=e=>{ const ev=touchLog.find(v=>v.id===e.pointerId&&!v.up); if(ev){ ev.up=performance.now(); ev.dur=ev.up-ev.t; if(SCHEME.onUp) SCHEME.onUp(ctxNow(),ev); } touches.delete(e.pointerId); e.preventDefault(); }; canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up); canvas.addEventListener('pointerout',up);
  canvas.addEventListener('contextmenu',e=>e.preventDefault()); document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  function readInput(){
    let tx=0,ty=0,puff=false;
    if(keys.ArrowLeft||keys.KeyA) tx-=1; if(keys.ArrowRight||keys.KeyD) tx+=1; if(keys.ArrowUp||keys.KeyW) ty-=1; if(keys.ArrowDown||keys.KeyS) ty+=1;
    if(keys.KeyC||keys.ShiftLeft) puff=true;
    if(SCHEME.useTarget!==false){ for(const t of touches.values()){ if(t.primary&&!t.moved&&performance.now()-t.t>300) puff=true; } }   // hold still to tighten: only where a touch is not itself the input
    if(target.x!==null&&tx===0&&ty===0){ const dx=target.x-player.x, dy=target.y-player.y, d=Math.hypot(dx,dy); if(d>2.5){ const k=Math.min(1,0.35+d/30); tx=dx/d*k; ty=dy/d*k; } }
    const n=Math.hypot(tx,ty); if(n>1){ tx/=n; ty/=n; }
    return {tx,ty,spark:sparkQ,puff}; }

  // ---------- player (a cloud of matter inside the simulation) & entities ----------
  const MK=1/(COARSE*COARSE); const BODY={massMax:170*MK, rnear:12/COARSE, rfar:30/COARSE, swim:0.16, push:0.0, coh:2.4, spawnR:8/COARSE};
  const DEFAULT_SCHEME='target';
  const SCHEME=(SCHEMES[HASH.scheme]||SCHEMES[DEFAULT_SCHEME]);
  const touchLog=[];   // {t, x, y (world), sx, sy (screen css px), up (time), dur}
  const MENU={open:false,rows:[],pill:null,names:Object.keys(SCHEMES)};
  function menuHit(cx,cy){ // css px; returns true if the tap was consumed by the menu
    const p=MENU.pill; if(p&&cx>=p.x&&cx<=p.x+p.w&&cy>=p.y&&cy<=p.y+p.h){ MENU.open=!MENU.open; return true; }
    if(MENU.open){ for(const r of MENU.rows){ if(r.act&&cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.h){ r.act(); return true; } if(cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.h){ location.href=location.pathname+'?scheme='+r.name+(HASH.hud?'&hud=1':''); return true; } } MENU.open=false; return true; }
    return false; }
  const player={x:0,y:0,mass:0,hp:1,hurt:0,dead:false,deadT:0,won:false,winT:0,facing:1,cores:0,deaths:0,kills:0,checkpoint:null,cpIndex:0,sparkCd:0,respawnT:0,burning:0,vx:0,vy:0,px:0,py:0};
  let cores=[], drones=[];
  let pendingInjectB=null;
  const dirS=[0,0];
  // selves: up to three fragments tracked by the reduction. index 0 is "you"; the others are ghosts.
  const selves=[{x:0,y:0,mass:0,live:true,hx:0,hy:0},{x:0,y:0,mass:0,live:false,hx:0,hy:0},{x:0,y:0,mass:0,live:false,hx:0,hy:0}];
  function pushCentres(){ let n=0; for(let i=0;i<3;i++){ if(selves[i].live){ SIM.centres[n*2]=selves[i].x; SIM.centres[n*2+1]=selves[i].y; const d=i===0?[dirS[0],dirS[1]]:[selves[i].hx*0.45,selves[i].hy*0.45]; SIM.dirs[n*2]=d[0]; SIM.dirs[n*2+1]=d[1]; n++; } } SIM.nC=Math.max(1,n); }
  function updateSelves(red){
    const cl=red.clusters; if(!cl||cl.length<3) return;
    let k=0; const live=[]; for(let i=0;i<3;i++){ if(selves[i].live){ const c=cl[k++]; selves[i].mass=c.mass; if(c.mass>0.5){ selves[i].x=c.cx; selves[i].y=c.cy; } live.push(selves[i]); } }
    for(const s of live){ if(s!==selves[0] && s.mass<6*MK){ s.live=false; } }
    // you stay you. only when you have been below the living threshold for most of a second, and a part left behind is clearly alive, does it take over; then it locks for four seconds so the view never flips back and forth
    player.lowT=selves[0].mass<22*MK?(player.lowT||0)+1:0; player.switchLock=Math.max(0,(player.switchLock||0)-1);
    if(player.lowT>=45&&player.switchLock===0&&!player.dead){ let best=null; for(let i=1;i<3;i++){ if(selves[i].live&&selves[i].mass>30*MK&&(!best||selves[i].mass>best.mass)) best=selves[i]; }
      if(best){ player.switchLock=240; player.lowT=0; const i=selves.indexOf(best); const tmp=selves[0]; selves[0]=best; selves[i]=tmp; dirS[0]=best.hx; dirS[1]=best.hy; target.x=null; AUDIO.tone(400,600,0.3,'sine',0.05); } }
    if(red.far && red.far.d>BODY.rfar*0.9){ const f=red.far; let farFromAll=true; for(const s of selves){ if(s.live && Math.hypot(s.x-f.x,s.y-f.y)<BODY.rfar*0.9) farFromAll=false; }
      if(farFromAll){ const slot=selves.find(s=>!s.live); if(slot){ slot.live=true; slot.x=f.x; slot.y=f.y; slot.mass=0; slot.hx=dirS[0]; slot.hy=dirS[1]; } } }
    for(let i=1;i<3;i++){ if(selves[i].live){ selves[i].hx*=0.9995; selves[i].hy*=0.9995; } }   // habits fade slowly
    pushCentres();
  }
  function adopt(i){ if(i<=0||!selves[i].live) return; const tmp=selves[0]; tmp.hx=dirS[0]; tmp.hy=dirS[1]; selves[0]=selves[i]; selves[i]=tmp; dirS[0]=selves[0].hx; dirS[1]=selves[0].hy; pushCentres(); target.x=null; AUDIO.tone(500,700,0.15,'sine',0.06); }
  function restart(){ player.stamina=1; player.dissoc=0; player.x=world.spawn.x; player.y=world.spawn.y; player.px=player.x; player.py=player.y; player.mass=0; player.hp=1; player.dead=false; player.won=false; player.cores=0; player.deaths=0; player.kills=0; player.checkpoint={x:world.spawn.x,y:world.spawn.y}; player.cpIndex=0;
    cores=[]; drones=[]; SIM.frame=0;
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
  function ctxNow(){ return {bd,player,selves,dirS,target,touches,keys,touchLog,hover,red:SIM.red,camX,camY,zoom,dpr,W,H,world,BODY,SIM,AUDIO,now:performance.now(),frame:SIM.frame,steps,sw,sh,isTouch}; }
  const probePts=new Float32Array(128), droneArr=new Float32Array(32);
  // sound sources of the structure: patches of vent (2), drain (3), burner (5) and cooler (6) cells, 24 cells across
  const SRCS=(()=>{ const B=24, bw=Math.ceil(world.W/B), acc=new Map(); const ty=world.type; for(let y=0;y<world.H;y+=2) for(let x=0;x<world.W;x+=2){ const k=ty[y*world.W+x]; if(k!==2&&k!==3&&k!==5&&k!==6) continue; const key=k*1e6+((y/B)|0)*bw+((x/B)|0); let a=acc.get(key); if(!a){ a={k,n:0,x:0,y:0}; acc.set(key,a); } a.n++; a.x+=x; a.y+=y; }
    const out=[]; let h=0; for(const a of acc.values()){ if(a.n<3) continue; out.push({k:a.k,x:a.x/a.n,y:a.y/a.n,n:a.n,h:(h++*7919)%1000}); } return out; })();
  let inject=null, shake=0, steps=small?2:3;
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
    bd.app=[0,0,0]; bd.splitStr=0; bd.splitApp=0; bd.radial=0; bd.grip=1.45; bd.tint=[0,0,0,0]; bd.expo=0; bd.inertia=0; bd.ivx=player.vx/Math.max(1,steps); bd.ivy=player.vy/Math.max(1,steps); bd.dense=0.9;
    if(alive && SCHEME.tick){ const cx=ctxNow(); cx.inp=inp; cx.contract=contract; SCHEME.tick(cx); }
    // stamina: holding against a current is work. flow at the centroid vs the direction you are pushing.
    { if(player.stamina===undefined){ player.stamina=1; player.dissoc=0; }
      const fx=pb[0], fy=pb[1], fl=Math.hypot(fx,fy); const dl=Math.hypot(bd.dir[0],bd.dir[1]);
      let effort=0; if(fl>0.07&&dl>0.05){ const against=-(bd.dir[0]*fx+bd.dir[1]*fy)/(fl*dl); effort=Math.max(0,against)*Math.min(1,(fl-0.07)/0.12)*Math.min(1,dl); }
      player.effort=effort; player.dbg=[fx,fy,fl,dl,bd.dir[0],bd.dir[1]].map(v=>+v.toFixed(3)); player.dbg2=[pb===SIM.probeBuf, +SIM.probeBuf[0].toFixed(3), SIM.pending, n, probePts[0]|0, probePts[1]|0];
      if(player.dissoc>0){ player.dissoc--; bd.dir[0]=0; bd.dir[1]=0; bd.coh*=0.5; bd.dense=0.6; if(player.dissoc===0) player.stamina=0.5; }
      else { player.stamina=Math.max(0,player.stamina-effort*0.0045); if(effort<0.1) player.stamina=Math.min(1,player.stamina+0.005*(heat<0?2:1)); if(player.stamina<=0.02){ player.dissoc=150; AUDIO.tone(180,60,1.2,'sine',0.05); } }
      const st=player.stamina; bd.swim*=0.35+0.65*st; bd.push*=0.35+0.65*st; bd.coh*=0.6+0.4*st;
      if(st<0.6){ const g=1-st/0.6; bd.tint=[0.55,0.55,0.6,Math.max(bd.tint?bd.tint[3]:0,0.5*g)]; } }
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
      else if(selves[0].mass<22*MK&&(player.lowT||0)>=45){ player.dead=true; player.deadT=240; player.deaths++; AUDIO.tone(220,60,2.5,'sine',0.05); }
      { player.coldT=player.coldT||0; if(heat<-0.08){ player.coldT++; } else player.coldT=Math.max(0,player.coldT-2);
        if(player.coldT>90){ const ci=world.checkpoints.findIndex(c=>Math.abs(c.x-player.x)<c.w/2+6&&Math.abs(c.y-player.y)<c.h/2+6); if(ci>=0&&(player.checkpoint.x!==world.checkpoints[ci].x)){ const cp=world.checkpoints[ci]; player.checkpoint={x:cp.x,y:cp.y}; player.cpIndex=Math.max(player.cpIndex,ci+1); AUDIO.tone(520,780,0.5,'sine',0.06); setTimeout(()=>AUDIO.tone(780,1040,0.6,'sine',0.05),300); } }
        if(heat<-0.08){ bd.grow*=2.5; bd.coh*=1.3; bd.tint=[0.6,0.85,1.0,Math.max(bd.tint?bd.tint[3]:0,0.45)]; } }
      if(Math.hypot(player.x-world.exit.x,player.y-world.exit.y)<14&&!player.won){ player.won=true; player.winT=0; [523,659,784,1046].forEach((f,i)=>setTimeout(()=>AUDIO.tone(f,f,0.3,'square',0.08),i*120)); }
      if(player.won) player.winT++;
      AUDIO.ambience(Math.hypot(pb[0],pb[1]),heat);
    } else if(--player.deadT<=0){ player.dead=false; player.stamina=1; player.dissoc=0; player.x=player.checkpoint.x; player.y=player.checkpoint.y; player.px=player.x; player.py=player.y; pendingInjectB=[player.x,player.y,BODY.spawnR,1.0]; player.respawnT=40; selves[0].x=player.x; selves[0].y=player.y; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); }
    { const vw=sw/zoom; const pan=Math.max(-1,Math.min(1,((player.x-camX)/vw-0.5)*2)); AUDIO.self(player.mass/MK,(red.spread||0)*COARSE,red.elong||1,pan,player.dead);
      if(SIM.frame%2===0){ const r=world.rooms.find(r=>player.x>=r.x0&&player.x<=r.x1&&player.y>=r.y0&&player.y<=r.y1); const pb=SIM.probeBuf;
        AUDIO.music({frame:SIM.frame,room:r?r.i:(player.roomI||0),x:player.x,y:player.y,srcs:SRCS,speed:Math.hypot(pb[0],pb[1]),vy:pb[1],mass:player.mass/MK,stamina:player.stamina,pan,dead:player.dead,cold:(player.coldT||0)>20}); if(r) player.roomI=r.i; } }
    shake*=0.85;
  }

  // ---------- camera / render ----------
  let camX=0,camY=0; const ents=new Float32Array(48*4);
  // the simulation runs at a fixed rate in real time: SUBRATE substeps per second, at most MAXSTEPS per frame.
  // a 120 Hz phone takes one substep a frame, a 60 Hz screen two or three; a slow frame never buys extra substeps,
  // so a throttled device slows down evenly instead of swinging between fast and slow.
  const SUBRATE=small?120:180, MAXSTEPS=small?2:3; let acc=0;
  let lastNow=0, dtAvg=16.7;
  function frame(now){
    const t0=performance.now();
    if(lastNow){ const dt=Math.min(100,now-lastNow); dtAvg+=(dt-dtAvg)*0.05; acc=Math.min(MAXSTEPS,acc+dt*SUBRATE/1000); } else acc=MAXSTEPS;
    lastNow=now;
    steps=Math.floor(acc); acc-=steps;
    tick();
    const vw=sw/zoom, vh=sh/zoom;
    const tx=player.x-vw/2, ty=player.y-vh/2;
    camX+=(tx-camX)*0.08; camY+=(ty-camY)*0.08;
    camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    const sx=(Math.random()-0.5)*shake, sy=(Math.random()-0.5)*shake;
    let n=0;
    for(const c of cores){ if(!c.alive||n>=48) continue; if(c.x<camX-10||c.x>camX+vw+10||c.y<camY-10||c.y>camY+vh+10) continue; ents[n*4]=c.x; ents[n*4+1]=c.y; ents[n*4+2]=0; ents[n*4+3]=1.8; n++; }
    for(const d of drones){ if(!d.alive||n>=48) continue; if(d.x<camX-10||d.x>camX+vw+10||d.y<camY-10||d.y>camY+vh+10) continue; ents[n*4]=d.x; ents[n*4+1]=d.y; ents[n*4+2]=1; ents[n*4+3]=2.0; n++; }
    SIM.tint=bd.tint; SIM.splitSideR=bd.splitSideR||0;
    SIM.render([camX+sx,camY+sy],zoom,sw,sh,debug,[player.x,player.y,player.dead?0:BODY.rnear,player.facing],ents,n,player.hurt,player.hp);
    drawHud(now-t0);
    requestAnimationFrame(frame);
  }
  function drawHud(ms){
    const c=hctx, s=dpr; c.clearRect(0,0,sw,sh); const pad=6*s;
    if(HASH.hud||BOT.on){ const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='top'; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`mass ${player.mass|0}  ${dtAvg.toFixed(0)}ms ×${steps}`+(BOT.on?`   bot: chamber ${player.cpIndex+1}  deaths ${player.deaths}  t=${(SIM.frame/60)|0}s`:''),pad,pad); }
    if(SCHEME.hud) SCHEME.hud(ctxNow(),c);
    if(!player.dead&&player.stamina!==undefined&&(player.stamina<0.97||player.dissoc>0)){ const px=(player.x-camX)*zoom, py=(player.y-camY)*zoom; const st=player.dissoc>0?0:player.stamina;
      c.lineWidth=(2+3*(1-st))*s; c.strokeStyle='rgba(255,255,255,0.12)'; c.beginPath(); c.arc(px,py,30*s,0,6.283); c.stroke();
      c.strokeStyle= player.dissoc>0? 'rgba(160,160,170,0.7)' : st<0.3? 'rgba(255,150,120,0.8)' : 'rgba(220,235,255,0.6)'; c.beginPath(); c.arc(px,py,30*s,-Math.PI/2,-Math.PI/2+6.283*st); c.stroke(); }
    // scheme menu (bottom-right pill; Tab or ` on a keyboard)
    { const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='middle'; c.textAlign='left';
      const label='scheme: '+SCHEME.name+'  ▾'; const tw=c.measureText(label).width; const ph=fs*2, pw=tw+fs*1.6; const px=sw-pw-10*s, py=10*s+(window.safeTop||0)*s;
      c.fillStyle=MENU.open?'rgba(60,70,100,0.85)':'rgba(0,0,0,0.45)'; c.beginPath(); c.roundRect(px,py,pw,ph,ph/2); c.fill(); c.fillStyle='rgba(255,255,255,0.9)'; c.fillText(label,px+fs*0.8,py+ph/2);
      MENU.pill={x:px/s,y:py/s,w:pw/s,h:ph/s}; MENU.rows=[];
      if(MENU.open){ const rh=fs*2.2, rw=Math.max(pw,170*s); let ry=py+ph+8*s; const rx=sw-rw-10*s;
        c.fillStyle='rgba(10,12,20,0.92)'; c.beginPath(); c.roundRect(rx,ry-6*s,rw,rh*(MENU.names.length+3)+12*s,10*s); c.fill();
        for(const tg of [{l:'music: '+(AUDIO.music?'on':'off'),act:()=>AUDIO.setMusic(!AUDIO.music)},{l:'sound: '+(AUDIO.muted?'off':'on'),act:()=>{AUDIO.muted=!AUDIO.muted;}},{l:'detail: '+(COARSE>1?'half':'full')+'   '+dtAvg.toFixed(0)+'ms ×'+steps,act:()=>{ try{ localStorage.setItem('v2detail',COARSE>1?'full':'half'); }catch(e){} location.reload(); }}]){ c.fillStyle='rgba(255,220,160,0.9)'; c.fillText('   '+tg.l,rx+10*s,ry+rh/2); MENU.rows.push({act:tg.act,x:rx/s,y:ry/s,w:rw/s,h:rh/s}); ry+=rh; }
        for(const n of MENU.names){ const cur=n===SCHEME.name; c.fillStyle=cur?'rgba(140,200,255,1)':'rgba(255,255,255,0.85)'; c.fillText((cur?'● ':'   ')+n,rx+10*s,ry+rh/2); MENU.rows.push({name:n,x:rx/s,y:ry/s,w:rw/s,h:rh/s}); ry+=rh; } }
      c.textBaseline='top'; }
    // ghosts: a faint slow pulse around each other self; tap it to become it
    for(let i=1;i<3;i++){ const g=selves[i]; if(!g.live||g.mass<6*MK||player.dead) continue; const px=(g.x-camX)*zoom, py=(g.y-camY)*zoom; const ph=(performance.now()/1600+i*0.5)%1;
      c.strokeStyle=`rgba(150,190,255,${0.35*(1-ph)})`; c.lineWidth=1.5*s; c.beginPath(); c.arc(px,py,(10+14*ph)*s,0,6.283); c.stroke(); }
    // target point: a soft animated marker where you asked the body to go
    if(target.x!==null&&!player.dead){ const px=(target.x-camX)*zoom, py=(target.y-camY)*zoom; const ph=(performance.now()/700)%1;
      c.strokeStyle=`rgba(140,220,255,${0.55*(1-ph)})`; c.lineWidth=2*s; c.beginPath(); c.arc(px,py,(6+16*ph)*s,0,6.283); c.stroke();
      c.fillStyle='rgba(140,220,255,0.5)'; c.beginPath(); c.arc(px,py,3.5*s,0,6.283); c.fill(); }
    // guide arrow to the next checkpoint or the exit
    if(HASH.hud&&!player.dead&&!player.won){
      const tgt=player.cpIndex<world.checkpoints.length?world.checkpoints[player.cpIndex]:world.exit;
      const dx=tgt.x-player.x, dy=tgt.y-player.y, d=Math.hypot(dx,dy);
      if(d>30){ const px=(player.x-camX)*zoom, py=(player.y-camY)*zoom; const ax=px+dx/d*34*s, ay=py+dy/d*34*s; const ang=Math.atan2(dy,dx);
        c.save(); c.translate(ax,ay); c.rotate(ang); c.fillStyle= tgt===world.exit?'rgba(255,220,80,0.9)':'rgba(120,255,160,0.85)'; c.beginPath(); c.moveTo(9*s,0); c.lineTo(-6*s,6*s); c.lineTo(-3*s,0); c.lineTo(-6*s,-6*s); c.closePath(); c.fill(); c.restore();
        c.font=`${Math.round(10*s)}px -apple-system,Helvetica,Arial,sans-serif`; c.fillStyle='rgba(255,255,255,0.7)'; c.fillText(`${Math.round(d)}`,ax+10*s,ay-16*s); }
    }
    let msg=null;
    if(player.won) msg= player.winT<240?'YOU REACHED THE CORE EXIT':`exit reached · ${player.cores} cores · ${player.deaths} deaths · tap or R to restart`;
    else if(player.dead) msg= player.deadT>120? '' : 'dispersed';
    else if(SIM.frame<900) msg= (SCHEME.name+' · '+SCHEME.blurb);
    else if(SIM.frame<700) msg= isTouch? 'touch the map to set where you want to go · hold still to pull yourself together · second finger: spark' : 'click the map to set where you want to go · hold C to pull yourself together · space: spark · V: views';
    if(msg&&msg.length){ const f2=Math.round(15*s); c.font=`${f2}px -apple-system,Helvetica,Arial,sans-serif`; let lines=[msg]; if(c.measureText(msg).width>sw-pad*6) lines=msg.split(' · '); let my=sh*0.3;
      for(const ln of lines){ const mw=c.measureText(ln).width, mx=(sw-mw)/2; c.fillStyle='rgba(0,0,0,0.45)'; c.fillRect(mx-pad*2,my-pad,mw+pad*4,f2+pad*2); c.fillStyle='#fff'; c.fillText(ln,mx,my); my+=f2+pad*3; } }
  }
  // bot mode (?bot=1): a guided body follows the static path through the level with the attention drive.
  // it is the dynamic completability test: currents, fans, heat, stamina and withering all act on it.
  const BOT=HASH.bot? {on:true,path:null,i:0,arrivals:[],lastCp:-1,t0:0} : {on:false};
  if(BOT.on){
    BOT.legs=CHECK.route(world,COARSE>1?1:3);
    BOT.full=[]; for(const leg of BOT.legs){ if(leg) BOT.full=BOT.full.concat(leg); }
    SCHEME.useTarget=false;
    const base=SCHEME.tick; SCHEME.tick=(cx)=>{ if(base&&SCHEME.name!=='target') base.call(SCHEME,cx);
      const P=BOT.full; if(!P.length) return;
      let bi=BOT.i, bd2=1e9; for(let k=Math.max(0,BOT.i-40);k<Math.min(P.length,BOT.i+300);k++){ const d=(P[k][0]-cx.player.x)**2+(P[k][1]-cx.player.y)**2; if(d<bd2){ bd2=d; bi=k; } } BOT.i=bi;
      const wp=P[Math.min(P.length-1,bi+24)]; const d=_unit(wp[0]-cx.player.x,wp[1]-cx.player.y);
      cx.dirS[0]+=(d[0]-cx.dirS[0])*0.2; cx.dirS[1]+=(d[1]-cx.dirS[1])*0.2; cx.bd.dir[0]=cx.dirS[0]; cx.bd.dir[1]=cx.dirS[1]; cx.bd.swim*=1.3;
      if(player.cpIndex>BOT.lastCp){ BOT.lastCp=player.cpIndex; BOT.arrivals.push([player.cpIndex,SIM.frame]); } };
  }
  // lab mode: fixed scenarios with measurements
  if(HASH.lab){
    const labIntent=[0,0];
    SCHEME.tick=(cx)=>{ cx.dirS[0]=labIntent[0]; cx.dirS[1]=labIntent[1]; cx.bd.dir[0]=labIntent[0]; cx.bd.dir[1]=labIntent[1]; };
    SCHEME.useTarget=false;
    const ctx={N:+HASH.n||600,warm:HASH.warm===undefined?900:+HASH.warm,player,selves,world,dirS,bd,flow:()=>[SIM.probeBuf[0],SIM.probeBuf[1]],warmStep:()=>{ SIM.updateMask(world.machines,SIM.frame); const b0={dir:[0,0],push:0,swim:0,coh:BODY.coh,centroid:[0,0],rnear:BODY.rnear,rfar:BODY.rfar,grow:0,injectB:null,drones:droneArr,nDrones:0,droneR:5,grip:1,dense:0.9}; for(let s=0;s<steps;s++) SIM.step(PARAMS,null,b0); },spawnAt:(x,y)=>{ player.x=x; player.y=y; player.px=x; player.py=y; pendingInjectB=[x,y,BODY.spawnR,1.0]; selves[0].x=x; selves[0].y=y; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); player.respawnT=30; },
      setIntent:(d)=>{ const n=Math.hypot(d[0],d[1])||1; labIntent[0]=d[0]/n*(n>0?1:0); labIntent[1]=d[1]/n*(n>0?1:0); if(n===0){labIntent[0]=0;labIntent[1]=0;} },
      measure:()=>{ // mass of self inside the jet band, sampled along the jet line with the probe
        const j=world.jet; let n=0; for(let x=j.x0+2;x<W-22&&n<63;x+=24){ for(const dy of [-12,0,12]){ probePts[n*2]=x; probePts[n*2+1]=j.y+dy; n++; } }
        SIM.probe(probePts,n); const [pb,pb2]=SIM.collect(); let s=0; const prof=[]; for(let k=0;k<n;k++){ s+=pb2[k*4+3]; if(k%3===1) prof.push([probePts[k*2]|0,+pb[k*4].toFixed(2)]); } return {inJet:s*24*(j.half*2)/3,prof}; } };
    const rows=LAB.run(HASH.lab,ctx,tick); SIM.gl.finish();
    document.title='LAB '+JSON.stringify({scenario:HASH.lab,rows});
  } else
  // headless test mode: run N ticks synchronously, render once, report
  if(HASH.test){
    if(HASH.zoom) zoom=+HASH.zoom*dpr;
    let ig=null; if(HASH.ignite){ for(let i=0;i<W*H;i++){ if(world.type[i]===7){ ig={x:i%W,y:(i/W|0)+6}; break; } } if(ig){ HASH.cx=ig.x; HASH.cy=ig.y; } }
    const N=+HASH.n||120; const t0=performance.now(); const trace=[]; if(HASH.audio){ AUDIO.init(); if(!AUDIO.ctx) throw new Error('no audio ctx'); }
    const fakeTouch=(wx,wy,hold)=>{ player.ft=(player.ft||0)+1; const sx=(wx-camX)*zoom/dpr, sy=(wy-camY)*zoom/dpr; const ev={t:performance.now(),x:wx,y:wy,sx,sy,id:99,up:0,dur:0}; touchLog.push(ev); if(SCHEME.onDown) SCHEME.onDown(ctxNow(),ev);
      if(hold){ touches.set(99,{x0:sx,y0:sy,x:sx,y:sy,t:performance.now(),moved:false,primary:true}); } else { ev.up=performance.now()+50; ev.dur=50; if(SCHEME.onUp) SCHEME.onUp(ctxNow(),ev); }
      if(SCHEME.useTarget!==false){ target.x=wx; target.y=wy; target.set=performance.now(); } };
    let bestX=0, stuck=0;
    for(let i=0;i<N;i++){ if(HASH.touch&&i===5){ const [tx,ty]=HASH.touch.split(',').map(Number); fakeTouch(player.x+tx,player.y+ty,HASH.touchHold!=='0'); } if(HASH.tapEvery&&i%+HASH.tapEvery===0){ const [tx,ty]=(HASH.touch||'60,0').split(',').map(Number); fakeTouch(player.x+tx,player.y+ty,false); } if(i===6) player.tgt6=target.x; if(i===20) player.tgt20=target.x;
      if(HASH.ax){ keys.KeyD=true; if(player.x>bestX+2){ bestX=player.x; stuck=0; } else stuck++; player.maxX=bestX; keys.KeyW=stuck>40&&((stuck/120)|0)%2===0; keys.KeyS=stuck>40&&((stuck/120)|0)%2===1; if(stuck>600){ keys.KeyA=true; keys.KeyD=false; if(stuck>700) stuck=0; } else keys.KeyA=false; } if(ig&&i===+HASH.ignite){ player.x=ig.x-20; player.y=ig.y+10; sparkQ=true; player.facing=1; inject={x:ig.x,y:ig.y,r:6,fuel:0,heat:1.5,smoke:0,life:0}; SIM.step(PARAMS,inject,bd); } tick(); if(HASH.trace&&i%+HASH.trace===0) trace.push(`${i}:${player.mass.toFixed(0)}@${player.x.toFixed(0)},${player.y.toFixed(0)}`+(BOT.on?`#${BOT.i}c${player.cpIndex+1}d${player.deaths}`:'')); }
    SIM.gl.finish(); const ms=performance.now()-t0;
    const vw=sw/zoom, vh=sh/zoom; camX=(+HASH.cx||player.x)-vw/2; camY=(+HASH.cy||player.y)-vh/2; camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    SIM.render([camX,camY],zoom,sw,sh,+HASH.dbg||0,[player.x,player.y,BODY.rnear,1],ents,0,0,1);
    SIM.probe(probePts,1); const [pb]=SIM.collect();
    document.title=`test ${BOT.on?'BOT arrivals '+JSON.stringify(BOT.arrivals)+' deaths '+player.deaths+' won '+player.won+' at '+(player.x|0)+','+(player.y|0)+' pathIdx '+BOT.i+'/'+BOT.full.length+' legs '+BOT.legs.map(l=>l?l.length:'x').slice(0,4).join(',')+' mass '+(player.mass|0)+' | ':''}DBG ft=${player.ft} tgt6=${player.tgt6} tgt20=${player.tgt20} dirS=${dirS.map(v=>v.toFixed(2))} bddir=${bd.dir.map(v=>v.toFixed(2))} simdirs=${Array.from(SIM.dirs.slice(0,2)).map(v=>v.toFixed(2))} swim=${bd.swim} st=${player.stamina} diss=${player.dissoc} tgt=${target.x} nC=${SIM.nC} centres=${Array.from(SIM.centres.slice(0,2)).map(v=>v|0)} | ${N} ticks ${ms.toFixed(0)}ms player ${player.x.toFixed(0)},${player.y.toFixed(0)} mass ${player.mass.toFixed(0)} selves ${selves.filter(s=>s.live).map(s=>s.mass.toFixed(0)).join('/')} spread ${(SIM.red.spread||0).toFixed(1)} elong ${(SIM.red.elong||0).toFixed(2)} deaths ${player.deaths} cores ${player.cores} kills ${player.kills||0} hp ${player.hp.toFixed(2)} u ${pb[0].toFixed(3)},${pb[1].toFixed(3)} heat ${pb[2].toFixed(2)} glerr ${SIM.gl.getError()} music ${AUDIO.near?AUDIO.near.length+'/'+AUDIO.deg+'/'+(AUDIO.root|0):'-'} rooms ${world.rooms.length} trace ${trace.join(' ')}`;
  } else requestAnimationFrame(frame);
})();
