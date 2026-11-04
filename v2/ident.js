// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  return:{id:7,name:'return',blurb:'identity is what comes back: a cell that leaves home and returns within its window is kept and strengthened; one that never returns fades even inside rfar, or is adopted where it gave up; the window is learned together'},
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
