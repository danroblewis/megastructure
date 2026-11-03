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

// 1. CONSISTENCY — Marcia's identity statuses. Hold a spot to lean toward it (no persistence); the self consolidates or diffuses according to how consistent your leaning has been.
SCHEMES.consistency={name:'consistency',blurb:'hold a spot to lean toward it · the self holds together only as consistently as you lean over time',useTarget:false,
  st:{c:0.2,status:'diffusion',dirs:[]},
  onDown(ctx,ev){ this.st.dirs.push({t:ev.t,d:_unit(ev.x-ctx.player.x,ev.y-ctx.player.y)}); if(this.st.dirs.length>60) this.st.dirs.shift(); this.cur={x:ev.x,y:ev.y}; },
  onMove(ctx,ev){ if(this.cur){ this.cur.x=ev.x; this.cur.y=ev.y; } },
  tick(ctx){ const s=this.st, now=ctx.now, bd=ctx.bd; const held=ctx.touches.size>0&&this.cur;
    if(held){ const d=_unit(this.cur.x-ctx.player.x,this.cur.y-ctx.player.y); ctx.dirS[0]+=(d[0]-ctx.dirS[0])*0.08; ctx.dirS[1]+=(d[1]-ctx.dirS[1])*0.08; } else { ctx.dirS[0]*=0.96; ctx.dirS[1]*=0.96; }
    bd.dir[0]=ctx.dirS[0]; bd.dir[1]=ctx.dirS[1];
    const rec=_recent(s.dirs,now,120000); let c; if(rec.length<3) c=0.15; else { const R=_resultant(rec.map(e=>e.d)); const gaps=[]; for(let i=1;i<rec.length;i++) gaps.push(rec[i].t-rec[i-1].t); c=0.65*R+0.35/(1+_cv(gaps)); }
    const since=s.dirs.length?now-s.dirs[s.dirs.length-1].t:1e9; if(since>20000) c*=Math.max(0,1-(since-20000)/60000);
    s.c+=(c-s.c)*0.01; c=s.c; s.status= c<0.3?'diffusion': c<0.6?'moratorium':'achievement';
    bd.coh*=0.5+1.5*c; bd.swim*=0.3+1.0*c; bd.push*=0.3+1.0*c; bd.grow*=0.3+1.5*c; bd.dense=0.55+0.7*c; bd.tint=[0.9,0.95,1.0,0.5*(1-c)]; },
  hud(ctx,c){ if(!location.hash.includes('hud')) return; const s=ctx.dpr; c.font=`${Math.round(11*s)}px sans-serif`; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`${this.st.status} ${this.st.c.toFixed(2)}`,6*s,30*s); }};

// 2. APPETITES — emotions processed linearly on three chemical axes. No targets: the self chases one chemical at a time; a tap moves on to the next.
SCHEMES.appetites={name:'appetites',blurb:'no steering · the self chases one chemical at a time · tap the screen or press space to move on to the next appetite',useTarget:false,
  cycle:[{n:'seeks cold',a:[0,0,1],t:[0.4,0.7,1.0]},{n:'seeks fuel',a:[0,1,0],t:[0.4,1.0,0.5]},{n:'seeks heat',a:[1,0,0],t:[1.0,0.55,0.25]},{n:'flees cold',a:[0,0,-1],t:[0.8,0.8,0.6]},{n:'flees fuel',a:[0,-1,0],t:[0.8,0.6,0.9]},{n:'flees heat',a:[-1,0,0],t:[0.6,0.8,1.0]}],
  st:{i:0,flash:0},
  onDown(ctx){ this.st.i=(this.st.i+1)%this.cycle.length; this.st.flash=90; ctx.AUDIO.tone(300+this.st.i*60,300+this.st.i*60,0.12,'sine',0.05); },
  tick(ctx){ const cy=this.cycle[this.st.i]; const a=cy.a; const bd=ctx.bd; bd.app=a; bd.tint=[cy.t[0],cy.t[1],cy.t[2],0.6]; bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0; if(ctx.keys.Space&&!this.sp){ this.onDown(ctx); } this.sp=!!ctx.keys.Space; if(this.st.flash>0) this.st.flash--; },
  hud(ctx,c){ if(this.st.flash<=0) return; const s=ctx.dpr; c.font=`${Math.round(14*s)}px sans-serif`; c.fillStyle=`rgba(255,255,255,${Math.min(1,this.st.flash/30)})`; const w=c.measureText(this.cycle[this.st.i].n).width; c.fillText(this.cycle[this.st.i].n,(ctx.sw-w)/2,ctx.sh*0.62); }};

// 3. BREATH — rhythm and entrainment. Hold to inhale (gather), release to exhale a puff from the side you touched. A steady rhythm consolidates the self.
SCHEMES.breath={name:'breath',blurb:'hold the screen or the space bar to breathe in · let go to breathe out away from your finger or mouse · a steady rhythm holds you together',useTarget:false,
  st:{exh:0,ex:[0,0],coh:0.5,ups:[]},
  onUp(ctx,ev){ const s=this.st; s.ups.push(ev.up); if(s.ups.length>12) s.ups.shift(); const d=_unit(ctx.player.x-ev.x,ctx.player.y-ev.y); s.ex=d; s.exh=45+Math.min(60,ev.dur/40); ctx.AUDIO.noise(0.35,0.12,900);
    if(s.ups.length>=4){ const gaps=[]; for(let i=1;i<s.ups.length;i++) gaps.push(s.ups[i]-s.ups[i-1]); const reg=1/(1+_cv(gaps)*2); s.coh+=(reg-s.coh)*0.3; } },
  tick(ctx){ const s=this.st, bd=ctx.bd; const holding=ctx.touches.size>0||ctx.keys.Space;
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    if(ctx.keys.Space&&!this.sp){ this.t0=ctx.now; } if(!ctx.keys.Space&&this.sp){ const h=ctx.hover; const ex= h&&h.set? {x:h.x,y:h.y} : {x:ctx.player.x-10,y:ctx.player.y}; this.onUp(ctx,{x:ex.x,y:ex.y,up:ctx.now,dur:ctx.now-(this.t0||ctx.now)}); } this.sp=!!ctx.keys.Space;
    if(holding){ bd.dense=1.4; bd.coh*=2.2; bd.grow*=1.6; bd.grip=0.6; bd.radial=-0.006; }
    else if(s.exh>0){ s.exh--; bd.dir[0]=s.ex[0]; bd.dir[1]=s.ex[1]; bd.push=0.09*(0.5+s.coh); bd.swim=0.12; bd.radial=0.008; bd.dense=0.7; bd.grip=1.0; }
    bd.coh*=0.6+0.9*s.coh; bd.grow*=0.5+s.coh; }};

// 4. INTEGRATE / DIFFERENTIATE — differentiation sees what seemed alike as different: the self sorts itself by what its matter has lived through.
// integration sees what seemed different as one: all of it comes together regardless. Tap a separated part to make it your centre.
SCHEMES.integrate={name:'integrate / differentiate',blurb:'two fingers (or D) to differentiate: matter sorts by what it has lived through · one finger (or I) to integrate: all of it is one · tap a part to centre on it',useTarget:false,
  st:{mode:0,t:0},
  onDown(ctx,ev){ const sv=ctx.selves; for(let i=1;i<3;i++){ if(sv[i].live&&sv[i].mass>6&&Math.hypot(sv[i].x-ev.x,sv[i].y-ev.y)<18){ const tmp=sv[0]; sv[0]=sv[i]; sv[i]=tmp; ctx.AUDIO.tone(500,700,0.15,'sine',0.06); return; } } },
  tick(ctx){ const s=this.st, bd=ctx.bd; const n=ctx.touches.size;
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    if(n>=2||ctx.keys.KeyD) s.mode=1; else if(n===1||ctx.keys.KeyI||ctx.keys.Space) s.mode=-1;
    if(s.mode===1){ bd.splitStr=0.26; bd.coh*=0.45; bd.dense=0.7; bd.splitSideR=1; }
    else if(s.mode===-1){ bd.splitStr=-0.16; bd.coh*=2.5; bd.dense=1.3; bd.grow*=1.5; bd.splitSideR=0.25; }
    else { bd.splitSideR=0.25; }
    if(n===0&&!ctx.keys.KeyD&&!ctx.keys.KeyI&&!ctx.keys.Space){ s.t++; if(s.t>150) s.mode=0; } else s.t=0; }};

// 5. ATTENTION — hold a spot to attend to it; the self drifts toward what is attended; attention tires when held too long and recovers when released.
SCHEMES.attention={name:'attention',blurb:'hold a spot to attend to it · the self drifts toward what you attend · attention tires if held too long',useTarget:false,
  st:{fat:0,spots:[],focus:1},
  // on a touch screen the finger is a pad, not a pointer: where you first touch is an origin, and the attended spot is the body
  // plus your finger's displacement from it (scaled), so your thumb can rest low on the screen while the spot sits near the body
  onDown(ctx,ev){ this.st.spots.push({t:ev.t,x:ev.x,y:ev.y,sx0:ev.sx,sy0:ev.sy,ax:ctx.player.x,ay:ctx.player.y,rel:ctx.pad?[0,0]:null}); if(this.st.spots.length>40) this.st.spots.shift(); },
  onMove(ctx,ev){ const sp=this.st.spots[this.st.spots.length-1]; if(!sp) return; if(sp.rel){ const g=2.2*ctx.dpr/ctx.zoom; sp.rel=[(ev.sx-sp.sx0)*g,(ev.sy-sp.sy0)*g]; sp.x=sp.ax+sp.rel[0]; sp.y=sp.ay+sp.rel[1]; } else { sp.x=ev.x; sp.y=ev.y; } },   // the point is anchored where the body was when you touched down, so it stays put if the body splits
  tick(ctx){ const s=this.st, bd=ctx.bd; const held=ctx.touches.size>0; const sp=s.spots[s.spots.length-1];
    const active=held&&sp&&(!sp.rel||Math.hypot(sp.rel[0],sp.rel[1])>2);
    if(active){ s.fat=Math.min(1,s.fat+1/600); const str=1-0.5*s.fat; const d=_unit(sp.x-ctx.player.x,sp.y-ctx.player.y); ctx.dirS[0]+=(d[0]*str-ctx.dirS[0])*0.15; ctx.dirS[1]+=(d[1]*str-ctx.dirS[1])*0.15; s.linger=1; s.lx=sp.x; s.ly=sp.y; s.lstr=str; }
    else { s.fat=Math.max(0,s.fat-1/150); ctx.dirS[0]*=0.992; ctx.dirS[1]*=0.992; s.linger=(s.linger||0)*0.992; }   // the point you attended lingers for a few seconds after you let go
    if(s.linger>0.05) bd.spot=[s.lx,s.ly,s.lstr*s.linger,1]; else bd.spot=[0,0,0,0];   // every cell steers to the point on its own (see SH.bodyVel uSpot)
    bd.dir[0]=ctx.dirS[0]; bd.dir[1]=ctx.dirS[1]; bd.swim*=1.4;
    const distinct=_recent(s.spots,ctx.now,60000).length; const focus=1/(1+distinct*0.25); s.focus+=(focus-s.focus)*0.02;
    bd.coh*=0.6+1.4*s.focus; bd.grow*=0.4+1.2*s.focus; bd.dense=0.6+0.7*s.focus; bd.tint=[0.3,0.35,0.5,0.6*s.fat]; },
  hud(ctx,c){ const s=this.st, d=ctx.dpr; const sp=s.spots[s.spots.length-1]; const held=ctx.touches.size>0&&sp;
  }};

// 6. MEMORY — three layers of retention. Each touch is remembered as a direction in a short, a medium and a long trace; the self moves by their sum. Burning wipes the medium trace.
SCHEMES.memory={name:'memory',blurb:'each touch is remembered in three layers · the self moves by what it remembers · pain erases the middle layer',useTarget:false,
  st:{s:[0,0],m:[0,0],l:[0,0],n:0},
  onDown(ctx,ev){ const d=_unit(ev.x-ctx.player.x,ev.y-ctx.player.y); const s=this.st; s.s=[s.s[0]+d[0],s.s[1]+d[1]]; s.m=[s.m[0]+d[0]*0.6,s.m[1]+d[1]*0.6]; s.n++; s.l=[s.l[0]+(d[0]-s.l[0])/Math.min(s.n,60),s.l[1]+(d[1]-s.l[1])/Math.min(s.n,60)]; },
  tick(ctx){ const s=this.st, bd=ctx.bd; const k1=Math.exp(-1/180), k2=Math.exp(-1/3600); s.s=[s.s[0]*k1,s.s[1]*k1]; s.m=[s.m[0]*k2,s.m[1]*k2];
    if(ctx.player.burning>2){ s.m=[s.m[0]*0.9,s.m[1]*0.9]; if(!s.painT||ctx.now-s.painT>1500){ s.painT=ctx.now; ctx.AUDIO.tone(260,70,0.5,'sawtooth',0.07); s.flash=40; } }
    if(s.flash>0){ s.flash--; bd.tint=[1.0,0.4,0.3,Math.min(1,s.flash/20)]; }
    const vx=0.6*s.s[0]+0.3*s.m[0]+0.35*s.l[0], vy=0.6*s.s[1]+0.3*s.m[1]+0.35*s.l[1]; const mag=Math.min(1,Math.hypot(vx,vy)); const d=_unit(vx,vy);
    ctx.dirS[0]=d[0]*mag; ctx.dirS[1]=d[1]*mag; bd.dir[0]=ctx.dirS[0]; bd.dir[1]=ctx.dirS[1];
    const ident=Math.hypot(s.l[0],s.l[1]); bd.coh*=0.6+1.4*ident; bd.grow*=0.5+1.0*ident; bd.dense=0.6+0.7*ident; }};

// 7. PRESENCE — IFS. Self is always here. The one input is Self-energy: while held, parts unburden and come home; released, parts act on their burdens.
SCHEMES.presence={name:'presence',blurb:'hold the screen or the space bar to be present: calm, dense, carried · let go and hunger drives you toward fuel, or a large part drives you toward its burden',useTarget:false,
  burdens:[[1,0,0],[0,1,0],[0,0,1],[-1,0,0]],
  st:{b:{}},
  tick(ctx){ const bd=ctx.bd, sv=ctx.selves; const held=ctx.touches.size>0||ctx.keys.Space;
    bd.swim=0; bd.push=0; bd.dir[0]=0; bd.dir[1]=0; ctx.dirS[0]=0; ctx.dirS[1]=0;
    for(let i=1;i<3;i++){ const g=sv[i]; if(g.live&&g.burden===undefined) g.burden=this.burdens[(Math.random()*this.burdens.length)|0]; if(!g.live) g.burden=undefined; }
    if(held){ for(let i=1;i<3;i++){ if(sv[i].live){ sv[i].hx*=0.9; sv[i].hy*=0.9; } } bd.coh*=2.0; bd.grow*=1.5; bd.dense=1.2; ctx.SIM.nC=1; }   // all parts home to Self
    else { let big=null; for(let i=1;i<3;i++){ if(sv[i].live&&(!big||sv[i].mass>big.mass)) big=sv[i]; }
      if(big&&big.mass>sv[0].mass*0.5&&big.burden){ bd.app=big.burden; bd.tint=[1.0,0.6,0.4,0.5]; }   // a large part blends: its burden moves the whole
      else { bd.app=[0,1,0]; bd.tint=[0.5,1.0,0.5,0.4]; } } }};

// 8. TEMPO — a mood from the statistics of your touching (Lovheim-style three axes): tap tempo = arousal, hold length = contentment, spread of touches = seeking.
SCHEMES.tempo={name:'tempo',blurb:'touch where you want to go · fast taps make you quick and loose (white) · long holds make you calm and dense (blue) · wide touching makes you hungry for fuel (green)',useTarget:true,
  st:{a:0.3,s:0.5,d:0.3},
  tick(ctx){ const st=this.st, bd=ctx.bd, now=ctx.now; const rec=_recent(ctx.touchLog,now,30000);
    const tempo=rec.length/30; const a=Math.min(1,tempo/1.5);
    const holds=rec.filter(e=>e.up).map(e=>e.dur); const mh=holds.length?holds.reduce((x,y)=>x+y,0)/holds.length:0; const s=Math.min(1,mh/1500);
    let d=0; if(rec.length>=2){ const mx=rec.reduce((x,e)=>x+e.sx,0)/rec.length, my=rec.reduce((x,e)=>x+e.sy,0)/rec.length; const sp=Math.sqrt(rec.reduce((x,e)=>x+(e.sx-mx)**2+(e.sy-my)**2,0)/rec.length); d=Math.min(1,sp/250); }
    st.a+=(a-st.a)*0.02; st.s+=(s-st.s)*0.02; st.d+=(d-st.d)*0.02;
    bd.swim*=0.3+1.4*st.a; bd.push*=0.3+1.4*st.a; bd.coh*=1.6-1.0*st.a+0.8*st.s; bd.grow*=0.3+1.5*st.s; bd.dense=0.65+0.6*st.s; bd.app=[0,st.d*0.8,0];
    bd.tint=[0.5+0.5*st.a, 0.5+0.4*st.d, 0.5+0.5*st.s, 0.55]; },
  hud(ctx,c){ if(!location.hash.includes('hud')) return; const s=ctx.dpr; c.font=`${Math.round(11*s)}px sans-serif`; c.fillStyle='rgba(255,255,255,0.6)'; c.fillText(`arousal ${this.st.a.toFixed(2)} content ${this.st.s.toFixed(2)} seeking ${this.st.d.toFixed(2)}`,6*s,30*s); }};
