// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  familiarity:{id:2,name:'familiarity',blurb:'experiment 2: a cell grows familiar while its neighbourhood stays the same and loses that when it changes; cohesion, steerability and membership follow familiarity, so a fresh cluster is fragile and an interface that keeps shifting is nobody\'s'},
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
