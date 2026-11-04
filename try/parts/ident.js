// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  // 9. parts (IFS). the roles live in the shader (q.x protector from burning, q.y manager from long calm, q.z exile from surviving being
  // lost; q.w the baseline allegiance, which a part changes fifty times slower). the CPU half is the burden: the other wisp's parts that sit
  // inside you (cells in the 6x5 grid round your centre whose allegiance is not yours) cost stamina to carry, and the hud reads the roles.
  parts:{id:9,name:'parts',blurb:'IFS: q.xyz is a role grown from history (protector burned, manager long calm, exile lost and regrown); a part keeps its allegiance, and carrying a part you did not make costs stamina',
    tick(ctx){
      const {SIM,player}=ctx; const q=SIM.probeBuf3, s=SIM.probeBuf3s; if(!q||!s) return;
      const st=this.st||(this.st={burden:0,roles:[0,0,0],n:0,theirRoles:[0,0,0]});
      let burden=0, mw=0; const r=[0,0,0], tr=[0,0,0]; let tw=0;
      for(let i=0;i<30;i++){ const sv=s[i*4]; if(sv<=0.01) continue; const own=Math.round(s[i*4+2]);
        if(own!==0){ if(own===SIM.npcK) burden+=sv; continue; } mw+=sv; for(let c=0;c<3;c++) r[c]+=sv*q[i*4+c]; }   // only the other wisp's parts are a burden; your own past lives are yours
      for(let i=30;i<60;i++){ const sv=s[i*4]; if(sv<=0.01) continue; tw+=sv; for(let c=0;c<3;c++) tr[c]+=sv*q[i*4+c]; }
      st.burden+=(burden*25-st.burden)*0.2; st.n=mw*25; st.roles=mw>0?r.map(v=>v/mw):[0,0,0]; st.theirRoles=tw>0?tr.map(v=>v/tw):[0,0,0];
      if(player.stamina!==undefined&&!player.dead&&!(player.dissoc>0)){ const drain=Math.min(0.006,0.0001*st.burden); player.stamina=Math.max(0,player.stamina-drain); player.burden=+st.burden.toFixed(1); } },   // 40 foreign cells inside you cost what holding against a current does
    hud(ctx,c){
      if(!/hud=1/.test(location.hash)||!this.st) return; const st=this.st, s=ctx.dpr, fs=Math.round(11*s);
      c.font=`${fs}px -apple-system,Helvetica,Arial,sans-serif`; c.textBaseline='top'; c.fillStyle='rgba(255,235,200,0.75)';
      const f=(r)=>`protector ${r[0].toFixed(2)} manager ${r[1].toFixed(2)} exile ${r[2].toFixed(2)}`;
      c.fillText(`parts · you: ${f(st.roles)}   carried, not yours: ${st.burden|0}`,6*s,22*s); if(ctx.SIM.npcK>=0) c.fillText(`parts · other: ${f(st.theirRoles)}`,6*s,22*s+fs*1.3); },
  },
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
