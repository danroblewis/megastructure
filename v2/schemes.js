// schemes.js — interaction schemes built on psychological models. None of them is "steering".
// Each scheme reads the PATTERN of what the player does and lets it into the body's rules.
// API: {name, blurb, useTarget, onDown(ctx,ev), onMove, onUp, tick(ctx), hud(ctx,c)}
'use strict';
const SCHEMES={};
const _unit=(x,y)=>{ const d=Math.hypot(x,y)||1; return [x/d,y/d]; };
const _recent=(log,now,ms)=>log.filter(e=>now-e.t<ms);
function _resultant(vs){ if(!vs.length) return 0; let x=0,y=0; for(const v of vs){ x+=v[0]; y+=v[1]; } return Math.hypot(x,y)/vs.length; }
function _cv(xs){ if(xs.length<2) return 1; const m=xs.reduce((a,b)=>a+b,0)/xs.length; const v=xs.reduce((a,b)=>a+(b-m)*(b-m),0)/xs.length; return m>0?Math.sqrt(v)/m:1; }

// 0. the main-branch behaviour, for comparison
SCHEMES.target={name:'target',blurb:'touch the map to set where you want to go (the main branch)',useTarget:true,tick(){}};

// 1. CONSISTENCY — Marcia's identity statuses. The self consolidates or diffuses according to how consistent your touching has been.
SCHEMES.consistency={name:'consistency',blurb:'touch where you want to go · the self holds together only as consistently as you do',useTarget:true,
  st:{c:0.2,status:'diffusion',stuckT:0,lastD:1e9},
  onDown(ctx,ev){ ev.dir=_unit(ev.x-ctx.player.x,ev.y-ctx.player.y); },
  tick(ctx){ const s=this.st, now=ctx.now; const rec=_recent(ctx.touchLog,now,120000).filter(e=>e.dir);
    let c; if(rec.length<3) c=0.15; else { const R=_resultant(rec.map(e=>e.dir)); const gaps=[]; for(let i=1;i<rec.length;i++) gaps.push(rec[i].t-rec[i-1].t); const reg=1/(1+_cv(gaps)); c=0.6*R+0.4*reg; }
    const since=ctx.touchLog.length?now-ctx.touchLog[ctx.touchLog.length-1].t:1e9; if(since>20000) c*=Math.max(0,1-(since-20000)/60000);   // left alone, it diffuses
    // foreclosure: what you keep reaching for cannot be reached
    const t=ctx.target; if(t.x!==null){ const d=Math.hypot(t.x-ctx.player.x,t.y-ctx.player.y); if(d>s.lastD-0.05) s.stuckT++; else s.stuckT=0; s.lastD=d; if(s.stuckT>1200){ s.stuckT=0; t.x=null; s.c*=0.4; ctx.AUDIO.tone(300,120,0.6,'sine',0.05); } }
    s.c+=(c-s.c)*0.01; c=s.c;
    s.status= c<0.3?'diffusion': c<0.6?'moratorium':'achievement';
    const bd=ctx.bd; bd.coh*=0.5+1.5*c; bd.swim*=0.3+1.0*c; bd.push*=0.3+1.0*c; bd.grow*=0.3+1.5*c; bd.dense=0.55+0.7*c; },
  hud(ctx,c){ if(!ctx.SIM.frame||!location.hash.includes('hud')) return; const s=ctx.dpr; c.font=`${Math.round(11*s)}px sans-serif`; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`${this.st.status} ${this.st.c.toFixed(2)}`,6*s,30*s); }};

// 2. APPETITES — emotions processed linearly on three chemical axes. No targets: the self chases one chemical at a time; a tap moves on to the next.
SCHEMES.appetites={name:'appetites',blurb:'no steering · the self chases one chemical at a time · tap to move on to the next appetite',useTarget:false,
  cycle:[{n:'seeks heat',a:[1,0,0]},{n:'seeks fuel',a:[0,1,0]},{n:'seeks cold',a:[0,0,1]},{n:'flees heat',a:[-1,0,0]},{n:'flees fuel',a:[0,-1,0]},{n:'flees cold',a:[0,0,-1]}],
  st:{i:0,flash:0},
  onDown(ctx){ this.st.i=(this.st.i+1)%this.cycle.length; this.st.flash=90; ctx.AUDIO.tone(300+this.st.i*60,300+this.st.i*60,0.12,'sine',0.05); },
  tick(ctx){ const a=this.cycle[this.st.i].a; const bd=ctx.bd; bd.app=a; bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0; if(ctx.keys.Space&&!this.sp){ this.onDown(ctx); } this.sp=!!ctx.keys.Space; if(this.st.flash>0) this.st.flash--; },
  hud(ctx,c){ if(this.st.flash<=0) return; const s=ctx.dpr; c.font=`${Math.round(14*s)}px sans-serif`; c.fillStyle=`rgba(255,255,255,${Math.min(1,this.st.flash/30)})`; const w=c.measureText(this.cycle[this.st.i].n).width; c.fillText(this.cycle[this.st.i].n,(ctx.sw-w)/2,ctx.sh*0.62); }};

// 3. BREATH — rhythm and entrainment. Hold to inhale (gather), release to exhale a puff from the side you touched. A steady rhythm consolidates the self.
SCHEMES.breath={name:'breath',blurb:'hold to breathe in and gather · let go to breathe out from where you touched · a steady rhythm holds you together',useTarget:false,
  st:{exh:0,ex:[0,0],coh:0.5,ups:[]},
  onUp(ctx,ev){ const s=this.st; s.ups.push(ev.up); if(s.ups.length>12) s.ups.shift(); const d=_unit(ctx.player.x-ev.x,ctx.player.y-ev.y); s.ex=d; s.exh=28+Math.min(40,ev.dur/60); ctx.AUDIO.noise(0.35,0.12,900);
    if(s.ups.length>=4){ const gaps=[]; for(let i=1;i<s.ups.length;i++) gaps.push(s.ups[i]-s.ups[i-1]); const reg=1/(1+_cv(gaps)*2); s.coh+=(reg-s.coh)*0.3; } },
  tick(ctx){ const s=this.st, bd=ctx.bd; const holding=ctx.touches.size>0||ctx.keys.Space;
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    if(ctx.keys.Space&&!this.sp){ this.t0=ctx.now; } if(!ctx.keys.Space&&this.sp){ this.onUp(ctx,{x:ctx.player.x+(ctx.player.vx||0.01)*-10,y:ctx.player.y,up:ctx.now,dur:ctx.now-(this.t0||ctx.now)}); } this.sp=!!ctx.keys.Space;
    if(holding){ bd.dense=1.4; bd.coh*=2.2; bd.grow*=1.6; bd.grip=0.5; }
    else if(s.exh>0){ s.exh--; bd.dir[0]=s.ex[0]; bd.dir[1]=s.ex[1]; bd.push=0.05*(0.5+s.coh); bd.radial=0.004; bd.dense=0.7; }
    bd.coh*=0.6+0.9*s.coh; bd.grow*=0.5+s.coh; }};

// 4. INTEGRATE / DIFFERENTIATE — pinch open to split into halves with opposite appetites; pinch closed (or hold one finger) to merge.
SCHEMES.integrate={name:'integrate / differentiate',blurb:'pinch open to divide into two halves that want opposite things · pinch closed or hold to merge · keys: D divides, I merges',useTarget:false,
  st:{mode:0,axis:[1,0],t:0},
  tick(ctx){ const s=this.st, bd=ctx.bd; const pts=[...ctx.touches.values()];
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    if(pts.length>=2){ const a=pts[0], b=pts[1]; const d=Math.hypot(b.x-a.x,b.y-a.y), d0=Math.hypot(b.x0-a.x0,b.y0-a.y0); s.axis=_unit(b.x-a.x,b.y-a.y); s.mode= d>d0+20?1 : d<d0-20?-1 : s.mode; }
    else if(pts.length===1){ s.mode=-1; }
    if(ctx.keys.KeyD){ s.mode=1; } if(ctx.keys.KeyI||ctx.keys.Space){ s.mode=-1; }
    if(s.mode===1){ bd.splitAxis=s.axis; bd.splitStr=0.22; bd.splitApp=1; bd.app=[1,0,0]; bd.coh*=0.5; bd.dense=0.7; }
    else if(s.mode===-1){ bd.splitAxis=s.axis; bd.splitStr=-0.18; bd.coh*=2.5; bd.dense=1.3; bd.grow*=1.5; }
    else { bd.app=[0,0,0.4]; }
    if(pts.length===0&&!ctx.keys.KeyD&&!ctx.keys.KeyI&&!ctx.keys.Space){ s.t++; if(s.t>120){ s.mode=0; } } else s.t=0; }};

// 5. ATTENTION — hold a spot to attend to it; the self drifts toward what is attended; attention tires when held too long and recovers when released.
SCHEMES.attention={name:'attention',blurb:'hold a spot to attend to it · the self drifts toward what you attend · attention tires if held too long',useTarget:false,
  st:{fat:0,spots:[],focus:1},
  onDown(ctx,ev){ this.st.spots.push({t:ev.t,x:ev.x,y:ev.y}); if(this.st.spots.length>40) this.st.spots.shift(); },
  onMove(ctx,ev){ const sp=this.st.spots[this.st.spots.length-1]; if(sp){ sp.x=ev.x; sp.y=ev.y; } },
  tick(ctx){ const s=this.st, bd=ctx.bd; const held=ctx.touches.size>0; const sp=s.spots[s.spots.length-1];
    if(held&&sp){ s.fat=Math.min(1,s.fat+1/360); const str=1-s.fat; const d=_unit(sp.x-ctx.player.x,sp.y-ctx.player.y); ctx.dirS[0]+=(d[0]*str-ctx.dirS[0])*0.1; ctx.dirS[1]+=(d[1]*str-ctx.dirS[1])*0.1; }
    else { s.fat=Math.max(0,s.fat-1/240); ctx.dirS[0]*=0.95; ctx.dirS[1]*=0.95; }
    bd.dir[0]=ctx.dirS[0]; bd.dir[1]=ctx.dirS[1];
    const distinct=_recent(s.spots,ctx.now,60000).length; const focus=1/(1+distinct*0.25); s.focus+=(focus-s.focus)*0.02;
    bd.coh*=0.6+1.4*s.focus; bd.grow*=0.4+1.2*s.focus; bd.dense=0.6+0.7*s.focus; },
  hud(ctx,c){ const s=this.st; if(ctx.touches.size===0) return; const sp=s.spots[s.spots.length-1]; if(!sp) return; const d=ctx.dpr; const px=(sp.x-ctx.camX)*ctx.zoom, py=(sp.y-ctx.camY)*ctx.zoom; c.strokeStyle=`rgba(200,220,255,${0.6*(1-s.fat)})`; c.lineWidth=2*d; c.beginPath(); c.arc(px,py,(6+10*s.fat)*d,0,6.283); c.stroke(); }};

// 6. MEMORY — three layers of retention. Each touch is remembered as a direction in a short, a medium and a long trace; the self moves by their sum. Burning wipes the medium trace.
SCHEMES.memory={name:'memory',blurb:'each touch is remembered in three layers · the self moves by what it remembers · pain erases the middle layer',useTarget:false,
  st:{s:[0,0],m:[0,0],l:[0,0],n:0},
  onDown(ctx,ev){ const d=_unit(ev.x-ctx.player.x,ev.y-ctx.player.y); const s=this.st; s.s=[s.s[0]+d[0],s.s[1]+d[1]]; s.m=[s.m[0]+d[0]*0.6,s.m[1]+d[1]*0.6]; s.n++; s.l=[s.l[0]+(d[0]-s.l[0])/Math.min(s.n,60),s.l[1]+(d[1]-s.l[1])/Math.min(s.n,60)]; },
  tick(ctx){ const s=this.st, bd=ctx.bd; const k1=Math.exp(-1/180), k2=Math.exp(-1/3600); s.s=[s.s[0]*k1,s.s[1]*k1]; s.m=[s.m[0]*k2,s.m[1]*k2];
    if(ctx.player.burning>2){ s.m=[s.m[0]*0.9,s.m[1]*0.9]; }
    const vx=0.6*s.s[0]+0.3*s.m[0]+0.35*s.l[0], vy=0.6*s.s[1]+0.3*s.m[1]+0.35*s.l[1]; const mag=Math.min(1,Math.hypot(vx,vy)); const d=_unit(vx,vy);
    ctx.dirS[0]=d[0]*mag; ctx.dirS[1]=d[1]*mag; bd.dir[0]=ctx.dirS[0]; bd.dir[1]=ctx.dirS[1];
    const ident=Math.hypot(s.l[0],s.l[1]); bd.coh*=0.6+1.4*ident; bd.grow*=0.5+1.0*ident; bd.dense=0.6+0.7*ident; }};

// 7. PRESENCE — IFS. Self is always here. The one input is Self-energy: while held, parts unburden and come home; released, parts act on their burdens.
SCHEMES.presence={name:'presence',blurb:'hold anywhere to be present · parts calm and come home while you are · let go and they act on what burdens them',useTarget:false,
  burdens:[[1,0,0],[0,1,0],[0,0,1],[-1,0,0]],
  st:{b:{}},
  tick(ctx){ const bd=ctx.bd, sv=ctx.selves; const held=ctx.touches.size>0||ctx.keys.Space;
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    for(let i=1;i<3;i++){ const g=sv[i]; if(g.live&&g.burden===undefined) g.burden=this.burdens[(Math.random()*this.burdens.length)|0]; if(!g.live) g.burden=undefined; }
    if(held){ for(let i=1;i<3;i++){ if(sv[i].live){ sv[i].hx*=0.9; sv[i].hy*=0.9; } } bd.coh*=2.0; bd.grow*=1.5; bd.dense=1.2; ctx.SIM.nC=1; }   // all parts home to Self
    else { let big=null; for(let i=1;i<3;i++){ if(sv[i].live&&(!big||sv[i].mass>big.mass)) big=sv[i]; }
      if(big&&big.mass>sv[0].mass*0.5&&big.burden){ bd.app=big.burden; }   // a large part blends: its burden moves the whole
      else bd.app=[0,0,0.5]; } }};

// 8. TEMPO — a mood from the statistics of your touching (Lovheim-style three axes): tap tempo = arousal, hold length = contentment, spread of touches = seeking.
SCHEMES.tempo={name:'tempo',blurb:'touch where you want to go · how fast, how long and how widely you touch becomes the mood of the body',useTarget:true,
  st:{a:0.3,s:0.5,d:0.3},
  tick(ctx){ const st=this.st, bd=ctx.bd, now=ctx.now; const rec=_recent(ctx.touchLog,now,30000);
    const tempo=rec.length/30; const a=Math.min(1,tempo/1.5);
    const holds=rec.filter(e=>e.up).map(e=>e.dur); const mh=holds.length?holds.reduce((x,y)=>x+y,0)/holds.length:0; const s=Math.min(1,mh/1500);
    let d=0; if(rec.length>=2){ const mx=rec.reduce((x,e)=>x+e.sx,0)/rec.length, my=rec.reduce((x,e)=>x+e.sy,0)/rec.length; const sp=Math.sqrt(rec.reduce((x,e)=>x+(e.sx-mx)**2+(e.sy-my)**2,0)/rec.length); d=Math.min(1,sp/250); }
    st.a+=(a-st.a)*0.02; st.s+=(s-st.s)*0.02; st.d+=(d-st.d)*0.02;
    bd.swim*=0.3+1.4*st.a; bd.push*=0.3+1.4*st.a; bd.coh*=1.6-1.0*st.a+0.8*st.s; bd.grow*=0.3+1.5*st.s; bd.dense=0.65+0.6*st.s; bd.app=[0,st.d*0.8,0]; },
  hud(ctx,c){ if(!location.hash.includes('hud')) return; const s=ctx.dpr; c.font=`${Math.round(11*s)}px sans-serif`; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`arousal ${this.st.a.toFixed(2)} content ${this.st.s.toFixed(2)} seeking ${this.st.d.toFixed(2)}`,6*s,30*s); }};
