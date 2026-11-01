// game.js — rendering, input, main loop
'use strict';
(function(){
  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d',{alpha:false});
  let cellPx=4, viewW=0, viewH=0, off=null, octx=null, img=null, buf=null;
  let camX=0, camY=0;
  const MARGIN=20;

  const probe=document.createElement('div'); probe.style.cssText='position:fixed;top:0;left:0;width:0;height:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none'; document.body.appendChild(probe);
  function resize(){
    const w=window.innerWidth, h=window.innerHeight;
    window.safeTop=parseFloat(getComputedStyle(probe).paddingTop)||0;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    cellPx=Math.max(3,Math.min(7,Math.floor(Math.min(w,h)/120)));
    viewW=Math.ceil(w/cellPx)+1; viewH=Math.ceil(h/cellPx)+1;
    canvas.width=Math.floor(w*dpr); canvas.height=Math.floor(h*dpr);
    off=document.createElement('canvas'); off.width=viewW; off.height=viewH; octx=off.getContext('2d');
    img=octx.createImageData(viewW,viewH); buf=new Uint32Array(img.data.buffer);
    ctx.imageSmoothingEnabled=false;
  }
  window.addEventListener('resize',resize);

  // ---------- audio (procedural, created on first gesture) ----------
  const AUDIO={ ctx:null, crackle:null, crackleGain:null, muted:false,
    init(){ if(this.ctx) return; try{ const C=window.AudioContext||window.webkitAudioContext; this.ctx=new C();
      const sr=this.ctx.sampleRate, buf=this.ctx.createBuffer(1,sr*2,sr), d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; this.noiseBuf=buf;
      const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true; const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=0.7;
      const g=this.ctx.createGain(); g.gain.value=0; src.connect(f); f.connect(g); g.connect(this.ctx.destination); src.start(); this.crackleGain=g; }catch(e){} },
    tone(f0,f1,dur,type,vol){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(), g=this.ctx.createGain();
      o.type=type||'square'; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
      g.gain.setValueAtTime(vol||0.08,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur+0.02); },
    noise(dur,vol,freq,type){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const s=this.ctx.createBufferSource(); s.buffer=this.noiseBuf; const f=this.ctx.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.setValueAtTime(freq,t); f.frequency.exponentialRampToValueAtTime(Math.max(40,freq*0.2),t+dur);
      const g=this.ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0005,t+dur); s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t); s.stop(t+dur+0.02); },
    play(ev){
      const [k,arg]=ev.split(':');
      switch(k){
        case 'jump': this.tone(300,620,0.12,'square',0.05); break;
        case 'land': { const v=+arg||1; this.noise(0.12+v*0.03,Math.min(0.3,0.05*v),500+v*200); break; }
        case 'stomp': this.tone(500,120,0.18,'square',0.1); this.noise(0.15,0.15,1200); break;
        case 'gold': this.tone(880,880,0.08,'sine',0.08); setTimeout(()=>this.tone(1320,1320,0.14,'sine',0.08),70); break;
        case 'hurt': this.tone(200,90,0.18,'sawtooth',0.08); break;
        case 'die': this.tone(400,40,0.7,'sawtooth',0.12); this.noise(0.6,0.2,800); break;
        case 'splash': this.noise(0.3,0.18,900,'bandpass'); break;
        case 'hiss': this.noise(0.5,0.12,3000,'highpass'); break;
        case 'ignite': this.noise(0.4,0.2,1500,'bandpass'); this.tone(120,60,0.3,'sawtooth',0.05); break;
        case 'grab': this.noise(0.08,0.05,2500,'bandpass'); break;
        case 'spray': this.noise(0.1,0.04,1800,'highpass'); break;
        case 'blasted': this.tone(160,40,0.4,'sawtooth',0.1); break;
        case 'boom': { const near=Math.max(0.05,1-(+arg||0)/120); this.noise(0.9,0.6*near,400); this.tone(90,30,0.8,'sine',0.4*near); break; }
        case 'win': [523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,f,0.3,'square',0.08),i*120)); break;
      }
    },
    setCrackle(v){ if(this.crackleGain) this.crackleGain.gain.setTargetAtTime(Math.min(0.2,v),this.ctx.currentTime,0.1); },
  };
  let shake=0, shakeX=0, shakeY=0;
  SIM.onExplode=(cx,cy,r)=>{ PLAYER.blast(cx,cy,r); const d=Math.hypot(cx-PLAYER.ax,cy-PLAYER.ay+4); shake=Math.max(shake,Math.max(0,r*1.2-d*0.03)); AUDIO.play('boom:'+d); };

  // ---------- input ----------
  const keys={};
  const HASH=Object.fromEntries(location.hash.slice(1).split('&').filter(Boolean).map(kv=>kv.split('=')));
  const BOT=HASH.bot?+HASH.bot||1:0;
  const inp={dir:0,up:false,down:false,jump:false,jumpHeld:false,grab:false,spray:false};
  let jumpQueued=false;
  window.addEventListener('keydown',e=>{ AUDIO.init(); if(e.ctx&&e.ctx.state==='suspended') e.ctx.resume(); if(e.repeat) return; keys[e.code]=true;
    if(e.code==='KeyM') AUDIO.muted=!AUDIO.muted;
    if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'||e.code==='KeyZ'||e.code==='KeyK') jumpQueued=true;
    if(e.code==='KeyR' && (PLAYER.dead||PLAYER.won)) restart();
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  window.addEventListener('keyup',e=>{ keys[e.code]=false; });

  const touches=new Map(); // id -> {x0,y0,x,y,role}
  function ptrDown(e){ AUDIO.init(); if(AUDIO.ctx&&AUDIO.ctx.state==='suspended') AUDIO.ctx.resume(); const role = e.clientX < window.innerWidth*0.5 ? 'move' : 'jump'; touches.set(e.pointerId,{x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,role,t:performance.now(),jumped:false}); if(role==='jump') jumpQueued=true; if(PLAYER.dead||PLAYER.won&&PLAYER.winTime>120) restart(); e.preventDefault(); }
  function ptrMove(e){ const t=touches.get(e.pointerId); if(!t) return; t.x=e.clientX; t.y=e.clientY; e.preventDefault(); }
  function ptrUp(e){ touches.delete(e.pointerId); e.preventDefault(); }
  canvas.addEventListener('pointerdown',ptrDown); canvas.addEventListener('pointermove',ptrMove);
  canvas.addEventListener('pointerup',ptrUp); canvas.addEventListener('pointercancel',ptrUp); canvas.addEventListener('pointerout',ptrUp);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

  function readInput(){
    let dir=0, up=false, down=false, held=false, grab=false, spray=false;
    if(keys.KeyX||keys.KeyJ||keys.ShiftLeft||keys.ShiftRight) grab=true; if(keys.KeyC||keys.KeyL||keys.KeyE) spray=true;
    if(keys.ArrowLeft||keys.KeyA) dir-=1; if(keys.ArrowRight||keys.KeyD) dir+=1;
    if(keys.ArrowUp||keys.KeyW) up=true; if(keys.ArrowDown||keys.KeyS) down=true;
    if(keys.Space||keys.ArrowUp||keys.KeyW||keys.KeyZ||keys.KeyK) held=true;
    const dz=Math.max(8,cellPx*2.5);
    for(const t of touches.values()){
      const dx=t.x-t.x0, dy=t.y-t.y0;
      if(t.role==='move'){
        if(dx>dz) dir=1; else if(dx<-dz) dir=-1;
        if(dy<-dz*3.5){ up=true; held=true; if(!t.jumped){ jumpQueued=true; t.jumped=true; } }
        else { t.jumped=false; }
        if(dy>dz*3) down=true;
      } else {
        // right thumb: hold = jump/swim, drag down = grab, drag sideways = spray (toward facing)
        if(dy>dz*2.5){ grab=true; t.mode='grab'; }
        else if(Math.abs(dx)>dz*2.5){ spray=true; t.mode='spray'; if(dx>0&&dy<-dz*2.5) up=true; if(dy>dz) down=true; }
        else if(t.mode){ /* keep the chosen tool while the finger lingers */ if(t.mode==='grab') grab=true; else spray=true; }
        else { held=true; up=true; }
      }
    }
    if(BOT){ dir=1; held=true; if(SIM.frame%45===0) jumpQueued=true; if(SIM.frame<BOT) { dir=0; } }
    inp.dir=dir; inp.up=up; inp.down=down; inp.jumpHeld=held; inp.grab=grab; inp.spray=spray; inp.jump=jumpQueued; jumpQueued=false;
  }

  // ---------- rendering ----------
  const bgRow=new Uint32Array(1); let bgTable=null;
  function buildBg(){
    const H=WORLD.H; bgTable=new Uint32Array(H);
    for(let y=0;y<H;y++){
      let r,g,b;
      const t=Math.min(1,y/230); r=90+t*80; g=150+t*60; b=230-t*30;
      bgTable[y]=(255<<24)|((b|0)<<16)|((g|0)<<8)|(r|0);
    }
  }
  function clamp8(v){ return v<0?0:v>255?255:v|0; }
  const EMISSIVE=new Uint8Array(T.COUNT);
  [T.FIRE,T.LAVA,T.TORCH,T.EMBER,T.SPARK,T.CRYSTAL,T.GOLD,T.SPORE,T.ACID,T.SLIME,T.PLAYER,T.PLAYERHEAD,T.FLAG,T.FUNGUS,T.BOUNCE].forEach(t=>EMISSIVE[t]=1);

  function render(){
    const W=SIM.W,H=SIM.H,c=SIM.cells,m=SIM.meta,sh=SIM.shade,surf=WORLD.surface;
    const camXs=camX+shakeX, camYs=camY+shakeY;
    const cx0=Math.floor(camXs), cy0=Math.floor(camYs);
    const fr=SIM.frame;
    const hurt=PLAYER.hurtFlash>0, burning=PLAYER.burning>0, wet=PLAYER.wet>0, oily=PLAYER.oily>0, slimed=PLAYER.slimed>0;
    let fireCount=0;
    for(let vy=0;vy<viewH;vy++){
      const y=cy0+vy; const rowOut=vy*viewW;
      if(y<0||y>=H){ const col = y<0?bgTable[0]:bgTable[H-1]; for(let vx=0;vx<viewW;vx++) buf[rowOut+vx]=col; continue; }
      const row=y*W; const bg=bgTable[y];
      for(let vx=0;vx<viewW;vx++){
        const x=cx0+vx;
        if(x<0||x>=W){ buf[rowOut+vx]=bg; continue; }
        const i=row+x, t=c[i];
        if(t===T.EMPTY){
          // underground: dark earthy backdrop that deepens with depth
          const d=y-surf[x];
          if(d>0){ const f=Math.max(0.12,1-d/70); const r=(44*f)|0,g=(36*f)|0,b=(40*f)|0; buf[rowOut+vx]=(255<<24)|(b<<16)|(g<<8)|r; }
          else buf[rowOut+vx]=bg;
          continue;
        }
        const col=COLOR[t]; let r=col[0],g=col[1],b=col[2]; const v=((sh[i]-128)/128)*col[3];
        r+=v; g+=v; b+=v;
        switch(t){
          case T.FIRE: { fireCount++; const l=m[i]; const k=Math.min(1,l/20); r=255; g=80+k*140+((sh[i]&31)); b=20+k*40*(sh[i]&1); break; }
          case T.LAVA: { const p=Math.sin((fr*0.08)+sh[i]*0.1)*25; r=235+p*0.3; g=90+p+((sh[i]&15)); b=20; break; }
          case T.WATER: { const p=Math.sin(fr*0.05+x*0.3+y*0.7+sh[i])*10; r=30+p; g=105+p; b=215+p; break; }
          case T.ACID: { const p=Math.sin(fr*0.1+sh[i])*20; g=230+p*0.5; r=140+p; break; }
          case T.GOLD: { if(((fr+sh[i])&63)<4){ r=255; g=255; b=220; } break; }
          case T.SPORE: { const k=Math.min(1,m[i]/80); r=120+k*80; g=80+k*60; b=200+k*55; break; }
          case T.SPARK: { r=255; g=220+ (sh[i]&31); b=120; break; }
          case T.FLAG: { if(((x+y)&3)<2){ r=250; g=250; b=250; } break; }
          case T.STEAM: { const k=Math.min(1,m[i]/80); r=g=b=180+k*60; break; }
          case T.SMOKE: { const k=Math.min(1,m[i]/50); r=g=b=50+k*40; break; }
          case T.PLAYER: { const p=m[i]; if(p===1){ r=30; g=30; b=40; } else if(p===2){ r=70; g=130; b=220; } else if(p===3){ r=60; g=60; b=90; } else if(p===4){ r=90; g=60; b=40; }
            if(oily){ r*=0.6; g*=0.6; b*=0.6; } if(wet){ b=Math.min(255,b+50); r*=0.85; } if(slimed&&p!==1){ g=Math.min(255,g+70); }
            if(burning&&((fr+sh[i])&3)<2){ r=255; g=120+(sh[i]&63); b=30; }
            if(hurt){ r=255; g=90; b=90; } break; }
          case T.PLAYERHEAD: { if(oily){ r*=0.6; g*=0.6; b*=0.6; } if(burning&&((fr+sh[i])&3)<2){ r=255; g=140; b=30; } if(hurt){ r=255; g=90; b=90; } break; }
          case T.CRYSTAL: { const p=Math.sin(fr*0.07+sh[i])*30; b=255; r=170+p; g=110+p; break; }
          case T.TORCH: { if(((fr>>2)+sh[i])&1){ r+=30; g+=20; } break; }
          case T.EMBER: { const p=Math.sin(fr*0.15+sh[i])*40; r=200+p*0.5; g=60+p; b=20; break; }
          case T.CLOUD: { r=g=b=225+((sh[i]&15)); break; }
        }
        if(!EMISSIVE[t]){
          const d=y-surf[x];
          if(d>8){ const f=Math.max(0.3,1-(d-8)/60); r*=f; g*=f; b*=f; }
        }
        buf[rowOut+vx]=(255<<24)|(clamp8(b)<<16)|(clamp8(g)<<8)|clamp8(r);
      }
    }
    octx.putImageData(img,0,0);
    AUDIO.setCrackle(fireCount/500);
    const fx=(camXs-cx0)*cellPx, fy=(camYs-cy0)*cellPx;
    const sx=canvas.width/window.innerWidth, sy=canvas.height/window.innerHeight;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(off,0,0,viewW,viewH,-fx*sx,-fy*sy,viewW*cellPx*sx,viewH*cellPx*sy);
    drawHud(sx);
  }

  function drawHud(s){
    const w=canvas.width, h=canvas.height;
    const fs=Math.round(13*s); ctx.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; ctx.textBaseline='top';
    const pct=Math.min(100,Math.floor(PLAYER.maxX/WORLD.flagX*100));
    const alt=Math.max(0,WORLD.surface[30]-PLAYER.minY), depth=Math.max(0,PLAYER.maxY-WORLD.surface[30]);
    const hp=PLAYER.aliveCount();
    let pouch='';
    if(PLAYER.pouch.length){ const top=PLAYER.pouch[PLAYER.pouch.length-1]&255; pouch=`   ✦ ${PLAYER.pouch.length} (${NAMES[top]})`; }
    const st=[]; if(PLAYER.burning) st.push('BURNING!'); else if(PLAYER.oily) st.push('oily'); if(PLAYER.wet) st.push('wet'); if(PLAYER.slimed) st.push('slimed'); if(PLAYER.onIce) st.push('ice!');
    if(st.length) pouch+='   '+st.join(' ');
    const txt=`gold ${PLAYER.gold}   →${pct}%   ↑${alt}  ↓${depth}   hp ${hp}/${PLAYER.slots.length||20}   kills ${CREATURES.kills}${pouch}`;
    const pad=6*s, top=(window.safeTop||0)*s+pad;
    ctx.fillStyle='rgba(0,0,0,0.35)'; const tw=ctx.measureText(txt).width; ctx.fillRect(pad,top,tw+pad*2,fs+pad*1.2);
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fillText(txt,pad*2,top+pad*0.6);
    // controls legend, pinned to the upper right
    const touch=('ontouchstart' in window);
    const legend = touch ? [
      'LEFT THUMB',  'drag ←→  move', 'swipe ↑  jump', 'drag ↓  sink / climb down',
      'RIGHT THUMB', 'tap  jump · hold  swim', 'drag ↓  grab (digs)', 'drag ←→  spray',
      'stomp slimes · drown wisps' ]
    : [ 'CONTROLS', '←→ / A D  move', 'space / W  jump', 'S  sink / climb down', 'X  grab (digs)', 'C  spray', 'R  restart',
        'stomp slimes · drown wisps', 'M  mute' ];
    const fl=Math.round(11*s); ctx.font=`${fl}px -apple-system,Helvetica,Arial,sans-serif`; ctx.textAlign='right';
    let lw=0; for(const ln of legend) lw=Math.max(lw,ctx.measureText(ln).width);
    const lh=fl*1.35, lx=w-pad, ly=top;
    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(lx-lw-pad*2,ly,lw+pad*2,lh*legend.length+pad);
    legend.forEach((ln,k)=>{ const header=ln===ln.toUpperCase()&&ln.length<14; ctx.fillStyle=header?'rgba(255,220,120,0.95)':'rgba(255,255,255,0.85)'; ctx.fillText(ln,lx-pad,ly+pad*0.5+k*lh); });
    ctx.textAlign='left';
    // centre messages for big moments only
    let msg=null;
    if(PLAYER.won) msg = PLAYER.winTime<240? 'YOU REACHED THE FLAG!' : `Flag reached · ${PLAYER.gold} gold · ${CREATURES.kills} kills · ${PLAYER.deaths} deaths · tap or R to play again`;
    else if(PLAYER.dead) msg='you crumbled...';
    else if(SIM.frame<600) msg='reach the flag far to the right · sky islands and deep caves hold gold';
    if(msg){ const f2=Math.round(15*s); ctx.font=`${f2}px -apple-system,Helvetica,Arial,sans-serif`;
      let lines=[msg]; if(ctx.measureText(msg).width>w-pad*6) lines=msg.split(' · ');
      let my=h*0.3;
      for(const ln of lines){ const mw=ctx.measureText(ln).width; const mx=(w-mw)/2;
        ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(mx-pad*2,my-pad,mw+pad*4,f2+pad*2); ctx.fillStyle='#fff'; ctx.fillText(ln,mx,my); my+=f2+pad*3; } }
  }

  // ---------- loop ----------
  let last=performance.now(), acc=0; const STEP=1000/60;
  function restart(){ generateWorld(HASH.seed?+HASH.seed:(Math.random()*1e9)|0); PLAYER.gold=0; PLAYER.maxX=0; PLAYER.minY=9999; PLAYER.maxY=0; PLAYER.won=false; PLAYER.deaths=0; PLAYER.stomps=0; CREATURES.reset(); if(HASH.x){ const x=+HASH.x; PLAYER.spawn(x,WORLD.surface[x]-10); } else PLAYER.spawn(WORLD.spawn.x,WORLD.spawn.y); SIM.frame=0; camX=PLAYER.ax-viewW/2; camY=PLAYER.ay-4-viewH*0.55; }
  function tick(){
    readInput();
    PLAYER.update(inp);
    for(const ev of PLAYER.events){ AUDIO.play(ev); if(ev.startsWith('land:')&&+ev.slice(5)>2.2) shake=Math.max(shake,1.5); if(ev==='stomp') shake=Math.max(shake,1.2); if(ev==='die') shake=Math.max(shake,3); }
    if(PLAYER.won && PLAYER.winTime===1) AUDIO.play('win');
    PLAYER.events.length=0;
    shake*=0.85; if(shake<0.05) shake=0; shakeX=(Math.random()-0.5)*shake*2; shakeY=(Math.random()-0.5)*shake*2;
    const x0=Math.floor(camX)-MARGIN, y0=Math.floor(camY)-MARGIN;
    CREATURES.update(x0,y0,x0+viewW+MARGIN*2,y0+viewH+MARGIN*2);
    stepRegion(x0,y0,x0+viewW+MARGIN*2,y0+viewH+MARGIN*2);
    // camera
    const tx=PLAYER.ax+PLAYER.facing*viewW*0.08-viewW/2, ty=PLAYER.ay-4-viewH*0.55;
    const k=PLAYER.justSpawned?1:0.08; PLAYER.justSpawned=false;
    camX+=(tx-camX)*k; camY+=(ty-camY)*k;
    camX=Math.max(0,Math.min(SIM.W-viewW,camX)); camY=Math.max(-viewH*0.3,Math.min(SIM.H-viewH+2,camY));
  }
  function frame(now){
    let dt=now-last; last=now; if(dt>100) dt=100; acc+=dt; let n=0;
    while(acc>=STEP && n<3){ tick(); acc-=STEP; n++; }
    if(acc>=STEP) acc=0;
    render();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{ last=performance.now(); acc=0; });
  resize(); buildBg(); restart();
  requestAnimationFrame(frame);
})();
