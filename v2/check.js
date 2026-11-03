// v2/check.js — static completability: can a body-sized thing get from the spawn to every cold room and the exit?
// usage: node v2/check.js [seed] [W] [H] [radius]
'use strict';
const GEN_=typeof require!=='undefined'?require('./gen.js').GEN:GEN;
function erode(world,r){
  const {W,H,type}=world; const solid=(t)=>t===1||(t>=5&&t<=8);
  // erode: a cell is passable only if no solid within radius r (chebyshev) — the body is roughly 2r wide
  const pass=new Uint8Array(W*H);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ let ok=!solid(type[y*W+x]); for(let dy=-r;ok&&dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H||solid(type[ny*W+nx])){ ok=false; break; } } pass[y*W+x]=ok?1:0; }
  return pass;
}
// breadth-first search over the eroded map from a start cell (nudged to the nearest passable cell)
function search(world,pass,sx,sy){
  const {W,H}=world; const dist=new Int32Array(W*H).fill(-1); const prev=new Int32Array(W*H).fill(-1);
  sx=Math.round(sx); sy=Math.round(sy); let start=sy*W+sx;
  if(!pass[start]){ let best=-1,bd=1e9; for(let y=0;y<H;y++) for(let x=0;x<W;x++){ if(pass[y*W+x]){ const d=(x-sx)**2+(y-sy)**2; if(d<bd){ bd=d; best=y*W+x; } } } if(best<0) return {pass,dist,prev,start:-1}; start=best; }
  const q=new Int32Array(W*H); let qh=0,qt=0; q[qt++]=start; dist[start]=0;
  while(qh<qt){ const i=q[qh++]; const x=i%W, y=(i/W)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(!pass[j]||dist[j]>=0) continue; dist[j]=dist[i]+1; prev[j]=i; q[qt++]=j; } }
  return {pass,dist,prev,start};
}
function pathfind(world,r,start){ const pass=erode(world,r); const s0=start||world.spawn; return search(world,pass,s0.x,s0.y); }
// one search from the spawn; the path to every cold room and the exit (their union is the required route)
function spawnPaths(world,r){ const {W,H}=world; const pass=erode(world,r); const res=search(world,pass,world.spawn.x,world.spawn.y);
  const targets=[...world.checkpoints.map(c=>({x:c.x,y:c.y,rad:Math.ceil(Math.max(c.w||10,c.h||10))})),{x:world.exit.x,y:world.exit.y,rad:12}];
  return targets.map(t=>{ const j=nearestReachable(res,W,H,t.x,t.y,t.rad); return j<0?null:pathTo(res,W,j); }); }
// the game's world: built, then its required route widened to fit the body (radius 8 at full resolution)
function buildWorld(W,H,seed){ const w=GEN_.build(W,H,seed); w.widened=GEN_.widenRoute(w,spawnPaths(w,1),8); return w; }
// the route a body would take: spawn -> cold room 1 -> cold room 2 -> ... -> exit, each leg searched from the end of the last
function route(world,r){
  const {W,H}=world; const pass=erode(world,r); let at=world.spawn; const legs=[];
  const targets=[...world.checkpoints.map(c=>({x:c.x,y:c.y,rad:Math.ceil(Math.max(c.w||10,c.h||10))})),{x:world.exit.x,y:world.exit.y,rad:12}];
  for(const t of targets){ const res=search(world,pass,at.x,at.y); const j=nearestReachable(res,W,H,t.x,t.y,t.rad); if(j<0){ legs.push(null); continue; } const leg=pathTo(res,W,j); legs.push(leg); at={x:j%W,y:(j/W)|0}; }
  return legs;
}
function nearestReachable(res,W,H,x,y,rad){ let best=-1,bd=1e9; for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad;dx<=rad;dx++){ const nx=Math.round(x)+dx, ny=Math.round(y)+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(res.dist[j]>=0){ const d=dx*dx+dy*dy; if(d<bd){ bd=d; best=j; } } } return best; }
function report(world,r){
  const {W,H}=world; const res=pathfind(world,r); const rows=[]; let ok=true;
  const targets=[...world.checkpoints.map((c,i)=>({name:'cold room '+(i+1),x:c.x,y:c.y,rad:Math.ceil(Math.max(c.w||10,c.h||10))})),{name:'exit',x:world.exit.x,y:world.exit.y,rad:12}];
  for(const t of targets){ const j=nearestReachable(res,W,H,t.x,t.y,t.rad); const d=j>=0?res.dist[j]:-1; rows.push({name:t.name,reachable:d>=0,pathCells:d}); if(d<0) ok=false; }
  return {ok,rows,res};
}
function pathTo(res,W,target){ const pts=[]; let j=target; while(j>=0){ pts.push([j%W,(j/W)|0]); j=res.prev[j]; } return pts.reverse(); }
if(typeof require!=='undefined'&&require.main===module){
  const seed=+process.argv[2]||7, W=+process.argv[3]||2048, H=+process.argv[4]||1024, r=+process.argv[5]||3;
  const world=buildWorld(W,H,seed); const {ok,rows}=report(world,r); console.log(`route widened: ${world.widened} cells carved`);
  console.log(`seed ${seed} ${W}x${H} body radius ${r}: ${ok?'COMPLETABLE':'NOT COMPLETABLE'}`);
  for(const row of rows) console.log(`  ${row.reachable?'ok  ':'FAIL'} ${row.name.padEnd(14)} path ${row.pathCells}`);
  process.exit(ok?0:1);
}
if(typeof module!=='undefined') module.exports={pathfind,report,pathTo,nearestReachable,route,erode,search,spawnPaths,buildWorld}; else window.CHECK={pathfind,report,pathTo,nearestReachable,route,erode,search,spawnPaths,buildWorld};
