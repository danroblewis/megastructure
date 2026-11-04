// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  coherence:{id:1,name:'coherence',blurb:'experiment 1: q.xy a slow habit of the cell\'s motion; cohesion only between agreeing habits; membership and steerability by agreement with the drive'},
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
