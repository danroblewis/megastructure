// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  // 10. survival: no new physics for membership. q records each cell's provenance (chamber of birth, exposure, near-deaths) and the
  // ledger below says, at each cold room, what came through, what was lost in the passage and what was gained. awareness, not control.
  survival:{id:10,name:'survival',blurb:'identity is the statistics of what survives: provenance per cell, a ledger at each cold room',
    NCH:64,   // origins: 0..31 chambers, 32..63 the same chambers but born of the other wisp (a part another self made)
    label(i){ return i<32?`born in chamber ${i+1}`:`born of the other wisp · chamber ${i-31}`; },
    hueCss(i){ const h=((0.58+(i%32)*0.13)%1+1)%1; return i<32?`hsl(${Math.round(h*360)},75%,66%)`:`hsl(${Math.round(h*360)},40%,60%)`; },   // the same hue formula as identTint; other-born rows are dulled (the tint gives them a green cast)
    tick(ctx){
      const {player,SIM,frame}=ctx; const N=this.NCH;
      const st=this.st||(this.st={h:new Float64Array(N),near:0,ex:0,mass:0,entries:[],lastCp:0,deaths:0,spawnF:frame,base:false,showT:0});
      const pb2=SIM.probeBuf2, pb3=SIM.probeBuf3; if(!pb3) return;
      // origins histogram over the 6x4 probe grid round the body (probes 40..63): self-weighted chamber of birth, scaled to the body's mass
      if(!player.alc&&!player.dead&&player.mass>0){
        const h=new Float64Array(N); let tot=0, near=0, ex=0;
        for(let k=40;k<64;k++){ const s=pb2[k*4+3]; if(s<=0.01||pb3[k*4+3]<0.05) continue; const i=Math.max(0,Math.min(N-1,Math.round(pb3[k*4])-1)); h[i]+=s; tot+=s; near+=s*pb3[k*4+2]; ex+=s*pb3[k*4+1]; }
        if(tot>0){ const m=player.mass/tot; for(let i=0;i<N;i++) h[i]*=m; near/=tot; ex/=tot;
          const a=0.05; for(let i=0;i<N;i++) st.h[i]+=(h[i]-st.h[i])*a; st.near+=(near-st.near)*a; st.ex+=(ex-st.ex)*a; } }   // smoothed over a third of a second so the ledger does not flicker with the grid
      st.mass=player.mass;
      if(player.deaths!==st.deaths){ st.deaths=player.deaths; st.spawnF=frame; st.base=false; }   // after a death the body is new matter: the ledger starts again at the respawn
      if(!st.base&&frame-st.spawnF>150&&player.mass>0){ st.base=true; this.record(st.deaths>0?'respawn':'spawn',ctx); }
      if(player.cpIndex!==st.lastCp){ st.lastCp=player.cpIndex; if(player.cpIndex>0&&st.base){ this.record('cold room '+player.cpIndex,ctx); st.showT=600; } }
      if(st.showT>0) st.showT--;
    },
    // a ledger entry: the histogram now, and against the previous entry what was lost (per origin) and what was gained
    record(label,ctx){
      const st=this.st, N=this.NCH; const prev=st.entries[st.entries.length-1]||null;
      const e={label,frame:ctx.frame,mass:st.mass,h:Float64Array.from(st.h),near:st.near,ex:st.ex,room:ctx.player.roomI||0,lost:0,lostFrom:-1,gained:0,gainedFrom:-1,prev:prev?prev.label:null,massPrev:prev?prev.mass:0};
      if(prev){ let lm=0, gm=0; for(let i=0;i<N;i++){ const d=e.h[i]-prev.h[i]; if(d<0){ e.lost-=d; if(-d>lm){ lm=-d; e.lostFrom=i; } } else { e.gained+=d; if(d>gm){ gm=d; e.gainedFrom=i; } } } }   // the origin that lost / gained the most
      e.taken=0; for(let i=32;i<N;i++) e.taken+=e.h[i];   // mass born of the other wisp that you carry now: transfer, as opposed to what faded
      st.entries.push(e);
    },
    inCold(ctx){ const p=ctx.player; return (p.coldT||0)>20||ctx.world.checkpoints.some(c=>!c.dead&&Math.abs(c.x-p.x)<c.w/2+6&&Math.abs(c.y-p.y)<c.h/2+6); },
    hud(ctx,c){
      const st=this.st; if(!st||ctx.player.dead) return;
      if(!(this.always||st.showT>0||this.inCold(ctx))) return;
      const s=ctx.dpr, N=this.NCH; const fs=Math.round(10*s), lh=Math.round(13*s); let x=8*s, y=24*s;
      c.font=`${fs}px Menlo,Monaco,monospace`; c.textBaseline='top'; c.textAlign='left';
      const last=st.entries[st.entries.length-1];
      const line=(t,col)=>{ c.fillStyle=col||'rgba(255,255,255,0.75)'; c.fillText(t,x,y); y+=lh; };
      line(`ledger${last?' · '+last.label:''}   mass ${st.mass|0}`,'rgba(255,255,255,0.85)');
      let mx=0; for(let i=0;i<N;i++) mx=Math.max(mx,st.h[i]);
      for(let i=0;i<N;i++){ if(st.h[i]<0.5) continue; const w=Math.round(60*s*st.h[i]/Math.max(1e-6,mx));
        c.fillStyle=this.hueCss(i); c.fillRect(x,y+fs*0.2,w,fs*0.7); c.fillStyle='rgba(255,255,255,0.75)'; c.fillText(`${(st.h[i]|0).toString().padStart(4)}  ${this.label(i)}`,x+64*s,y); y+=lh; }
      if(last&&last.prev){
        line(`lost since ${last.prev}: ${last.lost|0}`+(last.lostFrom>=0?` · mostly ${this.label(last.lostFrom)}`:'')+(last.taken>0.5?`   taken from the other wisp: ${last.taken|0}`:''),'rgba(255,190,170,0.85)');
        line(`gained: ${last.gained|0}`+(last.gainedFrom>=0?` · mostly ${this.label(last.gainedFrom)}`:'')+`   net ${(last.mass-last.massPrev)>=0?'+':''}${(last.mass-last.massPrev)|0}`,'rgba(190,240,190,0.85)'); }
      line(`near-deaths ${st.near.toFixed(2)} per cell · exposure ${st.ex.toFixed(2)}`,'rgba(255,255,255,0.55)');
    },
    // for the headless test title: every entry so far, and the histogram now
    report(ctx){ const st=this.st; if(!st) return '-'; const r=v=>+v.toFixed(1); const hist=h=>{ const o={}; for(let i=0;i<this.NCH;i++) if(h[i]>=0.5) o[(i<32?'ch':'other')+(i%32+1)]=h[i]|0; return o; };
      return JSON.stringify({now:{mass:st.mass|0,h:hist(st.h),near:r(st.near),ex:r(st.ex),room:ctx.player.roomI||0},entries:st.entries.map(e=>({label:e.label,t:e.frame,mass:e.mass|0,h:hist(e.h),lost:e.lost|0,lostFrom:e.lostFrom>=0?this.label(e.lostFrom):null,gained:e.gained|0,gainedFrom:e.gainedFrom>=0?this.label(e.gainedFrom):null,taken:e.taken|0,near:r(e.near),ex:r(e.ex),room:e.room}))}); },
  },
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
