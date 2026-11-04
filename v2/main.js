// v2/main.js — game loop, player, entities, input, camera, HUD, audio
'use strict';
(function(){
  const HASH=Object.fromEntries([...location.search.slice(1).split('&'),...location.hash.slice(1).split('&')].filter(Boolean).map(kv=>kv.split('=')));
  const canvas=document.getElementById('c'), hud=document.getElementById('hud'), hctx=hud.getContext('2d');
  const isTouch=('ontouchstart' in window);
  const small= HASH.small? true : (HASH.test||HASH.lab)? false : (Math.min(window.innerWidth,window.innerHeight)<700||isTouch);
  const MAPS=[{seed:7,w:2048,h:1024},{seed:42,w:1536,h:768},{seed:3,w:2048,h:1024},{seed:8,w:1536,h:768},{seed:11,w:2048,h:1024},{seed:2,w:1536,h:768},{seed:5,w:2048,h:1024},{seed:12,w:2048,h:1024},{seed:1,w:2048,h:1024},{seed:9,w:2048,h:1024}];
  const MAPI=(()=>{ let m=+HASH.map; if(!(m>=1)){ try{ m=+localStorage.getItem('v2map')||1; }catch(e){ m=1; } } return ((m-1)%MAPS.length+MAPS.length)%MAPS.length; })(); const MAP=MAPS[MAPI];
  const setMap=(i)=>{ try{ localStorage.setItem('v2map',String(((i%MAPS.length)+MAPS.length)%MAPS.length+1)); }catch(e){} location.href=location.pathname+(HASH.hud?'?hud=1':''); };
  const FULLW=+HASH.w||MAP.w, FULLH=+HASH.h||MAP.h; const DETAIL=(()=>{ try{ return localStorage.getItem('v2detail')||'half'; }catch(e){ return 'half'; } })(); /* half resolution by default everywhere; 'full' is the opt-in */ const COARSE=((small||DETAIL==='half')&&!HASH.w&&!HASH.lab)?2:1;
  const world= HASH.lab? LAB.build(512,256) : CHECK.buildWorld(FULLW,FULLH,+HASH.seed||MAP.seed,COARSE);
  const W=world.W, H=world.H;
  try{ SIM.init(canvas,W,H,world.mask,world.src); }catch(e){ document.body.innerHTML='<p style="color:#fff;font:16px sans-serif;padding:20px">This needs WebGL2 with float textures: '+e.message+'</p>'; throw e; }
  const PARAMS={tau:0.58,buoy:0.0022,ign:0.45,burnP:0.012,adv:1.4,burnRate:0.06,cool:0.004,lifeF:0.9,lifeK:0.06,diff:0.08};
  let zoom=2.5, sw=0,sh=0,dpr=1;
  function resize(){ dpr=Math.min(small?1.5:2,window.devicePixelRatio||1); const vw=window.innerWidth, vh=window.innerHeight; sw=Math.floor(vw*dpr); sh=Math.floor(vh*dpr); canvas.width=sw; canvas.height=sh; hud.width=sw; hud.height=sh; for(const el of [canvas,hud]){ el.style.width=vw+'px'; el.style.height=vh+'px'; } zoom=(small?1.5:Math.max(1.25,Math.min(3,Math.min(vw/1100,vh/650))))*COARSE*dpr; }   // CSS px per full-resolution cell: phones 1.5; desktops sized so the view is about 1100 cells wide or 650 tall, whatever the pixel density
  window.addEventListener('resize',resize); window.addEventListener('orientationchange',()=>setTimeout(resize,300)); if(window.visualViewport) window.visualViewport.addEventListener('resize',resize); resize();

  // ---------- audio ----------
  const AUDIO={ctx:null,muted:false,music:(localStorage.getItem('v2music')||'1')!=='0',init(){ if(this.ctx) return; try{ const C=window.AudioContext||window.webkitAudioContext; this.ctx=new C(); const sr=this.ctx.sampleRate; const buf=this.ctx.createBuffer(1,sr*2,sr); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; this.nb=buf;
      this.master=this.ctx.createGain(); this.master.gain.value=0.35; this.lp=this.ctx.createBiquadFilter(); this.lp.type='lowpass'; this.lp.frequency.value=3000; this.lp.Q.value=0.5; this.comp=this.ctx.createDynamicsCompressor(); this.comp.threshold.value=-20; this.comp.ratio.value=8; this.an=this.ctx.createAnalyser(); this.an.fftSize=4096; this.an.smoothingTimeConstant=0.5; this.anBuf=new Float32Array(this.an.frequencyBinCount); this.master.connect(this.lp); this.lp.connect(this.comp); this.comp.connect(this.an); this.an.connect(this.ctx.destination); this.out=this.master; this.live=new Set(); this.created=0; this.ended=0; this.peaks=[]; this.mbus=this.ctx.createGain(); this.mbus.gain.value=this.music?1:0; this.mbus.connect(this.master);
      const mk=(f,q,type)=>{ const s=this.ctx.createBufferSource(); s.buffer=buf; s.loop=true; const fl=this.ctx.createBiquadFilter(); fl.type=type||'bandpass'; fl.frequency.value=f; fl.Q.value=q; const g=this.ctx.createGain(); g.gain.value=0; s.connect(fl); fl.connect(g); g.connect(this.out); s.start(); return {g,fl}; };
      this.wind=mk(320,0.7,'lowpass'); this.roar=mk(120,0.8); this.hiss=mk(3000,0.6);
      // two voices of the self: together they hum in the middle; as you spread they drift apart and detune
      const voice=()=>{ const o=this.ctx.createOscillator(); o.type='triangle'; o.frequency.value=110; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=420; const g=this.ctx.createGain(); g.gain.value=0; const p=this.ctx.createStereoPanner(); o.connect(f); f.connect(g); g.connect(p); p.connect(this.mbus); o.start(); return {o,g,p}; };
      this.vA=voice(); this.vB=voice(); this.musicInit(); }catch(e){} },
    psg(p,v,t,tc){ this.ps(p,Math.min(0.25,Math.max(0,v)),t,tc); }, psf(p,v,t,tc){ this.ps(p,Math.min(2500,Math.max(20,v)),t,tc); }, psp(p,v,t,tc){ this.ps(p,Math.min(1,Math.max(-1,v)),t,tc); },
    ps(p,v,t,tc){ if(!isFinite(v)) return; const l=p._v; if(l!==undefined&&Math.abs(v-l)<=0.015*Math.max(Math.abs(l),Math.abs(v))+1e-5) return; p._v=v; p.setTargetAtTime(v,t,tc); },
    track(n,dur){ this.live.add(n); this.created++; n.onended=()=>{ this.live.delete(n); this.ended++; }; setTimeout(()=>this.live.delete(n),(dur+1)*1000); },
    // what the speaker is actually playing: the loudest bin of the output spectrum. a loud peak that stays on one
    // pitch for 5 s while the self is idle is a stuck tone: it is reported with the whole graph's state, then silenced.
    spectrum(){ if(!this.an) return null; this.an.getFloatFrequencyData(this.anBuf); let bi=0,bv=-200; for(let i=2;i<this.anBuf.length;i++){ if(this.anBuf[i]>bv){ bv=this.anBuf[i]; bi=i; } } return {hz:Math.round(bi*this.ctx.sampleRate/this.an.fftSize),db:Math.round(bv)}; },
    watch(){ const pk=this.spectrum(); if(!pk) return; this.peaks.push(pk); if(this.peaks.length>10) this.peaks.shift(); this.lastPeak=pk;
      const recent=this.peaks.slice(-10); if(recent.length<10) return; const loud=recent.every(q=>q.db>-38); const same=recent.every(q=>Math.abs(q.hz-recent[0].hz)<=recent[0].hz*0.06+12);
      if(loud&&same&&(this.act||0)<0.25&&recent[0].hz>60){ if(window.REPORT) REPORT('stuck',`sustained ${recent[0].hz} Hz at ${recent[0].db} dB for 5 s`,null,{peaks:recent,created:this.created,ended:this.ended,live:this.live.size}); this.peaks=[]; this.panic('stuck tone '+recent[0].hz+'Hz'); } },
    // silence everything continuous, stop every one-shot, reset pitches; the next good update rebuilds from here
    panic(e){ if(!this.ctx) return; try{ const t=this.ctx.currentTime; const all=[this.wind,this.roar,this.hiss,this.vA,this.vB,...(this.pipes||[])];
      for(const v of all){ if(!v) continue; if(v.g){ v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(0,t); v.g.gain._v=0; } if(v.o){ v.o.frequency.cancelScheduledValues(t); v.o.frequency.setValueAtTime(110,t); v.o.frequency._v=110; } }
      for(const n of this.live){ try{ n.stop(t); }catch(_){ } } this.live.clear(); this.pulsePhase=0; this.deg=4; }catch(_){ }
      this.panics=(this.panics||0)+1; if(window.REPORT) REPORT('panic',e&&e.message||e,e&&e.stack,{panics:this.panics}); else if(this.panics<=3) console.warn('audio panic',e); },
    // start or resume the context inside a user gesture; iOS also wants a silent buffer played once
    unlock(){ this.init(); const c=this.ctx; if(!c) return; if(c.state!=='running'){ c.resume().catch(()=>{}); } if(!this.unlocked){ try{ const b=c.createBuffer(1,1,c.sampleRate); const s=c.createBufferSource(); s.buffer=b; s.connect(c.destination); s.start(0); this.unlocked=true; }catch(e){} } },
    setMusic(on){ this.music=on; try{ localStorage.setItem('v2music',on?'1':'0'); }catch(e){} if(this.mbus) this.ps(this.mbus.gain,on?1:0,this.ctx.currentTime,0.1); },
    self(mass,spread,elong,pan,dead){ if(!this.ctx||this.muted||!this.vA) return; const t=this.ctx.currentTime;
      const r0=Math.sqrt(Math.max(1,mass)/Math.PI/0.9)*0.72;          // rms radius of a compact blob of this mass
      const stretch=Math.max(0,Math.min(1,(spread/r0-1.0)/1.4));       // 0 round .. 1 torn apart
      const act=0.1+0.9*(this.act||0); const breath=0.85+0.15*Math.sin(t/4.5); const vol=dead?0:Math.min(0.02,0.004+mass/170*0.015)*act*breath;   // idle self fades to a tenth and breathes slowly
      const w=stretch*0.9; const pa=Math.max(-1,Math.min(1,pan-w)), pb=Math.max(-1,Math.min(1,pan+w));
      const base=(this.root||110)*(mass>90?0.5:1); const semi=stretch<0.3?7:stretch<0.6?5:stretch<0.9?6:1; // fifth .. fourth .. tritone .. minor second as you tear
      this.psf(this.vA.o.frequency,base,t,0.3); this.psf(this.vB.o.frequency,base*Math.pow(2,semi/12)+Math.min(2,Math.max(0,elong-1.3))*1.5,t,0.3); this.beat=performance.now();
      this.psg(this.vA.g.gain,vol*(1-stretch*0.3),t,0.3); this.psg(this.vB.g.gain,vol*(0.6+stretch*0.4),t,0.3);
      this.psp(this.vA.p.pan,pa,t,0.3); this.psp(this.vB.p.pan,pb,t,0.3); },
    tone(f0,f1,dur,type,vol){ if(!this.ctx||this.muted||!(isFinite(f0)&&isFinite(f1)&&isFinite(dur)&&isFinite(vol)&&dur>0&&vol>0)) return; const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); o.connect(g); g.connect(this.out||this.ctx.destination); o.start(t); try{ o.stop(t+dur+0.02); }catch(e){ o.stop(); } this.track(o,dur); },
    noise(dur,vol,freq){ if(!this.ctx||this.muted||!(isFinite(dur)&&isFinite(vol)&&isFinite(freq)&&dur>0&&vol>0)) return; const t=this.ctx.currentTime; const s=this.ctx.createBufferSource(); s.buffer=this.nb; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.2),t+dur); const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); s.connect(f); f.connect(g); g.connect(this.out||this.ctx.destination); s.start(t); try{ s.stop(t+dur+0.02); }catch(e){ s.stop(); } this.track(s,dur); },
    // ---- music: everything is played by the simulation ----
    // key: each chamber has a root a fifth from the last, so moving through the structure modulates.
    // pipes: vents near you sing a scale degree, panned where they are, breathing slowly; drains hum an octave down; coolers ring like bells.
    // pulse: a plucked walk on the chamber's pentatonic, clocked by the gas speed at your body: still means silence, a jet means a run;
    //        the walk climbs in a rising current and falls in a sinking one; the register comes from your mass; stamina thins it.
    musicInit(){ this.pipes=[];
      this.pulsePhase=0; this.deg=4; this.lastMass=0; this.root=110; this.srcT=0; this.near=[]; },
    pluck(freq,vol,pan,dur,type){ if(!(isFinite(freq)&&isFinite(vol)&&isFinite(pan)&&isFinite(dur)&&dur>0&&vol>0&&freq>0)) return; const C=this.ctx,t=C.currentTime; const o=C.createOscillator(); o.type=type||'sine'; o.frequency.value=freq; const g=C.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); const p=C.createStereoPanner(); p.pan.value=pan; o.connect(g); g.connect(p); p.connect(this.mbus); o.start(t); try{ o.stop(t+dur+0.02); }catch(e){ o.stop(); } this.track(o,dur); },
    music(m){ if(!this.ctx||this.muted||!this.music||!this.pipes) return; const t=this.ctx.currentTime, C=this.ctx;
      const PENT=[0,2,4,7,9,12,14,16,19,21]; const root=55*Math.pow(2,((m.room*7)%12)/12)*2; // chamber key, A..G# by fifths, around 110 Hz
      this.root=root;
      // world sources within earshot (recomputed every half second)
      if(m.frame-this.srcT>30||!this.near.length){ this.srcT=m.frame; const near=[]; for(const q of m.srcs){ const dx=q.x-m.x, dy=q.y-m.y; const d=Math.hypot(dx,dy); if(d<260) near.push({q,d,dx}); } near.sort((a,b)=>a.d-b.d); this.near=near.slice(0,8); }
      // the structure speaks in short notes, never sustained: each source near you sounds once every several seconds
      const nowS=performance.now()/1000; for(const n of this.near){ const q=n.q; const prox=(0.3+0.7*(this.act||0))/(1+(n.d/70)*(n.d/70)); if(prox<0.04) continue; const pan=Math.max(-1,Math.min(1,n.dx/160));
        if(q.nextT===undefined) q.nextT=nowS+Math.random()*4; if(nowS<q.nextT) continue;
        if(q.k===2){ const f=root*Math.pow(2,PENT[q.h%5]/12)*2; this.pluck(f,0.012*prox,pan,0.7,'triangle'); setTimeout(()=>this.pluck(f*Math.pow(2,2/12),0.008*prox,pan,0.9,'triangle'),180); q.nextT=nowS+5+Math.random()*4; }   // vent: a two-note breath
        else if(q.k===3){ this.pluck(root*0.5,0.012*prox,pan,1.0,'sine'); q.nextT=nowS+6+Math.random()*5; }                                                                           // drain: one low pull
        else if(q.k===6){ const f=root*Math.pow(2,PENT[5+q.h%5]/12)*4; this.pluck(f,0.004*prox,pan,1.4,'sine'); q.nextT=nowS+4+Math.random()*6; }                                      // cooler: a bell ping
        else { this.noise(0.35,0.03*prox,260); q.nextT=nowS+3+Math.random()*3; } }                                                                                                     // burner: a puff of rumble
      // pulse: tempo from the gas speed at the body
      const x=Math.max(0,Math.min(1,(m.speed-0.02)/0.18)); const rate=x<0.02?0:(0.6+x*x*7.0)/60;   // plucks per tick: ~0.6/s drifting, ~7.6/s in a full jet
      this.pulsePhase+=rate; if(this.pulsePhase>=1&&!m.dead){ this.pulsePhase-=1;
        const up=m.vy<-0.03, dn=m.vy>0.03; if(up) this.deg++; else if(dn) this.deg--; else this.deg+=Math.random()<0.5?0:(Math.random()<0.5?1:-1); if(Math.random()<0.15) this.deg+=this.deg>5?-1:1;
        this.deg=Math.max(0,Math.min(9,this.deg)); const oct=m.mass>110?1:2; const f=root*Math.pow(2,PENT[this.deg]/12)*oct;
        const vol=(0.012+0.03*x)*(0.4+0.6*Math.min(1,m.mass/150))*(0.5+0.5*m.stamina); this.pluck(f,vol,m.pan,0.35+0.4*(1-x),m.cold?'sine':'triangle'); }
      // tearing: a falling pair when a chunk goes; cold regrowth: a rising pair
      this.massHist=this.massHist||[]; this.massHist.push(m.mass); if(this.massHist.length>20) this.massHist.shift(); const dm=m.mass-this.massHist[0]; this.tearCd=Math.max(0,(this.tearCd||0)-1);
      if(dm<-8&&!m.dead&&!m.near&&this.tearCd===0){ this.tearCd=150; this.pluck(root*2,0.03,m.pan,0.5); setTimeout(()=>this.pluck(root*Math.pow(2,1/12),0.03,m.pan,0.8),120); }
      else if(dm>1.2&&m.cold&&m.frame%20===0){ this.pluck(root*4,0.012,m.pan,0.6); setTimeout(()=>this.pluck(root*4*Math.pow(2,7/12),0.012,m.pan,0.8),140); } },
    ambience(speed,heat){ if(!this.ctx||this.muted||!this.wind) return; const t=this.ctx.currentTime;
      // speed is the gas speed at your centroid in lattice units (vent jets are about 0.18, the cap is 0.3).
      // normalised to a hard maximum, then mapped on a dB-linear curve: silent in drift and your own wake, loud only in a real gust.
      const x=Math.max(0,Math.min(1,(speed-0.03)/0.20));
      const WIND_MAX=0.10; const g=WIND_MAX*(Math.pow(10,2.2*x)-1)/(Math.pow(10,2.2)-1);
      this.psg(this.wind.g.gain,g,t,0.25); this.psf(this.wind.fl.frequency,220+x*520,t,0.25);
      this.psg(this.roar.g.gain,Math.min(0.05,Math.max(0,heat-0.2)*0.15),t,0.4); this.psg(this.hiss.g.gain,Math.min(0.02,Math.max(0,heat-0.5)*0.1),t,0.4); } };

  // ---------- input ----------
  const keys={}; let sparkQ=false, puffQ=false, debug=0, muted=false;
  window.addEventListener('error',e=>{ AUDIO.panic(e.error||e.message); }); window.addEventListener('unhandledrejection',e=>{ AUDIO.panic(e.reason); });
  // audio unlock: the first gesture of any kind starts the context; coming back to the tab resumes it
  for(const ev of ['touchstart','touchend','pointerdown','pointerup','mousedown','mouseup','click','keydown']) window.addEventListener(ev,()=>AUDIO.unlock(),{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&AUDIO.ctx&&AUDIO.ctx.state!=='running') AUDIO.ctx.resume().catch(()=>{}); });
  window.addEventListener('keydown',e=>{ AUDIO.init(); if(e.code==='Tab'||e.code==='Backquote'){ MENU.open=!MENU.open; e.preventDefault(); return; } if(e.repeat) return; keys[e.code]=true; if(/^(Arrow|Key[WASD])/.test(e.code)) target.x=null; if(e.code==='KeyX') sparkQ=true; if(e.code==='KeyC'||e.code==='ShiftLeft') puffQ=true; if(e.code==='KeyV') debug=(debug+1)%5; if(e.code==='KeyM') AUDIO.muted=!AUDIO.muted; if(e.code==='KeyN') AUDIO.setMusic(!AUDIO.music); if(e.code==='KeyR'&&player.won&&player.winT>120) setMap(MAPI+1); else if(e.code==='KeyR'&&player.dead) restart(); if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  window.addEventListener('keyup',e=>{ keys[e.code]=false; });
  const touches=new Map();
  // touch / mouse: wherever you touch or drag becomes the target point on the map. It stays set when you let go.
  // second finger tap = spark; holding one finger still = contract
  const target={x:null,y:null,set:0};
  const DEAD=10;
  const PAD=(isTouch||!!HASH.pad)&&!HASH.nopad;   // touch screens: the finger is a relative pad (see SCHEMES.attention), the body rides high
  const setTarget=(cx,cy)=>{ const wx=camX+cx*dpr/zoom, wy=camY+cy*dpr/zoom; target.x=wx; target.y=wy; target.set=performance.now(); };
  canvas.addEventListener('pointerdown',e=>{ AUDIO.init(); if(AUDIO.ctx&&AUDIO.ctx.state==='suspended') AUDIO.ctx.resume();
    if(menuHit(e.clientX,e.clientY)){ e.preventDefault(); return; }
    { const ev={t:performance.now(),x:camX+e.clientX*dpr/zoom,y:camY+e.clientY*dpr/zoom,sx:e.clientX,sy:e.clientY,id:e.pointerId,up:0,dur:0}; touchLog.push(ev); if(touchLog.length>400) touchLog.shift(); if(SCHEME.onDown) SCHEME.onDown(ctxNow(),ev); }
    if(SCHEME.useTarget===false){ touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,primary:touches.size===0}); e.preventDefault(); return; }
    if(touches.size>=1){ sparkQ=true; } else setTarget(e.clientX,e.clientY);
    touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t:performance.now(),moved:false,primary:touches.size===0});
    if(player.won&&player.winT>120) setMap(MAPI+1); else if(player.dead) restart(); e.preventDefault(); });
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
  const DEFAULT_SCHEME='tempo';
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
  function pushCentres(){ let n=0; SIM.npcK=-1; for(let i=0;i<3;i++){ if(selves[i].live){ if(selves[i].npc) SIM.npcK=n; SIM.centres[n*2]=selves[i].x; SIM.centres[n*2+1]=selves[i].y; const d=i===0?[dirS[0],dirS[1]]:selves[i].npc?[selves[i].hx,selves[i].hy]:[selves[i].hx*0.45,selves[i].hy*0.45]; SIM.dirs[n*2]=d[0]; SIM.dirs[n*2+1]=d[1]; n++; } } SIM.nC=Math.max(1,n); }
  const TR=[];   // last 24 ticks of self bookkeeping, attached to camera-jump reports
  function updateSelves(red){
    const cl=red.clusters; if(!cl||cl.length<3) return;
    if(window.REPORT){ TR.push({f:SIM.frame,nc:SIM.nC,cen:Array.from(SIM.centres).map(v=>v|0),cl:cl.map(c=>[+c.mass.toFixed(1),c.cx|0,c.cy|0]),s:selves.map(s=>[s.live?1:0,+s.mass.toFixed(1),s.x|0,s.y|0]),far:red.far&&[red.far.d|0,red.far.x|0,red.far.y|0],px:player.x|0,py:player.y|0}); if(TR.length>24) TR.shift(); }
    let k=0; const live=[]; for(let i=0;i<3;i++){ if(selves[i].live){ const c=cl[k++]; selves[i].mass=c.mass; if(c.mass>0.5){ selves[i].x=c.cx; selves[i].y=c.cy; } live.push(selves[i]); } }
    for(const s of live){ if(s===selves[0]||s.npc) continue; s.age=(s.age||0)+1; if(s.mass<6*MK&&s.age>30){ s.lowN=(s.lowN||0)+1; if(s.lowN>30){ s.live=false; s.lowN=0; } } else s.lowN=0; }
    // you stay you. only when you have been below the living threshold for most of a second, and a part left behind is clearly alive, does it take over; then it locks for four seconds so the view never flips back and forth
    player.lowT=selves[0].mass<22*MK?(player.lowT||0)+1:0; player.switchLock=Math.max(0,(player.switchLock||0)-1);
    if(player.lowT>=45&&player.switchLock===0&&!player.dead){ let best=null; for(let i=1;i<3;i++){ if(selves[i].live&&!selves[i].npc&&selves[i].mass>30*MK&&(!best||selves[i].mass>best.mass)) best=selves[i]; }
      if(best){ player.switchLock=240; player.lowT=0; const i=selves.indexOf(best); const tmp=selves[0]; selves[0]=best; selves[i]=tmp; dirS[0]=best.hx; dirS[1]=best.hy; target.x=null; AUDIO.tone(400,600,0.3,'sine',0.05); } }
    if(red.far && red.far.d>BODY.rfar*0.9){ const f=red.far; let farFromAll=true; for(const s of selves){ if(s.live && Math.hypot(s.x-f.x,s.y-f.y)<BODY.rfar*0.9) farFromAll=false; }
      player.farN=farFromAll?(player.farN||0)+1:0; if(farFromAll&&player.farN>20){ const slot=selves.find(s=>!s.live); if(slot){ slot.live=true; slot.x=f.x; slot.y=f.y; slot.mass=0; slot.age=0; slot.lowN=0; slot.hx=dirS[0]; slot.hy=dirS[1]; player.farN=0; } } } else player.farN=0;
    for(let i=1;i<3;i++){ if(selves[i].live){ selves[i].hx*=0.9995; selves[i].hy*=0.9995; } }   // habits fade slowly
    pushCentres();
  }
  function adopt(i){ if(i<=0||!selves[i].live) return; const tmp=selves[0]; tmp.hx=dirS[0]; tmp.hy=dirS[1]; selves[0]=selves[i]; selves[i]=tmp; dirS[0]=selves[0].hx; dirS[1]=selves[0].hy; pushCentres(); target.x=null; AUDIO.tone(500,700,0.15,'sine',0.06); }
  const REPAIR_NEED=60*MK;   // ore to bring: about a third of a full body's load, so some can be lost on the way
  function repairAlcove(alc){ alc.dead=false; alc.repairedAt=SIM.frame; for(const q of alc.rects){ SIM.patchMask(q[0],q[1],q[2],q[3],6); for(let y=q[1];y<q[3];y++) for(let x=q[0];x<q[2];x++){ if(x>=0&&y>=0&&x<W&&y<H) world.type[y*W+x]=6; } }
    [392,523,659,784,1046].forEach((f,i)=>setTimeout(()=>AUDIO.tone(f,f,0.5,'sine',0.06),i*140)); }
  function restart(){ player.camSnap=true; player.stamina=1; player.dissoc=0; player.x=world.spawn.x; player.y=world.spawn.y; player.px=player.x; player.py=player.y; player.mass=0; player.hp=1; player.dead=false; player.won=false; player.cores=0; player.deaths=0; player.kills=0; player.checkpoint={x:world.spawn.x,y:world.spawn.y}; player.cpIndex=0;
    cores=[]; drones=[]; SIM.frame=0;
    pendingInjectB=[player.x,player.y,BODY.spawnR,1.0]; player.respawnT=30;
    selves[0].x=player.x; selves[0].y=player.y; selves[0].mass=0; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); }
  restart();
  if(HASH.cp) player.cpIndex=+HASH.cp;
  if(HASH.spawn){ const [sx,sy]=HASH.spawn.split(',').map(Number); player.x=sx; player.y=sy; player.px=sx; player.py=sy; player.checkpoint={x:sx,y:sy}; pendingInjectB=[sx,sy,BODY.spawnR,1.0]; selves[0].x=sx; selves[0].y=sy; pushCentres(); }   // test hook: start the body somewhere else
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
  function ctxNow(){ return {pad:PAD,bd,player,selves,dirS,target,touches,keys,touchLog,hover,red:SIM.red,camX,camY,zoom,dpr,W,H,world,BODY,SIM,AUDIO,now:performance.now(),frame:SIM.frame,steps,sw,sh,isTouch}; }
  const probePts=new Float32Array(128), droneArr=new Float32Array(32);
  // sound sources of the structure: patches of vent (2), drain (3), burner (5) and cooler (6) cells, 24 cells across
  window.__eval=(js)=>eval(js);   // remote debugging: a direct eval inside this closure sees player, selves, bd, world, AUDIO, SIM ...
  window.__state=()=>({frame:SIM.frame,dt:+dtAvg.toFixed(1),steps,mass:+player.mass.toFixed(1),x:player.x|0,y:player.y|0,dead:player.dead,stamina:player.stamina&&+player.stamina.toFixed(2),dissoc:player.dissoc,elong:SIM.red&&+(SIM.red.elong||0).toFixed(2),spread:SIM.red&&+(SIM.red.spread||0).toFixed(1),nC:SIM.nC,scheme:SCHEME.name,coarse:COARSE,small,
    audio:AUDIO.ctx?{state:AUDIO.ctx.state,t:+AUDIO.ctx.currentTime.toFixed(1),vA:AUDIO.vA&&[+AUDIO.vA.o.frequency.value.toFixed(1),+AUDIO.vA.g.gain.value.toFixed(4)],vB:AUDIO.vB&&[+AUDIO.vB.o.frequency.value.toFixed(1),+AUDIO.vB.g.gain.value.toFixed(4)],pipes:AUDIO.pipes&&AUDIO.pipes.map(v=>[+v.o.frequency.value.toFixed(0),+v.g.gain.value.toFixed(4)]),wind:AUDIO.wind&&+AUDIO.wind.g.gain.value.toFixed(4),live:AUDIO.live&&AUDIO.live.size,created:AUDIO.created,ended:AUDIO.ended,peak:AUDIO.lastPeak,act:+(AUDIO.act||0).toFixed(2),panics:AUDIO.panics||0,music:AUDIO.music,muted:AUDIO.muted}:null,
    glerr:SIM.gl.getError()});
  const SRCS=(()=>{ const B=24, bw=Math.ceil(world.W/B), acc=new Map(); const ty=world.type; for(let y=0;y<world.H;y+=2) for(let x=0;x<world.W;x+=2){ const k=ty[y*world.W+x]; if(k!==2&&k!==3&&k!==5&&k!==6) continue; const key=k*1e6+((y/B)|0)*bw+((x/B)|0); let a=acc.get(key); if(!a){ a={k,n:0,x:0,y:0}; acc.set(key,a); } a.n++; a.x+=x; a.y+=y; }
    const out=[]; let h=0; for(const a of acc.values()){ if(a.n<3) continue; out.push({k:a.k,x:a.x/a.n,y:a.y/a.n,n:a.n,h:(h++*7919)%1000}); } return out; })();
  let inject=null, shake=0, steps=small?2:3;
  const bd={dir:[0,0],push:0,swim:0,coh:BODY.coh,centroid:[0,0],rnear:BODY.rnear,rfar:BODY.rfar,grow:0,injectB:null,drones:droneArr,nDrones:0,droneR:5};
  if(HASH.pay) bd.payInit=+HASH.pay;   // test hook: injected cells carry this much ore
  function tick(){
    const inp=readInput(); sparkQ=false;
    // probe at the centroid, visible cores and drones
    let n=0; const list=[];
    probePts[0]=player.x; probePts[1]=player.y; n=1;
    for(const c of cores){ if(!c.alive||n>=40) continue; if(Math.abs(c.x-player.x)>sw/zoom||Math.abs(c.y-player.y)>sh/zoom) continue; probePts[n*2]=c.x; probePts[n*2+1]=c.y; list.push(c); n++; }
    let nd=0;
    for(const d of drones){ if(!d.alive||n>=40) continue; if(Math.abs(d.x-player.x)>sw/zoom*1.2||Math.abs(d.y-player.y)>sh/zoom*1.2) continue; probePts[n*2]=d.x; probePts[n*2+1]=d.y; list.push(d); n++; if(nd<16){ droneArr[nd*2]=d.x; droneArr[nd*2+1]=d.y; nd++; } }
    // dead alcoves: when you are in one, its interior is probed for the ore your cells carry; what they deposit repairs it
    const alc=world.checkpoints.find(c=>c.dead&&Math.abs(c.x-player.x)<c.w/2+10&&Math.abs(c.y-player.y)<c.h/2+10)||null;
    if(alc){ let k=40; for(let gy=0;gy<4;gy++) for(let gx=0;gx<6;gx++){ probePts[k*2]=alc.x-alc.w/2+(gx+0.5)*alc.w/6; probePts[k*2+1]=alc.y-alc.h/2+(gy+0.5)*alc.h/4; k++; } }
    else { let k=40; const sp=BODY.rnear*0.5; for(let gy=0;gy<4;gy++) for(let gx=0;gx<6;gx++){ probePts[k*2]=player.x-3*sp+(gx+0.5)*sp; probePts[k*2+1]=player.y-2*sp+(gy+0.5)*sp; k++; } }   // a grid round the body for its total load (carried ore)
    const [pb,pb2,red]=SIM.collect();
    if(!alc){ let sum=0; for(let k=40;k<64;k++) sum+=Math.max(0,pb2[k*4+1]); const sp=BODY.rnear*0.5; player.carried=sum*sp*sp; }   // ore carried, from the grid round the body
    if(alc&&player.alc===alc){ let sum=0; for(let k=40;k<64;k++) sum+=Math.max(0,pb2[k*4+1]); const inside=sum*(alc.w*alc.h)/24; const dep=inside*0.04*steps; alc.repair=(alc.repair||0)+dep; player.depositing=dep>0.02*MK;
      if(player.depositing&&SIM.frame%20===0&&AUDIO.ctx&&AUDIO.pluck) AUDIO.pluck((AUDIO.root||110)*4,0.012,0,0.4,'sine');
      if(alc.repair>=REPAIR_NEED) repairAlcove(alc); } else player.depositing=false;
    player.alc=alc; bd.alcove=alc?[alc.x-alc.w/2,alc.y-alc.h/2,alc.x+alc.w/2,alc.y+alc.h/2]:[0,0,0,0];
    // a few words the first time something new happens
    if(player.hintT>0) player.hintT--;
    if(!player.hintedOre&&(player.carried||0)>2*MK){ player.hintedOre=true; player.hint='gold ore · carry it to the dark alcove'; player.hintT=420; }
    { const c=player.carried||0; if(c>(player.carriedPrev||0)+0.4*MK&&SIM.frame%12===0&&AUDIO.ctx&&AUDIO.pluck) AUDIO.pluck((AUDIO.root||110)*6,0.012,0,0.25,'sine'); player.carriedPrev=c; }
    if(alc&&player.depositing&&!player.hintedDep){ player.hintedDep=true; player.hint='repairing'; player.hintT=240; }
    if(alc&&!alc.dead&&alc.repairedAt&&SIM.frame-alc.repairedAt<2&&!player.hintedRep){ player.hintedRep=true; player.hint='the alcove is cold again · it remembers you now'; player.hintT=420; }
    if(player.charged===1&&!player.hintedOrb){ player.hintedOrb=true; player.hint='charged · these cells swim hard for a while'; player.hintT=360; }
    if(player.pickT>0){ player.pickT--; if(player.pickT===0) bd.pick=[0,0,0,0]; }
    else if(world.orbs&&!player.dead){ for(const ob of world.orbs){ if(ob.taken) continue; if(Math.hypot(ob.x-player.x,ob.y-player.y)<ob.r+BODY.rnear*0.8){ ob.taken=true; player.pickT=3; bd.pick=[ob.x,ob.y,ob.r+BODY.rnear,1.0]; player.charged=(player.charged||0)+1;
        const q=[ob.x-ob.r,ob.y-ob.r,ob.x+ob.r+1,ob.y+ob.r+1]; SIM.patchMask(q[0],q[1],q[2],q[3],0); for(let y=q[1];y<q[3];y++) for(let x=q[0];x<q[2];x++){ if(world.type[y*W+x]===14) world.type[y*W+x]=0; }
        AUDIO.tone(660,1320,0.35,'sine',0.07); setTimeout(()=>AUDIO.tone(880,1760,0.5,'sine',0.05),120); break; } } }
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
    npcTick();
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
    SIM.probe(probePts,64);
    updateSelves(red);
    player.mass=selves[0].live?selves[0].mass:0; player.burning=red.burning;   // your mass is your cluster's, not every wisp's
    if(selves[0].mass>0.5){ player.vx=selves[0].x-player.px; player.vy=selves[0].y-player.py; player.px=selves[0].x; player.py=selves[0].y; player.x=selves[0].x; player.y=selves[0].y; }
    player.hp=Math.min(1,player.mass/BODY.massMax);
    player.hurt=Math.min(1,player.hurt*0.9+red.burning*0.02);
    if(red.burning>2&&SIM.frame%12===0) AUDIO.tone(200,90,0.15,'sawtooth',0.05);
    if(alive){
      if(player.respawnT>0) player.respawnT--;
      else if(selves[0].mass<22*MK&&(player.lowT||0)>=45){ player.dead=true; player.deadT=240; player.deaths++; AUDIO.tone(220,60,2.5,'sine',0.05); }
      { player.coldT=player.coldT||0; if(heat<-0.08){ player.coldT++; } else player.coldT=Math.max(0,player.coldT-2);
        if(player.coldT>90){ const ci=world.checkpoints.findIndex(c=>!c.dead&&Math.abs(c.x-player.x)<c.w/2+6&&Math.abs(c.y-player.y)<c.h/2+6); if(ci>=0&&(player.checkpoint.x!==world.checkpoints[ci].x)){ const cp=world.checkpoints[ci]; player.checkpoint={x:cp.x,y:cp.y}; player.cpIndex=Math.max(player.cpIndex,ci+1); AUDIO.tone(520,780,0.5,'sine',0.06); setTimeout(()=>AUDIO.tone(780,1040,0.6,'sine',0.05),300); } }
        if(heat<-0.08){ bd.grow*=2.5; bd.coh*=1.3; bd.tint=[0.6,0.85,1.0,Math.max(bd.tint?bd.tint[3]:0,0.45)]; } }
      if(Math.hypot(player.x-world.exit.x,player.y-world.exit.y)<14&&!player.won){ player.won=true; player.winT=0; [523,659,784,1046].forEach((f,i)=>setTimeout(()=>AUDIO.tone(f,f,0.3,'square',0.08),i*120)); }
      if(player.won){ player.winT++; if(player.winT===240&&!HASH.test&&!HASH.lab) setMap(MAPI+1); }   // the exit ends the map: four seconds of 'cleared', then the next one
      try{ AUDIO.ambience(Math.hypot(pb[0],pb[1]),heat); }catch(e){ AUDIO.panic(e); }
    } else if(--player.deadT<=0){ player.dead=false; player.camSnap=true; player.stamina=1; player.dissoc=0; player.x=player.checkpoint.x; player.y=player.checkpoint.y; player.px=player.x; player.py=player.y; pendingInjectB=[player.x,player.y,BODY.spawnR,1.0]; player.respawnT=40; selves[0].x=player.x; selves[0].y=player.y; selves[0].live=true; selves[1].live=false; selves[2].live=false; pushCentres(); }
    { const vw=sw/zoom; const pan=Math.max(-1,Math.min(1,((player.x-camX)/vw-0.5)*2));
      { const pb=SIM.probeBuf; const dm=Math.abs(player.mass-(player.pmass||player.mass)); player.pmass=player.mass;
        const want=Math.min(1,Math.hypot(player.vx,player.vy)/0.6+Math.hypot(pb[0],pb[1])/0.12+dm/(3*MK)+(touches.size>0||Object.values(keys).some(v=>v)?0.6:0));
        player.act=(player.act||0)+(want-(player.act||0))*(want>(player.act||0)?0.08:0.006); AUDIO.act=isFinite(player.act)?player.act:0; }   // release ~ 5 s
      try{ AUDIO.self(player.mass/MK,(red.spread||0)*COARSE,red.elong||1,pan,player.dead); }catch(e){ AUDIO.panic(e); }
      if(SIM.frame%2===0){ const r=world.rooms.find(r=>player.x>=r.x0&&player.x<=r.x1&&player.y>=r.y0&&player.y<=r.y1); const pb=SIM.probeBuf;
        try{ AUDIO.music({frame:SIM.frame,room:r?r.i:(player.roomI||0),x:player.x,y:player.y,srcs:SRCS,speed:Math.hypot(pb[0],pb[1]),vy:pb[1],mass:player.mass/MK,stamina:player.stamina,pan,dead:player.dead,cold:(player.coldT||0)>20,near:!!(NPC&&NPC.dist<BODY.rnear*2)}); }catch(e){ AUDIO.panic(e); } if(r) player.roomI=r.i; } }
    shake*=0.85;
  }

  // ---------- camera / render ----------
  let camX=0,camY=0; const ents=new Float32Array(48*4);
  // the simulation runs at a fixed rate in real time: SUBRATE substeps per second, at most MAXSTEPS per frame.
  // a 120 Hz phone takes one substep a frame, a 60 Hz screen two or three; a slow frame never buys extra substeps,
  // so a throttled device slows down evenly instead of swinging between fast and slow.
  const SUBRATE=small?120:180, MAXSTEPS=small?2:3; let acc=0;
  let lastNow=0, dtAvg=16.7; const cam={};
  // off the frame loop, so it keeps running when frames stop: no frames for a second means no sound (the voices
  // would otherwise hold their last level while the page is hidden or the loop is stalled); the stuck-tone
  // detector runs every half second; a heartbeat with the full state goes out every 5 s
  let hbN=0, hbFrame=0, quietFor=false;
  setInterval(()=>{ try{ const now=performance.now(); const stalled=!AUDIO.lastFrame||now-AUDIO.lastFrame>1000;
      if(AUDIO.ctx){ if(stalled){ if(!quietFor){ quietFor=true; AUDIO.panic('no frames'); } } else { quietFor=false; AUDIO.watch(); } }
      if(++hbN%10===0&&window.REPORT){ REPORT('heartbeat',`frames ${SIM.frame-hbFrame} in 5 s`,null,{hidden:document.hidden,stalled,sinceFrame:AUDIO.lastFrame?Math.round(now-AUDIO.lastFrame):null}); hbFrame=SIM.frame; } }catch(e){} },500);
  function frame(now){
    requestAnimationFrame(frame);
    const t0=performance.now();
    if(lastNow){ const dt=Math.min(100,now-lastNow); dtAvg+=(dt-dtAvg)*0.05; acc=Math.min(MAXSTEPS,acc+dt*SUBRATE/1000); } else acc=MAXSTEPS;
    lastNow=now;
    steps=Math.floor(acc); acc-=steps;
    try{ tick(); }catch(e){ if((frame.errs=(frame.errs||0)+1)<=5) console.error('tick',e); AUDIO.panic(e); }
    if(AUDIO.ctx&&AUDIO.beat&&performance.now()-AUDIO.beat>1500&&!AUDIO.muted){ AUDIO.beat=performance.now(); AUDIO.panic('stale voices'); }
    AUDIO.lastFrame=performance.now();
    const vw=sw/zoom, vh=sh/zoom;
    let fx=player.x, fy=player.y; if(NPC&&selves[2].live&&selves[2].npc&&NPC.dist<BODY.rnear*2){ const m0=Math.max(1,player.mass), m2=Math.max(1,selves[2].mass); fx=(player.x*m0+selves[2].x*m2)/(m0+m2); fy=(player.y*m0+selves[2].y*m2)/(m0+m2); }
    { const jx=fx-(cam.fx===undefined?fx:cam.fx), jy=fy-(cam.fy===undefined?fy:cam.fy); const jd=Math.hypot(jx,jy);
      if(jd>20&&!player.camSnap&&window.REPORT&&(cam.rep=(cam.rep||0)+1)<=12) REPORT('camjump',`centroid jumped ${jd.toFixed(0)} cells`,null,{from:[cam.fx|0,cam.fy|0],to:[player.x|0,player.y|0],selves:selves.map(s=>({live:s.live,m:+s.mass.toFixed(1),x:s.x|0,y:s.y|0,age:s.age,lowN:s.lowN})),lowT:player.lowT,lock:player.switchLock,dead:player.dead,far:SIM.red.far&&[SIM.red.far.d|0,SIM.red.far.x|0,SIM.red.far.y|0],tr:cam.rep<=3?TR.slice():undefined});
      const maxStep=2.5*Math.max(1,steps); if(cam.fx===undefined||jd<=maxStep||player.dead||player.camSnap){ cam.fx=fx; cam.fy=fy; if(player.camSnap){ player.camSnap=false; camX=player.x-vw/2; camY=player.y-vh/2; } } else { cam.fx+=jx/jd*maxStep; cam.fy+=jy/jd*maxStep; } }
    const tx=cam.fx-vw/2, ty=cam.fy-vh*(PAD?0.40:0.5);   // on a touch screen the body rides high so the thumb has the lower part
    camX+=(tx-camX)*0.08; camY+=(ty-camY)*0.08;
    camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    const sx=(Math.random()-0.5)*shake, sy=(Math.random()-0.5)*shake;
    let n=0;
    for(const c of cores){ if(!c.alive||n>=48) continue; if(c.x<camX-10||c.x>camX+vw+10||c.y<camY-10||c.y>camY+vh+10) continue; ents[n*4]=c.x; ents[n*4+1]=c.y; ents[n*4+2]=0; ents[n*4+3]=1.8; n++; }
    for(const d of drones){ if(!d.alive||n>=48) continue; if(d.x<camX-10||d.x>camX+vw+10||d.y<camY-10||d.y>camY+vh+10) continue; ents[n*4]=d.x; ents[n*4+1]=d.y; ents[n*4+2]=1; ents[n*4+3]=2.0; n++; }
    SIM.tint=bd.tint; SIM.splitSideR=bd.splitSideR||0;
    SIM.render([camX+sx,camY+sy],zoom,sw,sh,debug,[player.x,player.y,player.dead?0:BODY.rnear,player.facing],ents,n,player.hurt,player.hp);
    drawHud(now-t0);
  }
  function drawHud(ms){
    const c=hctx, s=dpr; c.clearRect(0,0,sw,sh); const pad=6*s;
    if(HASH.hud||BOT.on){ const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='top'; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`mass ${player.mass|0}  ${dtAvg.toFixed(0)}ms ×${steps}`+(BOT.on?`   bot: chamber ${player.cpIndex+1}  deaths ${player.deaths}  t=${(SIM.frame/60)|0}s`:''),pad,pad); }
    if(SCHEME.hud) SCHEME.hud(ctxNow(),c);
    // until iOS lets the sound start (it needs a touch release), say so
    if(!AUDIO.muted&&(touchLog.length>0||Object.keys(keys).length>0)&&(!AUDIO.ctx||AUDIO.ctx.state!=='running')){ const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textAlign='center'; c.textBaseline='bottom'; c.fillStyle='rgba(255,255,255,0.45)'; c.fillText('tap once for sound',sw/2,sh-(26+(window.safeBottom||0))*s); c.textAlign='left'; c.textBaseline='top'; }
    // thin bars at the bottom: stamina, and attention left in the attention scheme. only there when something is being spent.
    { const bars=[]; if(!player.dead&&player.stamina!==undefined){ const st=player.dissoc>0?0:player.stamina; if(st<0.97||player.dissoc>0) bars.push({v:st,col:player.dissoc>0?'rgba(160,160,170,0.8)':st<0.3?'rgba(255,150,120,0.85)':'rgba(220,235,255,0.7)'}); }
      if(SCHEME.name==='attention'&&SCHEME.st&&SCHEME.st.fat>0.03) bars.push({v:1-SCHEME.st.fat,col:'rgba(200,230,255,0.7)'});
      if(player.alc) bars.push({v:(player.alc.repair||0)/REPAIR_NEED,col:'rgba(255,205,110,0.9)'});
      else if((player.carried||0)>1*MK) bars.push({v:(player.carried||0)/REPAIR_NEED,col:'rgba(255,215,120,0.8)'});   // ore you carry, against what a repair needs
      let by=sh-(14+(window.safeBottom||0))*s; const bw=Math.round(sw*0.28), bx=(sw-bw)/2;
      for(const b of bars){ c.fillStyle='rgba(255,255,255,0.10)'; c.fillRect(bx,by,bw,2*s); c.fillStyle=b.col; c.fillRect(bx,by,bw*Math.max(0,Math.min(1,b.v)),2*s); by-=5*s; } }
    // scheme menu (bottom-right pill; Tab or ` on a keyboard)
    { const fs=Math.round(12*s); c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='middle'; c.textAlign='left';
      const label='≡'; const tw=c.measureText(label).width; const ph=fs*2, pw=tw+fs*1.6; const px=sw-pw-10*s, py=10*s+(window.safeTop||0)*s;
      c.fillStyle=MENU.open?'rgba(60,70,100,0.85)':'rgba(0,0,0,0.25)'; c.beginPath(); c.roundRect(px,py,pw,ph,ph/2); c.fill(); c.fillStyle='rgba(255,255,255,0.9)'; c.fillText(label,px+fs*0.8,py+ph/2);
      MENU.pill={x:px/s,y:py/s,w:pw/s,h:ph/s}; MENU.rows=[];
      if(MENU.open){ const rh=fs*2.2, rw=Math.max(pw,170*s); let ry=py+ph+8*s; const rx=sw-rw-10*s;
        c.fillStyle='rgba(10,12,20,0.92)'; c.beginPath(); c.roundRect(rx,ry-6*s,rw,rh*5+12*s,10*s); c.fill();
        for(const tg of [{l:'music: '+(AUDIO.music?'on':'off'),act:()=>AUDIO.setMusic(!AUDIO.music)},{l:'sound: '+(AUDIO.muted?'off':'on'),act:()=>{AUDIO.muted=!AUDIO.muted;}},{l:'detail: '+(COARSE>1?'half':'full')+'   '+dtAvg.toFixed(0)+'ms ×'+steps,act:()=>{ try{ localStorage.setItem('v2detail',COARSE>1?'full':'half'); }catch(e){} location.reload(); }},{l:`map ${MAPI+1} of ${MAPS.length}   ▸ next`,act:()=>setMap(MAPI+1)},{l:'report a problem now',act:()=>{ if(window.REPORT) REPORT('manual','user tapped report',null,{peak:AUDIO.spectrum&&AUDIO.spectrum(),peaks:AUDIO.peaks}); AUDIO.panic('manual report'); MENU.open=false; }}]){ c.fillStyle='rgba(255,220,160,0.9)'; c.fillText('   '+tg.l,rx+10*s,ry+rh/2); MENU.rows.push({act:tg.act,x:rx/s,y:ry/s,w:rw/s,h:rh/s}); ry+=rh; }
        for(const n of (MENU.showSchemes?MENU.names:[])){ const cur=n===SCHEME.name; c.fillStyle=cur?'rgba(140,200,255,1)':'rgba(255,255,255,0.85)'; c.fillText((cur?'● ':'   ')+n,rx+10*s,ry+rh/2); MENU.rows.push({name:n,x:rx/s,y:ry/s,w:rw/s,h:rh/s}); ry+=rh; } }
      c.textBaseline='top'; }
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
    if(player.won) msg= player.winT<240?`map ${MAPI+1} cleared`:`map ${MAPI+1} cleared · ${player.deaths} deaths · tap or R for map ${(MAPI+1)%MAPS.length+1}`;
    else if(player.dead) msg= player.deadT>120? '' : 'dispersed';
    else if(player.hintT>0) msg=player.hint;
    else if(SIM.frame<600) msg= `map ${MAPI+1} of ${MAPS.length}`;
    else if(SIM.frame<700) msg= isTouch? 'touch the map to set where you want to go · hold still to pull yourself together · second finger: spark' : 'click the map to set where you want to go · hold C to pull yourself together · space: spark · V: views';
    if(msg&&msg.length){ const f2=Math.round(15*s); c.font=`${f2}px -apple-system,Helvetica,Arial,sans-serif`; let lines=[msg]; if(c.measureText(msg).width>sw-pad*6) lines=msg.split(' · '); let my=sh*0.3;
      for(const ln of lines){ const mw=c.measureText(ln).width, mx=(sw-mw)/2; c.fillStyle='rgba(0,0,0,0.45)'; c.fillRect(mx-pad*2,my-pad,mw+pad*4,f2+pad*2); c.fillStyle='#fff'; c.fillText(ln,mx,my); my+=f2+pad*3; } }
  }
  // following a path through the structure, used by the test bot and by another wisp: the nearest path point in line of
  // sight (walls, drains, blades, sources block sight), the farthest visible point up to 40 ahead as the waypoint, and a
  // local breadth-first detour when nothing is visible. st keeps i, full, pathSet, detour, wp.
  function followPath(st,px,py){ const P=st.full; if(!P||!P.length) return null; const W_=world.W, ty=world.type;
    const solidC=(x,y)=>{ if(x<0||y<0||x>=W_||y>=world.H) return true; const t=ty[(y|0)*W_+(x|0)]; return t===1||t===3||t===4||(t>=5&&t<=8)||t===12||t===13; };
    // line of sight for a body, not a ray: the centre line and two parallels half a body radius to each side must all be clear,
    // so a passage the body cannot fit through does not count as visible (it drove into a block corner above a five-cell slot)
    const rr=BODY.rnear*0.5; const los=(x,y)=>{ const dx=x-px, dy=y-py; const L=Math.hypot(dx,dy)||1; const ox=-dy/L*rr, oy=dx/L*rr; const n=Math.ceil(L); for(const [sx,sy] of [[0,0],[ox,oy],[-ox,-oy]]){ for(let k=0;k<=n;k++){ if(solidC(px+sx+dx*k/n,py+sy+dy*k/n)) return false; } } return true; };
    let bi=-1, bd2=1e9; for(let k=Math.max(0,st.i-40);k<Math.min(P.length,st.i+300);k++){ const d=(P[k][0]-px)**2+(P[k][1]-py)**2; if(d<bd2&&los(P[k][0],P[k][1])){ bd2=d; bi=k; } }
    if(bi<0){ if(!st.pathSet){ st.pathSet=new Map(); P.forEach((q,k)=>{ if(!st.pathSet.has(q[1]*W_+q[0])) st.pathSet.set(q[1]*W_+q[0],k); }); }
      const start=(py|0)*W_+(px|0); const prev=new Map([[start,-1]]); const q=[start]; let found=-1, qh=0;
      while(qh<q.length&&qh<40000){ const i=q[qh++]; if(st.pathSet.has(i)&&i!==start){ found=i; break; } const x=i%W_, y=(i/W_)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; const j=ny*W_+nx; if(solidC(nx,ny)||prev.has(j)) continue; prev.set(j,i); q.push(j); } }
      if(found>=0){ bi=st.pathSet.get(found); const route=[]; for(let i=found;i!==-1&&i!==undefined;i=prev.get(i)) route.push(i); route.reverse(); let step=route[Math.min(route.length-1,12)]; for(let k=route.length-1;k>0;k--){ const x=route[k]%W_, y=(route[k]/W_)|0; if(los(x+0.5,y+0.5)){ step=route[k]; break; } } st.detour=[step%W_+0.5,((step/W_)|0)+0.5]; } else { st.detour=null; bi=st.i; }
    } else st.detour=null;
    st.i=bi; let wp=P[bi]; if(!st.detour){ for(let k=Math.min(P.length-1,bi+40);k>bi;k-=2){ if(los(P[k][0],P[k][1])){ wp=P[k]; break; } } } else wp=st.detour;
    st.wp=wp; return {d:_unit(wp[0]-px,wp[1]-py),bi,wp}; }
  // another wisp (roadmap 13): it waits before the first dead alcove, withering slowly outside the cold, until you repair
  // the alcove; then it goes on along the route, resting in each live cold room, until the exit. it is centre slot 2.
  const NPC=(()=>{ if(HASH.lab||!world.legs||HASH.nonpc) return null; const k=world.checkpoints.findIndex(c=>c.dead); if(k<0) return null; const leg=world.legs[k]; if(!leg||leg.length<80) return null; const p=leg[leg.length-45];
    let full=[]; const legEnds=[]; for(let j=k+1;j<world.legs.length;j++){ if(world.legs[j]){ full=full.concat(world.legs[j]); legEnds.push([full.length-1,j]); } }
    return {alc:world.checkpoints[k],x:p[0],y:p[1],ax:p[0],ay:p[1],state:'waiting',i:0,full,legEnds,spawnAt:90,restT:0,rested:new Set(),lowT:0}; })();
  function npcTick(){ if(!NPC||NPC.state==='dead'||NPC.state==='gone') return; const s=selves[2];
    if(NPC.state==='waiting'&&!s.live&&SIM.frame>=NPC.spawnAt&&!pendingInjectB){ s.live=true; s.npc=true; s.x=NPC.x; s.y=NPC.y; s.mass=0; s.hx=0; s.hy=0; s.age=0; pushCentres(); pendingInjectB=[NPC.x,NPC.y,BODY.spawnR,1.0]; NPC.born=SIM.frame; return; }
    if(!s.live||!s.npc) return;
    if(NPC.born&&SIM.frame-NPC.born>120){ NPC.lowT=s.mass<2*MK?NPC.lowT+1:0; if(NPC.lowT>200){ s.live=false; s.npc=false; NPC.state='dead'; pushCentres(); return; } }
    const px=s.mass>0.5?s.x:NPC.x, py=s.mass>0.5?s.y:NPC.y; NPC.x=px; NPC.y=py; let d=[0,0];
    NPC.dist=Math.hypot(player.x-px,player.y-py);
    // friendship: stay embedded in it for three seconds and it comes with you; lose it by staying far away for ten
    if(NPC.state==='waiting'||NPC.state==='going'){ NPC.near=NPC.dist<BODY.rnear*1.3?(NPC.near||0)+1:0; if(NPC.near>180){ NPC.state='friend'; NPC.farT=0; NPC.near=0; AUDIO.tone(523,784,0.5,'sine',0.05); setTimeout(()=>AUDIO.tone(659,988,0.6,'sine',0.045),160); player.hint='a friend · it comes with you now'; player.hintT=420; } }
    if(NPC.state==='friend'){ NPC.farT=NPC.dist>BODY.rfar*1.6?(NPC.farT||0)+1:0;
      if(NPC.farT>600||player.dead){ NPC.state=NPC.alc.repairedAt?'going':'waiting'; NPC.ax=px; NPC.ay=py; NPC.i=0; AUDIO.tone(440,300,0.9,'sine',0.045); player.hint='the friend is gone'; player.hintT=360; }
      else { const dx=player.x-px, dy=player.y-py; if(NPC.dist>BODY.rnear*0.9){ d=[dx/NPC.dist,dy/NPC.dist]; } else { d=[dirS[0]*0.8,dirS[1]*0.8]; } } }   // it keeps near you and moves as you intend
    if(NPC.state==='waiting'){ if(NPC.alc.repairedAt){ NPC.state='going'; NPC.i=0; AUDIO.tone(440,660,0.4,'sine',0.05); } else { const dx=NPC.ax-px, dy=NPC.ay-py; const dd=Math.hypot(dx,dy); if(dd>5) d=[dx/dd*0.6,dy/dd*0.6]; } }
    if(NPC.state==='going'){ const r=followPath(NPC,px,py); if(r){ d=r.d; const le=NPC.legEnds.find(e=>e[0]>=NPC.i-6&&!NPC.rested.has(e[1])); if(le&&NPC.i>=le[0]-6){ if(NPC.restT<300){ NPC.restT++; d=[0,0]; } else { NPC.rested.add(le[1]); NPC.restT=0; } }
        if(NPC.i>=NPC.full.length-8){ NPC.state='gone'; s.npc=false; pushCentres(); } } }
    s.hx=d[0]; s.hy=d[1]; bd.npcGrow=0.05*Math.max(0,1-s.mass/BODY.massMax); bd.friend=NPC.state==='friend'?1:0; }
  // bot mode (?bot=1): a guided body follows the static path through the level with the attention drive.
  // it is the dynamic completability test: currents, fans, heat, stamina and withering all act on it.
  const BOT=HASH.bot? {on:true,path:null,i:+HASH.boti||0,arrivals:[],lastCp:-1,t0:0} : {on:false};
  if(BOT.on){
    BOT.legs=CHECK.route(world,COARSE>1?1:3);
    BOT.full=[]; BOT.legEnds=[]; for(const leg of BOT.legs){ if(leg) BOT.full=BOT.full.concat(leg); BOT.legEnds.push(BOT.full.length-1); }
    SCHEME.useTarget=false;
    const base=SCHEME.tick; SCHEME.tick=(cx)=>{ if(base&&SCHEME.name!=='target') base.call(SCHEME,cx);
      const px=cx.player.x, py=cx.player.y; const fr=followPath(BOT,px,py); if(!fr) return; let d=fr.d; const bi=fr.bi;
      { const le=BOT.legEnds[player.cpIndex]; if(le!==undefined&&player.cpIndex<world.checkpoints.length&&!world.checkpoints[player.cpIndex].dead&&bi>=le-6&&(BOT.wait||0)<600){ BOT.wait=(BOT.wait||0)+1; d=[0,0]; } else if(le!==undefined&&bi<le-6) BOT.wait=0; }   // arrived at a cold room: stay until it registers
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
    const fakeTouch=(wx,wy,hold)=>{ player.ft=(player.ft||0)+1; const sx=(wx-camX)*zoom/dpr, sy=(wy-camY)*zoom/dpr; const ev={t:performance.now(),x:wx,y:wy,sx,sy,id:99,up:0,dur:0}; touchLog.push(ev); const ev0={t:ev.t,x:player.x,y:player.y,sx:(player.x-camX)*zoom/dpr,sy:(player.y-camY)*zoom/dpr,id:99,up:0,dur:0}; if(SCHEME.onDown) SCHEME.onDown(ctxNow(),ev0); if(SCHEME.onMove) SCHEME.onMove(ctxNow(),ev);   // a fake touch starts on the body and moves to the offset, so pad and pointer modes both see it
      if(hold){ touches.set(99,{x0:sx,y0:sy,x:sx,y:sy,t:performance.now(),moved:false,primary:true}); } else { ev.up=performance.now()+50; ev.dur=50; if(SCHEME.onUp) SCHEME.onUp(ctxNow(),ev); }
      if(SCHEME.useTarget!==false){ target.x=wx; target.y=wy; target.set=performance.now(); } };
    let bestX=0, stuck=0;
    for(let i=0;i<N;i++){ if(HASH.touch&&i===5){ const [tx,ty]=HASH.touch.split(',').map(Number); fakeTouch(player.x+tx,player.y+ty,HASH.touchHold!=='0'); } if(HASH.tapEvery&&i%+HASH.tapEvery===0){ const [tx,ty]=(HASH.touch||'60,0').split(',').map(Number); fakeTouch(player.x+tx,player.y+ty,false); } if(i===6) player.tgt6=target.x; if(i===20) player.tgt20=target.x;
      if(HASH.ax){ keys.KeyD=true; if(player.x>bestX+2){ bestX=player.x; stuck=0; } else stuck++; player.maxX=bestX; keys.KeyW=stuck>40&&((stuck/120)|0)%2===0; keys.KeyS=stuck>40&&((stuck/120)|0)%2===1; if(stuck>600){ keys.KeyA=true; keys.KeyD=false; if(stuck>700) stuck=0; } else keys.KeyA=false; } if(ig&&i===+HASH.ignite){ player.x=ig.x-20; player.y=ig.y+10; sparkQ=true; player.facing=1; inject={x:ig.x,y:ig.y,r:6,fuel:0,heat:1.5,smoke:0,life:0}; SIM.step(PARAMS,inject,bd); } tick(); if(HASH.trace&&i%+HASH.trace===0) trace.push(`${i}:${player.mass.toFixed(0)}@${player.x.toFixed(0)},${player.y.toFixed(0)}`+(BOT.on?`#${BOT.i}c${player.cpIndex+1}d${player.deaths}u${SIM.probeBuf[0].toFixed(2)},${SIM.probeBuf[1].toFixed(2)}w${BOT.wp?BOT.wp[0]|0:'-'},${BOT.wp?BOT.wp[1]|0:'-'}st${(player.stamina||0).toFixed(2)}e${(SIM.red.elong||0).toFixed(1)}`:'')); }
    SIM.gl.finish(); const ms=performance.now()-t0;
    const vw=sw/zoom, vh=sh/zoom; camX=(+HASH.cx||player.x)-vw/2; camY=(+HASH.cy||player.y)-vh/2; camX=Math.max(0,Math.min(W-vw,camX)); camY=Math.max(0,Math.min(H-vh,camY));
    SIM.render([camX,camY],zoom,sw,sh,+HASH.dbg||0,[player.x,player.y,BODY.rnear,1],ents,0,0,1);
    SIM.probe(probePts,64); const [pb]=SIM.collect();
    document.title=`test ${BOT.on?'BOT arrivals '+JSON.stringify(BOT.arrivals)+' deaths '+player.deaths+' won '+player.won+' at '+(player.x|0)+','+(player.y|0)+' pathIdx '+BOT.i+'/'+BOT.full.length+' legs '+BOT.legs.map(l=>l?l.length:'x').slice(0,4).join(',')+' mass '+(player.mass|0)+' | ':''}DBG ft=${player.ft} tgt6=${player.tgt6} tgt20=${player.tgt20} dirS=${dirS.map(v=>v.toFixed(2))} bddir=${bd.dir.map(v=>v.toFixed(2))} simdirs=${Array.from(SIM.dirs.slice(0,2)).map(v=>v.toFixed(2))} swim=${bd.swim} st=${player.stamina} diss=${player.dissoc} tgt=${target.x} nC=${SIM.nC} centres=${Array.from(SIM.centres.slice(0,2)).map(v=>v|0)} | ${N} ticks ${ms.toFixed(0)}ms player ${player.x.toFixed(0)},${player.y.toFixed(0)} mass ${player.mass.toFixed(0)} selves ${selves.filter(s=>s.live).map(s=>s.mass.toFixed(0)).join('/')} spread ${(SIM.red.spread||0).toFixed(1)} elong ${(SIM.red.elong||0).toFixed(2)} deaths ${player.deaths} cores ${player.cores} kills ${player.kills||0} hp ${player.hp.toFixed(2)} u ${pb[0].toFixed(3)},${pb[1].toFixed(3)} heat ${pb[2].toFixed(2)} glerr ${SIM.gl.getError()} npc ${NPC?NPC.state+'/'+(selves[2].mass|0)+'@'+(selves[2].x|0)+','+(selves[2].y|0)+'/i'+NPC.i:'-'} charged ${player.charged||0} orbs ${world.orbs?world.orbs.length:0} paytot ${(()=>{ let t=0; for(let k=40;k<64;k++) t+=SIM.probeBuf2[k*4+1]; return (t*9).toFixed(1); })()} cellmap ${HASH.cell?(()=>{ const [cx,cy]=HASH.cell.split(',').map(Number); const rows=[]; for(let y=cy-5;y<=cy+5;y++){ let r=''; for(let x=cx-16;x<=cx+16;x++){ const t=world.type[y*W+x]; const m=SIM.maskData[(y*W+x)*4]; r+= (x===cx&&y===cy)?'@': t===12?'O': t===13?'X': t===1?'#': t===6?'C': t===2?'V': t===3?'D': t===0?(m===0?'.':'?'):String(t); } rows.push(r); } return rows.join('/'); })():'-'} pay ${SIM.probeBuf2[1].toFixed(2)} alc ${player.alc?(player.alc.repair||0).toFixed(1)+'/'+REPAIR_NEED.toFixed(0)+(player.alc.dead?'':' repaired'):'-'} repaired ${world.checkpoints.filter(c=>c.repairedAt).length} vB ${AUDIO.vB?AUDIO.vB.o.frequency.value.toFixed(0)+'Hz/'+AUDIO.vB.g.gain.value.toFixed(4):'-'} elong ${(SIM.red.elong||0).toFixed(1)} panics ${AUDIO.panics||0} music ${AUDIO.near?AUDIO.near.length+'/'+AUDIO.deg+'/'+(AUDIO.root|0):'-'} rooms ${world.rooms.length} trace ${trace.join(' ')}`;
  } else requestAnimationFrame(frame);
})();
