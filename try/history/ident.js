// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  // 5. history: affinity by shared experience. q is what the matter has lived through (heat, cold, current, ore or charge), each a running
  // mix; cohesion, membership and the answer to attention follow similarity of pasts. the shader rules need each wisp's mean past: this
  // measures it from the 6x5 q grid round each wisp (probe3), over the cells the model itself gives that wisp, and hands it to the shaders
  // as uHistC/uHistN. a slot whose past is unmeasured (a past life, or the other wisp before its grid has been read) falls back to distance.
  history:{id:5,name:'history',blurb:'affinity by shared experience: q is what the matter has lived through (heat, cold, current, ore or charge); cohesion, membership and attention follow similarity of pasts',
    tick(ctx){
      const {SIM,bd}=ctx; const q=SIM.probeBuf3, s=SIM.probeBuf3s; if(!q) return;
      const st=this.st||(this.st={h:new Float32Array(12),n:new Float32Array(3),acc:new Float64Array(12),cnt:new Float64Array(3),key:'',mix:[0,0]});
      const key=SIM.nC+'/'+SIM.npcK; if(key!==st.key){ st.key=key; st.n[1]=0; st.n[2]=0; }   // a centre slot changed hands: its past is unknown again
      st.acc.fill(0); st.cnt.fill(0); let othIn=0, mineIn=0;
      for(let i=0;i<60;i++){ const sv=s[i*4]; if(sv<=0.01) continue; const own=Math.round(s[i*4+2]); if(own<0||own>2) continue;
        st.cnt[own]+=sv; for(let c=0;c<4;c++) st.acc[own*4+c]+=sv*q[i*4+c];
        if(i<30&&own===SIM.npcK) othIn+=sv; if(i>=30&&own===0) mineIn+=sv; }
      for(let k=0;k<3;k++){ if(k>=SIM.nC){ st.n[k]=0; continue; }
        if(st.cnt[k]>1.5){ const f=st.n[k]>0?0.15:1; for(let c=0;c<4;c++) st.h[k*4+c]+=(st.acc[k*4+c]/st.cnt[k]-st.h[k*4+c])*f; st.n[k]=st.cnt[k]; } }   // smoothed over a few ticks; a centre out of reach of its grid keeps its last measured past
      st.mix=[othIn*25,mineIn*25]; bd.hist=st.h; bd.histN=st.n; },
    hud(ctx,c){
      if(!/hud=1/.test(location.hash)||!this.st) return; const st=this.st, s=ctx.dpr, fs=Math.round(11*s); const {SIM}=ctx;
      const f=(k)=>st.n[k]>0?`heat ${st.h[k*4].toFixed(2)} cold ${st.h[k*4+1].toFixed(2)} current ${st.h[k*4+2].toFixed(2)} load ${st.h[k*4+3].toFixed(2)}`:'unmeasured';
      c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='top'; c.fillStyle='rgba(255,235,200,0.75)';
      c.fillText(`past · you: ${f(0)}`,6*s,22*s); if(SIM.npcK>=0) c.fillText(`past · other: ${f(SIM.npcK)}   of theirs in you ${st.mix[0]|0}  of yours in them ${st.mix[1]|0}`,6*s,22*s+fs*1.3); },
  },
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
