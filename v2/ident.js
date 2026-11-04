// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
'use strict';
const STATUS_WORD=['','diffusion','moratorium','achievement','negative identity'];
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  // 11. statuses — Marcia without commitment. The status is a property of the whole body over time, never of a cell and never a
  // choice: diffusion when nothing holds (dispersed, parts, mass falling, dissociated), moratorium while the configuration is still
  // changing (split, growing, turning, entering a current), achievement when whatever configuration it has reached has held for a
  // while (a ball, a streak in a jet, two lobes round a pillar: the model does not know shapes, only rates of change), and negative
  // identity when that stability was reached in a place that keeps hurting (heat, the organism, exhaustion, no cold anywhere near).
  // Stability itself is rewarded (cohesion, regrowth, full steering); negative identity gets the same reward, which is the trap:
  // it is attainable and it holds. Leaving it means moving, and moving is moratorium, so the bonus is lost for a while. A choice.
  statuses:{id:11,name:'statuses',blurb:'identity as what happens to be stable: diffusion, moratorium, achievement, negative identity, decided for the whole body from its rates of change',
    // tuning: stability is a band on the difference between a fast and a slow view of the configuration (spread, elongation,
    // mass, motion relative to the gas). TA ticks inside the band is achievement; leaving needs the band exceeded for a few ticks.
    TA:75, TH:0.28, TH_OUT:0.45, HARM:0.35,
    reset(p){ this.st={f:null,s:null,flux:0,stable:0,harm:0,status:0,k:0,since:0,out:0,parts:0,log:[]}; if(p){ p.status=undefined; p.statusK=0; p.statusLog=this.st.log; } },
    tick(ctx){
      const p=ctx.player, red=ctx.red, bd=ctx.bd, B=ctx.BODY; if(!this.st) this.reset(p); const st=this.st; p.statusLog=st.log; st.t=(st.t||0)+1;   // st.t: ticks since the model started (lab ticks in the lab)
      if(!red||!red.clusters||red.clusters.length<3) return;
      const main=ctx.selves[0]; const m=main.live?main.mass:0;
      const S=red.spread||0, E=red.elong||1; const rx=(p.vx||0)-(ctx.ux||0), ry=(p.vy||0)-(ctx.uy||0);   // motion relative to the gas: a streak riding a jet is still
      const now={S,E,M:m,X:rx,Y:ry};
      if(!st.f||p.respawnT>=28){ st.f={...now}; st.s={...now}; st.stable=0; }
      else { for(const k of ['X','Y']) now[k]=Math.max(st.f[k]-0.03,Math.min(st.f[k]+0.03,now[k])); }   // one bad flow reading cannot flip an identity (real accelerations are slower); the shape terms are left raw: clamping a noisy one turns its fast view into a random walk
      const f=st.f, s=st.s; for(const k in now){ f[k]+=(now[k]-f[k])/8; s[k]+=(now[k]-s[k])/45; }
      // how fast the configuration is changing, as fast-minus-slow, each term scaled so ~1 is a real change of shape or motion
      const cS=Math.abs(f.S-s.S)/Math.max(3,s.S)*3, cE=Math.abs(f.E-s.E)/Math.max(1,s.E)*1.5, cM=Math.abs(f.M-s.M)/Math.max(10,s.M)*3, cV=Math.hypot(f.X-s.X,f.Y-s.Y)/0.15;
      st.flux=Math.max(cS,cE,cM,cV); st.cmp=[cS,cE,cM,cV].map(v=>+v.toFixed(2));
      const MK=ctx.MK||1; const parts=ctx.selves.filter((q,k)=>k>0&&q.live&&!q.npc&&q.mass>6*MK).length;
      if(parts>st.parts) st.lostAt=st.t; st.parts=parts;
      // harm, slow (about two seconds): heat at the body, burning cells, the organism in or round the body, exhaustion, no cold room anywhere near
      let h=0; const heat=ctx.heat||0; if(heat>0.2) h=Math.max(h,Math.min(1,(heat-0.2)*2.5)); if((red.burning||0)>1.5*MK) h=Math.max(h,0.6);
      if(ctx.pb2){ let org=0; for(let k=0;k<64;k++) org=Math.max(org,ctx.pb2[k*4+2]); if(org>0.05) h=Math.max(h,Math.min(1,org*4)); }
      if(p.stamina!==undefined&&p.stamina<0.35) h=Math.max(h,(0.35-p.stamina)/0.35);
      { const cps=ctx.world.checkpoints; if(cps&&cps.length){ let d=1e9; for(const c of cps){ if(c.dead) continue; d=Math.min(d,Math.hypot(c.x-p.x,c.y-p.y)); } if(d>420) h=Math.max(h,0.3); } }
      st.harm+=(h-st.harm)/120;
      // the status, for the body as a whole
      const massMax=B.massMax; let want;
      if(p.respawnT>0&&!p.dead) want=2;
      else if(p.dead||p.dissoc>0||(p.lowT||0)>0||parts>=2||(m<0.3*massMax&&f.M<s.M-0.3)) want=1;
      else if(parts>=1) want=2;
      else { const inBand=st.flux<(st.status>=3?this.TH_OUT:this.TH); st.out=inBand?0:st.out+1;
        if(st.status>=3) want=st.out>8?2:(st.harm>this.HARM?4:(st.harm<this.HARM*0.7?3:st.status));
        else { st.stable=inBand?st.stable+1:0; want=st.stable>=this.TA?(st.harm>this.HARM?4:3):2; } }
      if(want===1) st.stable=0;
      if(want!==st.status){ const from=st.status; st.status=want; st.since=st.t; st.k=(from>=3&&want>=3)?st.k:0;
        st.log.push({t:st.t,from:STATUS_WORD[from],to:STATUS_WORD[want]}); if(st.log.length>60) st.log.shift();
        if(from>0&&!p.dead){ p.hint=want===1?'diffusion · nothing holds':want===2?'moratorium · in between':want===3?(from===4?'achievement · the harm is gone':'achievement · this is stable, whatever it is'):'negative identity · stable, and it hurts · leaving costs the stability for a while'; p.hintT=150; } }
      // strength: a bonus arrives over a second, diffusion deepens as the body thins, moratorium is as strong as the change
      if(st.status>=3) st.k=Math.min(1,st.k+1/60); else { const want_k= st.status===1? Math.max(0.4,Math.min(1,1-m/(0.5*massMax))) : Math.min(1,0.4+st.flux/this.TH*0.6); st.k+=(want_k-st.k)*0.1; }
      p.status=STATUS_WORD[st.status]||undefined; p.statusK=st.k; p.statusDbg={flux:+st.flux.toFixed(2),stable:st.stable,harm:+st.harm.toFixed(2),parts,cmp:st.cmp,raw:[S,E,m,p.vx||0,p.vy||0,ctx.ux||0,ctx.uy||0].map(v=>+v.toFixed(3)),fs:[f.X,s.X,f.Y,s.Y].map(v=>+v.toFixed(3))};
      bd.status=st.status; bd.statusK=st.k;
      if(st.status===1) bd.grow*=1-0.5*st.k; else if(st.status>=3) bd.grow*=1+0.6*st.k;   // regrowth follows the status; cohesion and steering are applied per cell in the shader
    },
    hud(ctx,c){ const p=ctx.player; if(!p.status||p.dead) return; const s=ctx.dpr; const st=this.st;
      const col= st.status===1?'rgba(170,170,180,0.55)': st.status===2?'rgba(255,200,130,0.55)': st.status===3?'rgba(255,248,225,0.6)':'rgba(255,170,160,0.65)';
      c.font=`${Math.round(11*s)}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='bottom'; c.textAlign='left'; c.fillStyle=col;
      c.fillText(p.status,10*s,ctx.sh-(10+(window.safeBottom||0))*s);
      if(st.status===4){ c.fillStyle=`rgba(200,40,50,${0.35+0.35*Math.sin(ctx.now/400)})`; c.fillRect(10*s,ctx.sh-(8+(window.safeBottom||0))*s,c.measureText(p.status).width,1.5*s); }   // the mark of something wrong in it
      c.textBaseline='top'; },
  },
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
