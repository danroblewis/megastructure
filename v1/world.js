// world.js — procedural world generation
'use strict';

const WORLD = { W:3200, H:360, surface:null, spawn:{x:30,y:150}, flagX:0, seed:0, spawns:[] };

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// value noise helpers
function makeNoise(rand){
  const SZ=1024, tbl=new Float32Array(SZ); for(let i=0;i<SZ;i++) tbl[i]=rand();
  const perm=new Uint16Array(SZ); for(let i=0;i<SZ;i++) perm[i]=i;
  for(let i=SZ-1;i>0;i--){ const j=(rand()*(i+1))|0; const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
  function h1(i){ return tbl[perm[i&1023]]; }
  function h2(i,j){ return tbl[perm[(perm[i&1023]+j*7)&1023]]; }
  function sm(t){ return t*t*(3-2*t); }
  return {
    n1(x){ const i=Math.floor(x), f=sm(x-i); return h1(i)*(1-f)+h1(i+1)*f; },
    n2(x,y){ const i=Math.floor(x), j=Math.floor(y), fx=sm(x-i), fy=sm(y-j);
      const a=h2(i,j),b=h2(i+1,j),c=h2(i,j+1),d=h2(i+1,j+1);
      return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy; },
  };
}

// biomes: 0 meadow, 1 desert, 2 swamp, 3 frozen, 4 volcanic, 5 crystal
const BIOME_LEN=520;
function biomeAt(x, noise){
  const jitter=(noise.n1(x/37)-0.5)*90;
  let b=Math.floor((x+jitter)/BIOME_LEN);
  if(x<120) b=0;
  return Math.max(0,Math.min(5,b));
}

function generateWorld(seed){
  const W=WORLD.W, H=WORLD.H;
  WORLD.seed=seed;
  const rand=mulberry32(seed);
  const noise=makeNoise(rand);
  SIM.init(W,H);
  const c=SIM.cells, m=SIM.meta;
  const surf=new Int16Array(W); WORLD.surface=surf; WORLD.spawns=[];
  const biome=new Uint8Array(W);

  // heights
  for(let x=0;x<W;x++){
    biome[x]=biomeAt(x,noise);
    let h=200 + (noise.n1(x/140)-0.5)*90 + (noise.n1(x/38)-0.5)*30 + (noise.n1(x/9)-0.5)*6;
    if(biome[x]===3) h-= (noise.n1(x/25)-0.5)*40;   // jagged frozen peaks
    if(biome[x]===4) h+= (noise.n1(x/20)-0.5)*24;
    if(x<70) h=205; else if(x<100) h=205+(h-205)*((x-70)/30);
    surf[x]=Math.round(Math.max(60,Math.min(H-60,h)));
  }

  // local liquid levels per biome (pools form where surface dips below level)
  const poolLevel=new Int16Array(W);
  for(let x=0;x<W;x++){
    let lvl=0;
    const seg=Math.floor(x/90);
    const r=noise.n1(seg*13.7+0.5);
    // compute mean surface over segment
    let s=0,n=0; for(let k=seg*90;k<seg*90+90&&k<W;k++){ s+=surf[k]; n++; }
    const mean=s/n;
    if(r<0.45 && x>130) lvl=Math.round(mean+4);
    poolLevel[x]=lvl;
  }

  // base terrain
  for(let x=0;x<W;x++){
    const h=surf[x], b=biome[x];
    const dirtDepth=8+noise.n1(x/15+99)*10;
    for(let y=0;y<H;y++){
      const i=y*W+x; let t=T.EMPTY;
      if(y>=H-3){ t=T.BEDROCK; }
      else if(y>=h){
        const d=y-h;
        // caves
        const cv=noise.n2(x/42+3,y/26+7)*0.7+noise.n2(x/13+11,y/11+5)*0.3;
        const caveThresh = 0.60 - Math.min(0.08,(d-6)*0.002);
        const softDepth = b===1? dirtDepth+18 : dirtDepth+2;
        const isCave = d>softDepth+3 && cv>caveThresh && y<H-6;
        if(isCave){
          t=T.EMPTY;
          // cave liquids pooled in blobs
          const lq=noise.n2(x/55+40,y/18+21);
          if(lq>0.62 && d>30){
            if(b===4||(y>H-45&&lq>0.68)) t=T.LAVA; else if(b===2) t=(lq>0.7?T.ACID:T.WATER);
            else if(b===1) t=T.OIL; else if(b===5) t=(lq>0.72?T.ACID:T.WATER); else t=T.WATER;
          }
        } else {
          if(b===0){ t = d===0?T.GRASS : d<dirtDepth?T.DIRT : T.STONE; }
          else if(b===1){ t = d<dirtDepth+14?T.SAND : (d<dirtDepth+18?T.DIRT:T.STONE); }
          else if(b===2){ t = d===0?(noise.n1(x/4)<0.6?T.GRASS:T.MUD) : d<dirtDepth?(noise.n2(x/6,y/6)<0.5?T.MUD:T.DIRT) : T.STONE; }
          else if(b===3){ t = d<3?T.SNOW : d<6?T.ICE : d<dirtDepth+2?T.DIRT : T.STONE; }
          else if(b===4){ t = d<2?(noise.n1(x/5)<0.5?T.ASH:T.STONE) : d<dirtDepth?(noise.n2(x/9,y/9)<0.35?T.OBSIDIAN:T.STONE) : T.STONE; }
          else { t = d<2?T.STONE : d<dirtDepth?(noise.n2(x/7,y/7)<0.3?T.CRYSTAL:T.STONE) : T.STONE; }
          // ores
          if(t===T.STONE){
            const o=noise.n2(x/9+77,y/9+31);
            if(o>0.73 && d>20) t=T.COAL;
            else if(d>50 && rand()<0.0025) t=T.GOLD;
            else if(d>45 && b===5 && noise.n2(x/6+5,y/6+9)>0.72) t=T.CRYSTAL;
            else if(d>25 && (b===4||b===1) && noise.n2(x/8+123,y/8+45)>0.78) t=T.GUNPOWDER;
            else if(d>20 && rand()<0.0008) t=T.GOLD;
          }
        }
      } else {
        // above surface: pools
        const lvl=poolLevel[x];
        if(lvl>0 && y>=lvl && y<h){
          if(b===4) t=T.LAVA; else if(b===2) t=(noise.n1(x/60+8)<0.3?T.SLIME:T.WATER);
          else if(b===3) t=(y===lvl?T.ICE:T.WATER); else if(b===1) t=(noise.n1(x/60+8)<0.5?T.OIL:T.WATER); else t=T.WATER;
        }
      }
      c[i]=t;
    }
  }

  // decorate cave floors: spikes, torches, bones, fungus, vines on cave ceilings, honey
  for(let x=2;x<W-2;x++){
    for(let y=surf[x]+8;y<H-6;y++){
      const i=y*W+x;
      if(c[i]!==T.EMPTY) continue;
      const below=c[i+W], above=c[i-W];
      const r=rand();
      if((below===T.STONE||below===T.DIRT||below===T.SAND)){
        if(r<0.01) c[i]=T.SPIKE;
        else if(r<0.016) { c[i]=T.TORCH; }
        else if(r<0.019) c[i]=T.BONE;
        else if(r<0.03 && below===T.DIRT) c[i]=T.FUNGUS;
        else if(r<0.034 && biome[x]!==3) { for(let k=0;k<3;k++){ if(c[i-k*W]===T.EMPTY) c[i-k*W]=T.GUNPOWDER; } }
        else if(r<0.036 && biome[x]===2){ c[i]=T.HONEY; }
        else if(r<0.0385){ WORLD.spawns.push({kind:'crawler',x,y}); }
        else if(r<0.0395){ WORLD.spawns.push({kind:'blob',x,y}); }
      } else if(above===T.STONE||above===T.DIRT){
        if(r<0.04){ const len=4+(rand()*16)|0; for(let k=0;k<len&&c[i+k*W]===T.EMPTY;k++){ c[i+k*W]=T.VINE; m[i+k*W]=0; } m[i+(len-1)*W]=(rand()*10)|0; }
        else if(r<0.03 && biome[x]!==4){ c[i]=T.WATER; }   // drips
        else if(r<0.032 && (biome[x]===4||biome[x]===5)){ c[i]=T.LAVA; }
        else if(r<0.0335 && y>surf[x]+30){ WORLD.spawns.push({kind:'wisp',x,y:y+4}); }
      }
    }
  }

  // surface features
  let nextTree=130;
  for(let x=6;x<W-40;x++){
    const h=surf[x], b=biome[x];
    const top=(h-1)*W+x;
    if(poolLevel[x]>0 && h>poolLevel[x]) continue; // underwater
    const r=rand();
    if(x>=nextTree){
      if(b===0||b===2){ placeTree(x,h,5+(rand()*6)|0,rand); nextTree=x+10+(rand()*30)|0; }
      else if(b===1){ const hh=3+(rand()*6)|0; for(let k=1;k<=hh;k++) c[(h-k)*W+x]=T.CACTUS; nextTree=x+14+(rand()*30)|0; }
      else if(b===3){ placeTree(x,h,6+(rand()*8)|0,rand,true); nextTree=x+18+(rand()*40)|0; }
      else nextTree=x+20;
    }
    if(x>130){
      if(r<0.004 && (b===0||b===2)){ c[(h-1)*W+x]=T.SPRING; c[h*W+x]=T.STONE; }
      else if(r<0.012 && b===4){ c[(h)*W+x]=T.GEYSER; c[(h-1)*W+x]=T.EMPTY; }
      else if(r<0.015 && b===4){ c[(h-1)*W+x]=T.TORCH; }
      else if(r<0.019){ for(let k=-1;k<=1;k++) c[(h-1)*W+x+k]=T.BOUNCE; }
      else if(r<0.021 && b===1){ for(let k=-2;k<=2;k++) for(let yy=1;yy<=2;yy++) c[(h-yy)*W+x+k]=T.GUNPOWDER; }
      else if(r<0.023 && b===3){ for(let k=0;k<5;k++) c[(h-1-k)*W+x]=T.ICE; }
      else if(r<0.026){ c[(h-1)*W+x]=T.GOLD; }
      else if(r<0.030 && b===2){ c[(h-1)*W+x]=T.FUNGUS; }
      else if(r<0.032 && b===5){ c[(h-1)*W+x]=T.CRYSTAL; c[(h-2)*W+x]=T.CRYSTAL; }
    }
  }

  // ledges on steep cliff faces so they can be climbed
  for(let x=140;x<W-40;x+=3){
    const rise=surf[x]-surf[x+10];
    if(Math.abs(rise)>16){
      const lo=Math.max(surf[x],surf[x+10]), hi=Math.min(surf[x],surf[x+10]);
      const cliffX = rise>0 ? x+10 : x; const out = rise>0 ? -1 : 1;
      for(let y=lo-7;y>hi+2;y-=7){
        const wx=cliffX+out*(2+(rand()*3)|0);
        for(let dx=-2;dx<=2;dx++){ const nx=wx+dx; if(nx<1||nx>=W-1) continue; const i=y*W+nx; if(c[i]===T.EMPTY) c[i]=T.STONE; }
      }
      x+=12;
    }
  }
  // surface creatures
  for(let x=260;x<W-80;x+=25+(rand()*45)|0){
    const h=surf[x], b=biome[x]; if(poolLevel[x]>0&&h>poolLevel[x]) continue;
    const r=rand();
    if(r<0.45) WORLD.spawns.push({kind:'blob',x,y:h-1});
    else if(r<0.75) WORLD.spawns.push({kind:'crawler',x,y:h-1});
    else if(b===4||b===5||r>0.9) WORLD.spawns.push({kind:'wisp',x,y:h-14});
  }
  // sky islands with gold and hanging vines
  for(let x=220;x<W-120;x+=160+(rand()*200)|0){
    const cy=50+(rand()*90)|0, rx=10+(rand()*16)|0, ry=4+(rand()*4)|0;
    const b=biome[x];
    for(let dx=-rx;dx<=rx;dx++) for(let dy=-ry;dy<=ry;dy++){
      const nx=x+dx, ny=cy+dy; if(nx<0||nx>=W||ny<0||ny>=H) continue;
      const e=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry);
      if(e>1) continue;
      if(surf[nx]-ny<14) continue;
      const i=ny*W+nx;
      c[i]= dy<-ry+2 ? (b===1?T.SAND:b===3?T.SNOW:b===4?T.OBSIDIAN:T.DIRT) : (b===5?T.CRYSTAL:T.STONE);
      if(dy===-ry && c[i]===T.DIRT) c[i]=T.GRASS;
    }
    // gold on top
    const nG=1+(rand()*3)|0;
    for(let k=0;k<nG;k++){ const gx=x+((rand()*rx)|0)-(rx>>1); let gy=cy-ry; while(gy>1 && c[gy*W+gx]!==T.EMPTY) gy--; if(gy>1) c[gy*W+gx]=T.GOLD; }
    // vines
    const nV=2+(rand()*3)|0;
    for(let k=0;k<nV;k++){
      const vx=x+((rand()*rx*1.6)|0)-(rx*0.8|0); let vy=cy+1; while(vy<H-1 && c[vy*W+vx]!==T.EMPTY) vy++;
      const len=20+(rand()*40)|0;
      for(let j=0;j<len && vy+j<H-1 && c[(vy+j)*W+vx]===T.EMPTY;j++){ c[(vy+j)*W+vx]=T.VINE; m[(vy+j)*W+vx]=0; }
      m[(vy)*W+vx]=0;
    }
    // staircase of floating slabs from the ground up to the island
    { let py=surf[x]-9, px=x+(rand()<0.5?-1:1)*(rx+8); let side=px<x?1:-1; let n=0;
      while(py>cy+ry+6 && n<14){
        const w=3+(rand()*3)|0;
        for(let dx=-w;dx<=w;dx++){ const nx=px+dx; if(nx<1||nx>=W-1) continue; const i=py*W+nx; if(c[i]===T.EMPTY) c[i]=(b===3?T.ICE:b===4?T.OBSIDIAN:T.STONE); }
        if(n%3===2 && rand()<0.7) WORLD.spawns.push({kind:'crawler',x:px,y:py});
        px+=side*(8+(rand()*5)|0); if(Math.abs(px-x)>rx+14) side=-side; py-=7+(rand()*3)|0; n++;
      } }
    if(rand()<0.6) WORLD.spawns.push({kind:'wisp',x,y:cy-ry-6});
    // small torch/spring sometimes
    if(rand()<0.3){ c[(cy-ry-1)*W+x]=T.TORCH; }
    if(rand()<0.3 && b!==4){ let sy=cy-ry; c[sy*W+x-3]=T.SPRING; }
    if(b===4 && rand()<0.6){ c[(cy-ry+1)*W+x]=T.LAVA; c[(cy-ry+1)*W+x+1]=T.LAVA; }
  }

  // clouds
  for(let x=60;x<W;x+=90+(rand()*120)|0){
    const cy=18+(rand()*40)|0, rx=5+(rand()*12)|0, ry=2+(rand()*2)|0;
    for(let dx=-rx;dx<=rx;dx++) for(let dy=-ry;dy<=ry;dy++){
      const e=(dx*dx)/(rx*rx)+(dy*dy)/(ry*ry); if(e>1||rand()<0.15) continue;
      const nx=x+dx,ny=cy+dy; if(nx<0||nx>=W||ny<0||ny>=H) continue; if(c[ny*W+nx]===T.EMPTY) c[ny*W+nx]=T.CLOUD;
    }
  }

  // deep treasure caverns: gold clusters & crystal near the bottom
  for(let k=0;k<60;k++){
    const x=100+(rand()*(W-200))|0, y=H-60+(rand()*45)|0;
    for(let dx=-6;dx<=6;dx++) for(let dy=-3;dy<=3;dy++){
      const nx=x+dx,ny=y+dy; if(nx<1||nx>=W-1||ny<1||ny>=H-4) continue;
      const i=ny*W+nx;
      if(dx*dx+dy*dy*4<30){ c[i]=T.EMPTY; }
    }
    for(let g=0;g<3;g++){ const gx=x+((rand()*8)|0)-4; let gy=y; while(gy<H-4&&c[gy*W+gx]===T.EMPTY) gy++; if(gy<H-4) c[(gy-1)*W+gx]=T.GOLD; }
    c[(y+3)*W+x-6]=T.TORCH; WORLD.spawns.push({kind:'blob',x:x+3,y:y+2});
    if(rand()<0.4){ c[(y-3)*W+x]=T.ACID; c[(y-3)*W+x+1]=T.ACID; }
  }

  // ---- element set-pieces across the main path (each has more than one solution) ----
  function flatten(x0,x1,h){ for(let x=x0;x<=x1;x++){ if(x<0||x>=W) continue; for(let y=Math.max(0,h-40);y<h;y++) c[y*W+x]=T.EMPTY; for(let y=h;y<h+24&&y<H-3;y++) c[y*W+x]=T.STONE; c[h*W+x]=T.STONE; surf[x]=h; } }
  function box(x0,y0,x1,y1,t,mt){ for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ if(x<0||x>=W||y<0||y>=H) continue; c[y*W+x]=t; m[y*W+x]=mt||0; } }
  const pieces=[
    (x,h)=>{ // 1: lava moat with a water basin held back by a sand dam -> pour water, walk the obsidian
      flatten(x-30,x+60,h);
      box(x,h-1,x+34,h+9,T.LAVA); box(x,h+10,x+34,h+12,T.STONE);
      box(x-24,h-16,x-4,h-9,T.WATER); box(x-26,h-18,x-26,h-8,T.STONE); box(x-25,h-8,x-3,h-8,T.STONE); box(x-25,h-18,x-3,h-18,T.STONE);
      box(x-3,h-16,x-2,h-9,T.SAND);  // the dam
      for(let k=-25;k<=-3;k+=4) c[(h-7)*W+x+k]=T.STONE; // steps under basin
      box(x-26,h-7,x-4,h-1,T.STONE); // basin pedestal
      c[(h-19)*W+x-20]=T.GOLD; c[(h-2)*W+x+50]=T.GOLD; c[(h-2)*W+x+52]=T.GOLD; },
    (x,h)=>{ // 2: gunpowder gate. a torch waits on a pedestal: carry it over and spray it at the wall
      flatten(x-30,x+40,h);
      box(x,h-26,x+7,h-1,T.STONE); box(x+3,h-24,x+4,h-2,T.GUNPOWDER); box(x+1,h-25,x+6,h-24,T.OBSIDIAN);
      box(x-18,h-3,x-16,h-1,T.STONE); c[(h-4)*W+x-17]=T.TORCH;
      box(x+8,h-5,x+12,h-5,T.STONE); c[(h-6)*W+x+10]=T.GOLD; box(x+20,h-2,x+22,h-1,T.GOLD); },
    (x,h)=>{ // 3: oil lake under a torch pole. burn it from afar, or sneak through while staying wet
      flatten(x-30,x+70,h);
      box(x,h-6,x+44,h-1,T.OIL); box(x,h,x+44,h+1,T.STONE); box(x-1,h-7,x-1,h-1,T.STONE); box(x+45,h-7,x+45,h-1,T.STONE);
      box(x+22,h-16,x+22,h-7,T.WOOD); c[(h-17)*W+x+22]=T.TORCH;
      box(x-20,h-5,x-12,h-1,T.WATER); box(x-21,h-6,x-21,h-1,T.STONE); box(x-11,h-6,x-11,h-1,T.STONE);
      box(x+50,h-2,x+54,h-1,T.GOLD); },
    (x,h)=>{ // 4: ice wall beside a lava cauldron. melt it, or climb it
      flatten(x-30,x+40,h);
      box(x,h-22,x+5,h-1,T.ICE); box(x-20,h-5,x-12,h-1,T.LAVA); box(x-21,h-6,x-21,h-1,T.STONE); box(x-11,h-6,x-11,h-1,T.STONE);
      box(x+6,h-23,x+6,h-23,T.GOLD); box(x+14,h-2,x+18,h-1,T.GOLD); },
    (x,h)=>{ // 5: geyser lift. ride the steam up the chimney to a gold shelf and over the tower
      flatten(x-30,x+40,h);
      box(x,h-40,x+12,h-1,T.STONE); box(x+5,h-39,x+7,h-2,T.EMPTY); c[(h-1)*W+x+6]=T.GEYSER; box(x+5,h-1,x+5,h-1,T.STONE); box(x+7,h-1,x+7,h-1,T.STONE);
      box(x+4,h-41,x+8,h-41,T.EMPTY); box(x-6,h-30,x-2,h-30,T.STONE); c[(h-31)*W+x-4]=T.GOLD; box(x+20,h-2,x+24,h-1,T.GOLD); },
  ];
  for(let k=1;k<=5;k++){
    const px=k*BIOME_LEN+40; const h=Math.round((surf[px-30]+surf[px+40])/2);
    pieces[k-1](px,h);
  }
  // seed piles beside trees, and a tutorial pond + seeds near the start
  for(let x=120;x<W-40;x++){ const i=(surf[x]-1)*W+x; if(c[i]===T.WOOD && c[i-1]===T.EMPTY && rand()<0.7){ for(let k=1;k<=3;k++){ const j=(surf[x]-1)*W+x-k; if(c[j]===T.EMPTY) c[j]=T.SEED; } } }
  { const h=surf[60]; box(56,h-2,66,h+1,T.WATER); box(55,h-3,55,h+1,T.STONE); box(67,h-3,67,h+1,T.STONE); box(56,h+2,66,h+2,T.STONE); for(let k=0;k<6;k++) c[(h-1)*W+74+k]=T.SEED; }

  // start area safety
  for(let x=0;x<110;x++){ const h=surf[x]; for(let y=h-30;y<h;y++){ const i=y*W+x; const t=c[i]; if(x>=55&&x<=80) continue; if(t!==T.EMPTY&&t!==T.GRASS&&t!==T.WOOD&&t!==T.LEAF&&t!==T.VINE&&t!==T.CLOUD) c[i]=T.EMPTY; } if(x<55||x>67) c[(h)*W+x]=T.GRASS; }
  WORLD.spawn={x:30,y:surf[30]-8};

  // goal flag
  const fx=W-24; WORLD.flagX=fx; const fh=surf[fx];
  for(let x=fx-10;x<=fx+10;x++){ for(let y=fh-14;y<fh;y++) c[y*W+x]=T.EMPTY; for(let y=fh;y<fh+3;y++) c[y*W+x]=T.STONE; c[(fh-1)*W+x]=T.GRASS; }
  for(let k=1;k<=14;k++) c[(fh-k)*W+fx]=T.WOOD;
  for(let dy=0;dy<5;dy++) for(let dx=1;dx<=7-dy;dx++) c[(fh-14+dy)*W+fx+dx]=T.FLAG;
  for(let k=-4;k<=4;k+=2) c[(fh-2)*W+fx+k]=T.GOLD;

  // shade variety
  for(let i=0;i<W*H;i++) SIM.shade[i]=(Math.random()*256)|0;
}

function placeTree(x,h,height,rand,frozen){
  const W=WORLD.W, c=SIM.cells, m=SIM.meta;
  for(let k=1;k<=height;k++){ const i=(h-k)*W+x; if(c[i]===T.EMPTY) c[i]=T.WOOD; }
  const ty=h-height, R=frozen?2:(3+(rand()*2)|0);
  for(let dx=-R;dx<=R;dx++) for(let dy=-R;dy<=R;dy++){
    const nx=x+dx, ny=ty+dy; if(nx<0||nx>=W||ny<0) continue;
    if(dx*dx+dy*dy>R*R+1) continue;
    if(frozen && dy>0) continue;
    if(rand()<0.15) continue;
    const i=ny*W+nx; if(c[i]===T.EMPTY) c[i]=frozen&&rand()<0.5?T.SNOW:T.LEAF;
  }
  if(!frozen && rand()<0.5){ const vx=x+(rand()<0.5?-R:R); for(let k=0;k<6+(rand()*10|0);k++){ const i=(ty+R-1+k)*W+vx; if(i<0||i>=c.length||c[i]!==T.EMPTY) break; c[i]=T.VINE; } }
}
