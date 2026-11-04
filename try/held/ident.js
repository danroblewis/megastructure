// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  // 8. held — the boundary as an act of will. By default the edges of two wisps mix like fluids. While you hold (a second finger,
  // or the space bar) the edge of your body firms (q.w) and refuses to exchange matter with cells that are not yours; held cells
  // answer your drive, not the other wisp's, wherever they sit. Holding costs stamina. Let go and you enmesh.
  held:{id:8,name:'held',blurb:'hold with a second finger or the space bar to keep your edge: it stops mixing with another wisp while you hold · holding costs stamina · let go and you enmesh',
    drain:0.0062,   // stamina per tick while holding (the tick before this one gives back 0.005 when no current is fought, so the net cost is slow)
    tick(ctx){ const bd=ctx.bd, pl=ctx.player; let hold=!!(bd.hold||ctx.touches.size>1||ctx.keys.Space);
      if(pl.dissoc>0||pl.dead) hold=false;                                              // no will while dissociated
      bd.hold=hold?1:0; this.on=hold;
      if(hold) pl.stamina=Math.max(0,pl.stamina-this.drain); },
    hud(ctx,c){ if(!this.on) return; const s=ctx.dpr; c.font=`${Math.round(11*s)}px -apple-system,Helvetica,Arial,sans-serif`; c.textAlign='center'; c.textBaseline='bottom'; c.fillStyle='rgba(240,170,255,0.75)'; c.fillText('holding',ctx.sw/2,ctx.sh-(40+(window.safeBottom||0))*s); c.textAlign='left'; c.textBaseline='top'; }},
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
