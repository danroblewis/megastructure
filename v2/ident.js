// ident.js — identity models: what makes a wisp a wisp. The rules live in the shader hooks (identUpdate, identWeight,
// identDrive, identCohere, identTint in shaders.js) selected by uIdent; this registry names them and may add CPU-side
// behaviour (tick(ctx) each tick, hud(ctx,c) each frame). See v2/IDENTITY.md for the ten experiments.
const IDENTS={
  centroid:{id:0,name:'centroid',blurb:'the baseline: a cell belongs to its nearest centre; stability is distance from the centre of mass'},
  agreement:{id:6,name:'agreement',blurb:'experiment 6: each cell holds a stance (a preferred direction) and averages it only with neighbours within tolerance (bounded confidence); groups form and polarise without labels; you belong to the wisp whose stance you agree with, and attention moves fully only the cells that roughly agree with it',
    // CPU glue: the mean stance of each live centre's cells, from the probe grid round the player (slots 1..63; slot 0 the centroid),
    // each sample going to the nearest live centre. a centre the grid does not reach keeps its last estimate, relaxing toward its drive.
    tick(ctx){ const SIM=ctx.SIM, selves=ctx.selves, pb2=SIM.probeBuf2, pb3=SIM.probeBuf3, pts=SIM.pts; const live=[];
      for(let i=0;i<3;i++){ if(selves[i].live){ const s=selves[i]; if(s.stx===undefined){ s.stx=0; s.sty=0; } live.push({s,x:0,y:0,w:0}); } }
      for(let k=0;k<64;k++){ const sw=pb2[k*4+3]; if(sw<0.05) continue; const px=pts[k*2], py=pts[k*2+1]; let best=null, bd=1e9; for(const a of live){ const d=Math.hypot(a.s.x-px,a.s.y-py); if(d<bd){ bd=d; best=a; } } if(!best||bd>ctx.BODY.rfar) continue; best.x+=pb3[k*4]*sw; best.y+=pb3[k*4+1]*sw; best.w+=sw; }
      live.forEach((a,n)=>{ const s=a.s; if(a.w>0.3){ s.stx+=(a.x/a.w-s.stx)*0.3; s.sty+=(a.y/a.w-s.sty)*0.3; } else { const dx=SIM.dirs[n*2], dy=SIM.dirs[n*2+1]; if(Math.hypot(dx,dy)>0.05){ s.stx+=(dx-s.stx)*0.02; s.sty+=(dy-s.sty)*0.02; } } SIM.stance[n*2]=s.stx; SIM.stance[n*2+1]=s.sty; }); } },
};
if(typeof module!=='undefined') module.exports={IDENTS}; else window.IDENTS=IDENTS;
