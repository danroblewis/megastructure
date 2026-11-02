// lab.js — fixed scenarios with measurements, so emergent behaviour can be judged by numbers.
// Activate with #lab=<scenario>&n=<ticks>. Results are written to document.title as JSON.
'use strict';
const LAB={
  // a box with one jet across the middle, blowing left to right, and a drain on the far wall
  build(W,H){
    const mask=new Uint8Array(W*H*4), type=new Uint8Array(W*H); type.fill(1);
    const dirs=new Int8Array(W*H*2);
    for(let y=20;y<H-20;y++) for(let x=20;x<W-20;x++) type[y*W+x]=0;
    const jy=Math.round(H/2);
    for(let k=-14;k<=14;k++){ type[(jy+k)*W+20]=2; dirs[((jy+k)*W+20)*2]=1; type[(jy+k)*W+(W-21)]=3; }
    // a cold pocket in the top-left corner, a burner bottom-right: calm and heat for the stamina tests
    for(let x=24;x<60;x++){ type[20*W+x]=6; }
    for(let x=W-80;x<W-40;x++){ type[(H-21)*W+x]=5; }
    const src=new Uint8Array(W*H*4);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const t=type[y*W+x]; if(t<5||t>8) continue; const ch=t-5; for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ if(dx*dx+dy*dy>10) continue; const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; src[(ny*W+nx)*4+ch]=255; } }
    for(let i=0;i<W*H;i++){ mask[i*4]=type[i]; mask[i*4+1]=Math.round((dirs[i*2]*0.5+0.5)*255); mask[i*4+2]=Math.round((dirs[i*2+1]*0.5+0.5)*255); mask[i*4+3]=255; }
    return {W,H,mask,src,type,machines:[],cores:[],drones:[],checkpoints:[],rooms:[{x0:20,y0:20,x1:W-20,y1:H-20,cx:W/2,cy:H/2,i:0,tier:0,col:0}],spawn:{x:60,y:jy},exit:{x:W-30,y:jy},jet:{x0:20,y:jy,half:14}};
  },
  // scenarios: where the blob starts, and a scripted intent (direction over tick ranges)
  scenarios:{
    edge:    {spawn:[80,120],  script:[]},                                   // resting against the top of the jet: does a part get torn off and fade?
    commit:  {spawn:[80,106],  script:[{t0:60,t1:130,dir:[0,1]}]},           // after a second, move into the jet, then let it carry you
    rescue:  {spawn:[80,106],  script:[{t0:150,t1:400,dir:[1,0.6]}]},        // when a part has gone, go after it
    hold:    {spawn:[160,128], script:[{t0:0,t1:900,dir:[-1,0],stayIn:true}]},   // inside the jet, push upstream (correcting to stay in it) until tired
    calm:    {spawn:[80,60],   script:[{t0:0,t1:300,dir:[1,0]}]},            // still gas: move freely
    calm2:   {spawn:[300,60],  script:[{t0:0,t1:300,dir:[1,0]}]},            // the same, away from the cold corner
  },
  run(name,ctx,tick){
    const sc=this.scenarios[name]; const rows=[]; const N=ctx.N; ctx.jet=ctx.world.jet;
    for(let i=0;i<(ctx.warm||900);i++) ctx.warmStep();          // let the jet develop before anyone is in it
    ctx.player.x=sc.spawn[0]; ctx.player.y=sc.spawn[1]; ctx.spawnAt(sc.spawn[0],sc.spawn[1]);
    let fades=0, prevGhosts=0;
    for(let i=0;i<N;i++){
      let d=[0,0]; for(const s of sc.script){ if(i>=s.t0&&i<s.t1){ d=s.dir; if(s.stayIn){ const dy=ctx.jet.y-ctx.player.y; d=[s.dir[0],Math.max(-0.7,Math.min(0.7,dy*0.08))]; } } }
      ctx.setIntent(d);
      tick();
      const ghosts=ctx.selves.filter((s,k)=>k>0&&s.live&&s.mass>6);
      if(ghosts.length<prevGhosts) fades+=prevGhosts-ghosts.length; prevGhosts=ghosts.length;
      if(i%30===29){ const m=ctx.measure(); rows.push({t:i+1,main:+ctx.selves[0].mass.toFixed(0),cx:+ctx.player.x.toFixed(0),cy:+ctx.player.y.toFixed(0),inJet:+m.inJet.toFixed(0),parts:ghosts.length,partDist:ghosts.map(g=>Math.round(Math.hypot(g.x-ctx.player.x,g.y-ctx.player.y))),stamina:+(ctx.player.stamina===undefined?1:ctx.player.stamina).toFixed(2),fades,u:ctx.flow().map(v=>+v.toFixed(3)),dir:ctx.dirS.map(v=>+v.toFixed(2)),swim:+ctx.bd.swim.toFixed(3),diss:ctx.player.dissoc|0,effort:+(ctx.player.effort||0).toFixed(2),bdir:ctx.bd.dir.map(v=>+v.toFixed(2)),vx:+(ctx.player.vx||0).toFixed(2),dbg:ctx.player.dbg,dbg2:ctx.player.dbg2,st:ctx.player.stamina,prof:m.prof}); }
    }
    return rows;
  },
};
