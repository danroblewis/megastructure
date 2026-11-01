// cells.js — cell types, properties and the cellular automata rules.
'use strict';

const T = {
  EMPTY:0, STONE:1, DIRT:2, SAND:3, WATER:4, LAVA:5, OIL:6, FIRE:7, SMOKE:8, STEAM:9,
  WOOD:10, LEAF:11, GRASS:12, ICE:13, SNOW:14, ACID:15, GUNPOWDER:16, MUD:17, GLASS:18,
  OBSIDIAN:19, MOSS:20, VINE:21, SEED:22, COAL:23, SLIME:24, CLOUD:25, HONEY:26, SPRING:27,
  GEYSER:28, CRYSTAL:29, BOUNCE:30, GOLD:31, FLAG:32, PLAYER:33, ASH:34, EMBER:35, FUNGUS:36,
  SPORE:37, SPIKE:38, TORCH:39, BEDROCK:40, PLAYERHEAD:41, SPARK:42, CACTUS:43, BONE:44,
  BLOB:45, WISP:46, CRAWLER:47, BEANSTALK:48, RUBBLE:49, DUST:50,
  COUNT:51
};

// flags
const F_STATIC=1, F_LIQUID=2, F_POWDER=4, F_GAS=8, F_FLAM=16, F_HOT=32, F_ACTIVE=64, F_SOLID=128;
const FLAGS = new Uint8Array(T.COUNT);
const DENS  = new Uint8Array(T.COUNT);     // higher sinks
const COLOR = new Array(T.COUNT);          // [r,g,b,variation]
const IGNITE = new Float32Array(T.COUNT);  // chance per hot neighbour per tick
const BURN   = new Uint8Array(T.COUNT);    // fire life when ignited

function def(t, flags, dens, color, ignite, burn){
  FLAGS[t]=flags; DENS[t]=dens; COLOR[t]=color; IGNITE[t]=ignite||0; BURN[t]=burn||0;
}
def(T.EMPTY,     0,                         0,   [0,0,0,0]);
def(T.STONE,     F_STATIC|F_SOLID|F_ACTIVE, 255, [110,112,118,14]);
def(T.BEDROCK,   F_STATIC|F_SOLID,          255, [40,38,44,8]);
def(T.DIRT,      F_POWDER|F_SOLID,          65,  [120,82,50,14]);
def(T.SAND,      F_POWDER|F_SOLID,          60,  [226,196,122,16]);
def(T.MUD,       F_POWDER|F_SOLID,          66,  [88,62,40,10]);
def(T.SNOW,      F_POWDER|F_SOLID,          40,  [238,242,250,8]);
def(T.ASH,       F_POWDER|F_SOLID,          42,  [96,92,90,12]);
def(T.GUNPOWDER, F_POWDER|F_SOLID|F_FLAM,   58,  [52,50,56,10], 1.0, 8);
def(T.SEED,      F_POWDER|F_SOLID|F_FLAM,   55,  [150,120,60,10], 0.4, 6);
def(T.WATER,     F_LIQUID,                  30,  [38,110,210,18]);
def(T.OIL,       F_LIQUID|F_FLAM,           20,  [70,50,40,8], 0.5, 22);
def(T.ACID,      F_LIQUID,                  32,  [150,240,70,20]);
def(T.LAVA,      F_LIQUID|F_HOT,            50,  [240,110,30,30]);
def(T.HONEY,     F_LIQUID,                  35,  [230,160,40,12]);
def(T.SLIME,     F_LIQUID,                  36,  [90,220,120,20]);
def(T.FIRE,      F_GAS|F_HOT,               1,   [255,140,20,40]);
def(T.SMOKE,     F_GAS,                     1,   [70,70,76,14]);
def(T.STEAM,     F_GAS,                     1,   [200,210,222,14]);
def(T.SPORE,     F_GAS|F_FLAM,              1,   [170,120,230,30], 1.0, 3);
def(T.SPARK,     F_GAS|F_HOT,               1,   [255,230,120,30]);
def(T.WOOD,      F_STATIC|F_SOLID|F_FLAM|F_ACTIVE, 255, [130,90,52,14], 0.04, 70);
def(T.LEAF,      F_STATIC|F_SOLID|F_FLAM|F_ACTIVE, 255, [60,150,60,30], 0.3, 14);
def(T.GRASS,     F_STATIC|F_SOLID|F_FLAM|F_ACTIVE, 255, [90,180,70,24], 0.35, 10);
def(T.CACTUS,    F_STATIC|F_SOLID|F_FLAM,   255, [70,140,60,16], 0.1, 30);
def(T.ICE,       F_STATIC|F_SOLID|F_ACTIVE, 255, [170,215,245,14]);
def(T.GLASS,     F_STATIC|F_SOLID,          255, [190,220,230,8]);
def(T.OBSIDIAN,  F_STATIC|F_SOLID,          255, [40,30,55,10]);
def(T.MOSS,      F_STATIC|F_SOLID|F_FLAM,   255, [70,130,60,16], 0.2, 12);
def(T.VINE,      F_STATIC|F_FLAM|F_ACTIVE,  255, [60,120,50,18], 0.3, 10);
def(T.COAL,      F_STATIC|F_SOLID|F_FLAM,   255, [36,34,38,10], 0.02, 120);
def(T.CLOUD,     F_STATIC|F_ACTIVE,         255, [235,238,245,10]);
def(T.SPRING,    F_STATIC|F_SOLID|F_ACTIVE, 255, [80,140,200,10]);
def(T.GEYSER,    F_STATIC|F_SOLID|F_ACTIVE, 255, [150,120,100,12]);
def(T.CRYSTAL,   F_STATIC|F_SOLID,          255, [180,120,255,30]);
def(T.BOUNCE,    F_STATIC|F_SOLID,          255, [240,80,160,12]);
def(T.GOLD,      F_POWDER|F_SOLID,          90,  [255,215,60,30]);
def(T.FLAG,      F_STATIC,                  255, [255,60,60,20]);
def(T.PLAYER,    F_STATIC|F_SOLID,          255, [250,230,200,6]);
def(T.PLAYERHEAD,F_STATIC|F_SOLID,          255, [40,40,50,6]);
def(T.EMBER,     F_STATIC|F_SOLID|F_HOT|F_ACTIVE, 255, [220,80,30,40]);
def(T.FUNGUS,    F_STATIC|F_SOLID|F_FLAM|F_ACTIVE, 255, [200,150,230,24], 0.3, 10);
def(T.SPIKE,     F_STATIC|F_SOLID,          255, [200,200,210,20]);
def(T.TORCH,     F_STATIC|F_SOLID|F_HOT|F_ACTIVE, 255, [200,140,60,10]);
def(T.BONE,      F_STATIC|F_SOLID,          255, [225,220,200,10]);
def(T.BLOB,      F_STATIC|F_SOLID,          255, [60,170,80,20]);
def(T.WISP,      F_STATIC|F_SOLID,          255, [255,170,60,40]);
def(T.CRAWLER,   F_STATIC|F_SOLID,          255, [150,140,160,16]);
def(T.BEANSTALK, F_STATIC|F_FLAM|F_ACTIVE,  255, [90,200,70,26], 0.25, 12);
def(T.RUBBLE,    F_POWDER|F_SOLID,          70,  [120,118,124,16]);
def(T.DUST,      F_GAS,                     1,   [160,140,110,20]);
const CREATURE_TYPES=new Set([T.BLOB,T.WISP,T.CRAWLER]);
const NAMES=[]; for(const k in T) NAMES[T[k]]=k.toLowerCase();

// Simulation state ---------------------------------------------------------
const SIM = {
  W:0, H:0, cells:null, meta:null, shade:null, upd:null, frame:0, parity:0,
  init(W,H){
    this.W=W; this.H=H;
    this.cells=new Uint8Array(W*H); this.meta=new Uint8Array(W*H);
    this.shade=new Uint8Array(W*H); this.upd=new Uint8Array(W*H);
    for(let i=0;i<W*H;i++) this.shade[i]=(Math.random()*256)|0;
  },
  get(x,y){ if(x<0||y<0||x>=this.W||y>=this.H) return T.BEDROCK; return this.cells[y*this.W+x]; },
  set(x,y,t,m){ if(x<0||y<0||x>=this.W||y>=this.H) return; const i=y*this.W+x; this.cells[i]=t; this.meta[i]=m||0; this.shade[i]=(Math.random()*256)|0; },
  stats:{ fire:0 }, playerWet:false,
};

// hooks other modules can set
SIM.onExplode = null;      // (x,y,r)
SIM.onPlayerHit = null;    // (idx, cause)

function isHot(t){ return (FLAGS[t]&F_HOT)!==0; }

function swap(a,b){
  const c=SIM.cells, m=SIM.meta, s=SIM.shade;
  let t=c[a]; c[a]=c[b]; c[b]=t;
  t=m[a]; m[a]=m[b]; m[b]=t;
  t=s[a]; s[a]=s[b]; s[b]=t;
  SIM.upd[a]=SIM.parity; SIM.upd[b]=SIM.parity;
}

// Can mover of type `me` displace a cell of type `o` (falling)?
function canSink(me,o){
  if(o===T.EMPTY) return true;
  const f=FLAGS[o];
  if(f&F_STATIC) return false;
  if(f&F_GAS) return true;
  return DENS[o]<DENS[me];
}
function gasCanEnter(o){
  if(o===T.EMPTY) return true;
  const f=FLAGS[o];
  return (f&F_GAS)!==0 || (f&F_LIQUID)!==0;
}

const DX8=[-1,0,1,-1,1,-1,0,1], DY8=[-1,-1,-1,0,0,1,1,1];

function explode(cx,cy,r){
  const W=SIM.W,H=SIM.H,c=SIM.cells;
  for(let y=cy-r;y<=cy+r;y++){
    if(y<0||y>=H) continue;
    for(let x=cx-r;x<=cx+r;x++){
      if(x<0||x>=W) continue;
      const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
      if(d>r*r) continue;
      const i=y*W+x, t=c[i];
      if(t===T.BEDROCK||t===T.FLAG||t===T.GOLD) continue;
      if(t===T.PLAYER||t===T.PLAYERHEAD){ if(SIM.onPlayerHit) SIM.onPlayerHit(i,'blast'); continue; }
      if(CREATURE_TYPES.has(t)){ c[i]=T.SPARK; SIM.meta[i]=10; continue; }
      if(t===T.GUNPOWDER){ SIM.meta[i]=1; c[i]=T.FIRE; continue; } // chain
      if(t===T.STONE && d>r*r*0.4) continue;
      if(d<r*r*0.5 || Math.random()<0.5){
        c[i]=Math.random()<0.6?T.FIRE:T.SMOKE; SIM.meta[i]=(10+Math.random()*20)|0;
      }
    }
  }
  if(SIM.onExplode) SIM.onExplode(cx,cy,r);
}

// Burn a cell: turn it into fire with appropriate life.
function ignite(i,t){
  if(t===T.GUNPOWDER){ const W=SIM.W; explode(i%W,(i/W)|0,6); return; }
  SIM.cells[i]=T.FIRE; SIM.meta[i]=BURN[t]||10; SIM.upd[i]=SIM.parity;
}

function hurtPlayer(i,cause){ if(SIM.onPlayerHit) SIM.onPlayerHit(i,cause); }

function stepRegion(x0,y0,x1,y1){
  const S=SIM, W=S.W, H=S.H, c=S.cells, m=S.meta, up=S.upd;
  S.frame++; S.parity=S.frame&1;
  const P=S.parity;
  x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(W,x1); y1=Math.min(H,y1);
  const ltr=(S.frame&2)===0;
  const span=x1-x0;
  for(let y=y1-1;y>=y0;y--){
    const row=y*W;
    for(let k=0;k<span;k++){
      const x=ltr?x0+k:x1-1-k;
      const i=row+x;
      const t=c[i];
      if(t===T.EMPTY) continue;
      const f=FLAGS[t];
      if((f&F_STATIC) && !(f&F_ACTIVE)) continue;
      if(up[i]===P) continue;
      if(t===T.STONE && ((S.frame+x+y)&3)!==0) continue;
      up[i]=P;
      const r=Math.random();
      const below=y+1<H?i+W:-1, above=y>0?i-W:-1;
      const tb=below<0?T.BEDROCK:c[below];
      const ta=above<0?T.BEDROCK:c[above];
      const tl=x>0?c[i-1]:T.BEDROCK, tr=x<W-1?c[i+1]:T.BEDROCK;

      // ---------- POWDERS ----------
      if(f&F_POWDER){
        // type specific reactions
        if(t===T.SNOW){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)||tb===T.WATER||tl===T.WATER||tr===T.WATER){ c[i]=T.WATER; continue; }
          if(r<0.5) continue; // floaty
        } else if(t===T.DIRT){
          if(ta===T.EMPTY && r<0.004 && y<H*0.55){ c[i]=T.GRASS; continue; }
          if((tb===T.WATER||tl===T.WATER||tr===T.WATER||ta===T.WATER) && r<0.02){ c[i]=T.MUD; continue; }
          if(ta===T.EMPTY && r<0.0002 && y>H*0.5){ c[i]=T.FUNGUS; m[i]=0; continue; }
        } else if(t===T.MUD){
          if(r<0.0015 && tb!==T.WATER&&tl!==T.WATER&&tr!==T.WATER&&ta!==T.WATER){ c[i]=T.DIRT; continue; }
          if(r<0.6) continue;
        } else if(t===T.SAND){
          if(tb===T.LAVA||tl===T.LAVA||tr===T.LAVA){ if(r<0.05){ c[i]=T.GLASS; continue; } }
        } else if(t===T.GUNPOWDER){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ explode(x,y,6); continue; }
        } else if(t===T.SEED){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ ignite(i,t); continue; }
          if(tb===T.WATER||tl===T.WATER||tr===T.WATER||ta===T.WATER){ c[i]=T.BEANSTALK; m[i]=(45+Math.random()*40)|0; continue; }
          if((tb===T.DIRT||tb===T.GRASS||tb===T.MUD) && ta===T.EMPTY && r<0.01){ c[i]=T.WOOD; m[i]=(6+Math.random()*10)|0; continue; }
        }
        // fall
        if(canSink(t,tb)){
          if((FLAGS[tb]&F_LIQUID) && r<0.45) continue; // slow in liquid
          if(t===T.DIRT||t===T.MUD){ // cohesive: needs an unsupported side to crumble
            const sl=(FLAGS[tl]&F_SOLID)&&!(FLAGS[tl]&F_POWDER&&tl!==T.DIRT&&tl!==T.MUD), sr=(FLAGS[tr]&F_SOLID)&&!(FLAGS[tr]&F_POWDER&&tr!==T.DIRT&&tr!==T.MUD);
            if(sl && sr) continue;
            if(r<0.5) continue;
          }
          swap(i,below); continue;
        }
        // Slide diagonally
        if(t===T.DIRT || t===T.MUD) continue;   // dirt holds slopes
        const dir=(S.frame+x)&1?1:-1;
        const dxa=x+dir, dxb=x-dir;
        if(dxa>=0&&dxa<W&&below>=0){
          const j=below+dir; const tj=c[j];
          if(canSink(t,tj) && (c[i+dir]===T.EMPTY || (FLAGS[c[i+dir]]&(F_LIQUID|F_GAS)))){ swap(i,j); continue; }
        }
        if(dxb>=0&&dxb<W&&below>=0){
          const j=below-dir; const tj=c[j];
          if(canSink(t,tj) && (c[i-dir]===T.EMPTY || (FLAGS[c[i-dir]]&(F_LIQUID|F_GAS)))){ swap(i,j); continue; }
        }
        continue;
      }

      // ---------- LIQUIDS ----------
      if(f&F_LIQUID){
        if(t===T.WATER){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){
            // lava -> obsidian handled by lava; water -> steam
            c[i]=T.STEAM; m[i]=(60+Math.random()*60)|0; continue;
          }
          if((tb===T.ICE||tl===T.ICE||tr===T.ICE||ta===T.ICE) && r<0.004){ c[i]=T.ICE; continue; }
          if(ta===T.EMPTY && r<0.00012){ c[i]=T.EMPTY; continue; } // evaporation
          if(r<0.0004){ // moss on wet stone
            for(let n=0;n<8;n++){ const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx; if(c[j]===T.STONE && ny>0 && c[j-W]===T.EMPTY){ c[j]=T.MOSS; break; } }
          }
        } else if(t===T.LAVA){
          if(r<0.6) continue; // viscous
          for(let n=0;n<8;n++){
            const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue;
            const j=ny*W+nx, tj=c[j];
            if(tj===T.WATER){ c[j]=T.STEAM; m[j]=80; if(Math.random()<0.5){ c[i]=T.OBSIDIAN; break; } }
            else if(tj===T.ICE||tj===T.SNOW){ c[j]=T.WATER; }
            else if(tj===T.PLAYER||tj===T.PLAYERHEAD){ hurtPlayer(j,'lava'); }
            else if((FLAGS[tj]&F_FLAM) && Math.random()<IGNITE[tj]*2) ignite(j,tj);
            else if(tj===T.EMPTY && Math.random()<0.004){ c[j]=T.SPARK; m[j]=(5+Math.random()*10)|0; }
          }
          if(c[i]!==T.LAVA) continue;
        } else if(t===T.ACID){
          let done=false;
          for(let n=0;n<8;n++){
            const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue;
            const j=ny*W+nx, tj=c[j];
            if(tj===T.EMPTY||tj===T.ACID||tj===T.GLASS||tj===T.OBSIDIAN||tj===T.BEDROCK||tj===T.FLAG||tj===T.GOLD||tj===T.SPRING||tj===T.GEYSER||tj===T.BOUNCE||tj===T.TORCH||tj===T.CRYSTAL||(FLAGS[tj]&F_GAS)) continue;
            if(Math.random()<0.08){
              if(tj===T.PLAYER||tj===T.PLAYERHEAD) hurtPlayer(j,'acid'); else { c[j]=T.SMOKE; m[j]=20; }
              if(Math.random()<0.4){ c[i]=T.SMOKE; m[i]=15; done=true; }
              break;
            }
          }
          if(done) continue;
        } else if(t===T.OIL){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<0.5){ ignite(i,t); continue; } }
        } else if(t===T.HONEY){
          if(r<0.85) continue;
        } else if(t===T.SLIME){
          if(r<0.7) continue;
        }
        // fall
        if(canSink(t,tb)){ swap(i,below); continue; }
        const dir=(S.frame+x+y)&1?1:-1;
        if(below>=0){
          let j=below+dir; if(x+dir>=0&&x+dir<W && canSink(t,c[j]) && (c[i+dir]===T.EMPTY||(FLAGS[c[i+dir]]&(F_LIQUID|F_GAS)))){ swap(i,j); continue; }
          j=below-dir; if(x-dir>=0&&x-dir<W && canSink(t,c[j]) && (c[i-dir]===T.EMPTY||(FLAGS[c[i-dir]]&(F_LIQUID|F_GAS)))){ swap(i,j); continue; }
        }
        // spread sideways
        const disp = t===T.WATER?5 : t===T.ACID?4 : t===T.OIL?4 : t===T.LAVA?2 : 1;
        let nx=x, moved=false;
        for(let s=0;s<disp;s++){
          const tx=nx+dir; if(tx<0||tx>=W) break;
          const tj=c[row+tx];
          if(tj===T.EMPTY||(FLAGS[tj]&F_GAS)){ nx=tx; moved=true; }
          else if((FLAGS[tj]&F_LIQUID) && DENS[tj]<DENS[t] && Math.random()<0.3){ nx=tx; moved=true; break; }
          else break;
        }
        if(moved){ swap(i,row+nx); continue; }
        // try other way
        nx=x; moved=false;
        for(let s=0;s<disp;s++){
          const tx=nx-dir; if(tx<0||tx>=W) break;
          const tj=c[row+tx];
          if(tj===T.EMPTY||(FLAGS[tj]&F_GAS)){ nx=tx; moved=true; } else break;
        }
        if(moved){ swap(i,row+nx); }
        continue;
      }

      // ---------- GASES ----------
      if(f&F_GAS){
        if(t===T.FIRE){
          let life=m[i];
          // water nearby kills fire
          if(tb===T.WATER||ta===T.WATER||tl===T.WATER||tr===T.WATER){ c[i]=T.STEAM; m[i]=30; continue; }
          // ignite neighbours
          for(let n=0;n<8;n++){
            const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue;
            const j=ny*W+nx, tj=c[j];
            if(tj===T.PLAYER||tj===T.PLAYERHEAD){ if(SIM.playerWet){ c[i]=T.STEAM; m[i]=20; break; } if(Math.random()<0.15) hurtPlayer(j,'fire'); }
            else if((FLAGS[tj]&F_FLAM) && Math.random()<IGNITE[tj]) ignite(j,tj);
            else if(tj===T.ICE && Math.random()<0.1) c[j]=T.WATER;
            else if(tj===T.SAND && Math.random()<0.0005) c[j]=T.GLASS;
          }
          // smoke
          if(ta===T.EMPTY && r<0.08){ c[above]=T.SMOKE; m[above]=(20+Math.random()*40)|0; up[above]=P; }
          life--; 
          if(life<=0){
            if(r<0.1 && (FLAGS[tb]&F_SOLID)) { c[i]=T.ASH; }
            else if(r<0.35){ c[i]=T.SMOKE; m[i]=20; }
            else c[i]=T.EMPTY;
            continue;
          }
          m[i]=life;
          if(life<12 || r<0.08){ // flicker upward
            if(above>=0 && ta===T.EMPTY && r<0.7){ swap(i,above); continue; }
            const dir=r<0.5?1:-1; const nx=x+dir;
            if(nx>=0&&nx<W&&above>=0 && c[above+dir]===T.EMPTY){ swap(i,above+dir); continue; }
          }
          continue;
        }
        // generic gas: smoke, steam, spore, spark
        let life=m[i];
        if(t===T.SPORE){
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ c[i]=T.FIRE; m[i]=4; continue; }
          if(r<0.02) life--; 
        } else if(t===T.STEAM){
          life--; if(ta!==T.EMPTY && !(FLAGS[ta]&F_GAS)) life-=4;
          if(y<48 && r<0.02 && (ta===T.CLOUD||tl===T.CLOUD||tr===T.CLOUD||r<0.004)){ c[i]=T.CLOUD; continue; }
          if(life<=0){ c[i]=r<0.35?T.WATER:T.EMPTY; continue; }
        } else if(t===T.SPARK){
          life--; if(life<=0){ c[i]=T.EMPTY; continue; }
          for(let n=0;n<8;n++){ const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx, tj=c[j]; if((FLAGS[tj]&F_FLAM)&&Math.random()<IGNITE[tj]*0.5) ignite(j,tj); }
        } else { life--; if(t===T.DUST && r<0.3) life--; }
        if(life<=0){ c[i]=T.EMPTY; continue; }
        m[i]=life;
        if(r<0.15) continue; // drift lazily
        // rise
        if(above>=0 && gasCanEnter(ta) && r<0.75){ swap(i,above); continue; }
        const dir=r<0.5?1:-1; const nx=x+dir;
        if(nx>=0&&nx<W){
          if(above>=0 && gasCanEnter(c[above+dir]) && r<0.9){ swap(i,above+dir); continue; }
          if(gasCanEnter(c[i+dir]) && c[i+dir]!==t){ swap(i,i+dir); continue; }
        }
        continue;
      }

      // ---------- ACTIVE STATICS ----------
      switch(t){
        case T.WOOD: {
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          const g=m[i];
          if(g>0){
            if(ta===T.EMPTY && r<0.08){ c[above]=T.WOOD; m[above]=g-1; m[i]=0;
              if(g===1){ // crown
                for(let dy=-3;dy<=0;dy++) for(let dx=-3;dx<=3;dx++){
                  if(Math.abs(dx)+Math.abs(dy)>4 || Math.random()<0.25) continue;
                  const nx=x+dx, ny=y-1+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
                  const j=ny*W+nx; if(c[j]===T.EMPTY){ c[j]=T.LEAF; }
                }
              }
            } else if(ta!==T.EMPTY && ta!==T.WOOD) m[i]=0;
          }
          break;
        }
        case T.LEAF:
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          if(tb===T.EMPTY && r<0.00015){ c[below]=T.VINE; m[below]=(8+Math.random()*14)|0; }
          else if(tb===T.EMPTY && r<0.00003){ c[below]=T.SEED; }
          break;
        case T.GRASS:
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          if(tb!==T.DIRT&&tb!==T.GRASS&&tb!==T.MUD&&tb!==T.STONE&&tb!==T.BEDROCK){ c[i]=T.SEED; break; }
          if(tb===T.WATER){ c[i]=T.EMPTY; }
          break;
        case T.VINE:
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          if(ta!==T.VINE && ta!==T.LEAF && ta!==T.WOOD && ta!==T.STONE && ta!==T.DIRT && ta!==T.GRASS && ta!==T.MOSS && ta!==T.PLAYER && ta!==T.PLAYERHEAD && ta!==T.BEDROCK && ta!==T.CLOUD){ c[i]=T.EMPTY; break; }
          if(m[i]>0 && tb===T.EMPTY && r<0.04){ c[below]=T.VINE; m[below]=m[i]-1; m[i]=0; }
          break;
        case T.ICE:
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<0.3) c[i]=T.WATER; }
          break;
        case T.STONE: { // cave-in: stone with no solid neighbour on any side crumbles to rubble
          if(r>0.2) break;
          const sl=FLAGS[tl]&F_SOLID, sr=FLAGS[tr]&F_SOLID, sa=FLAGS[ta]&F_SOLID, sb=FLAGS[tb]&F_SOLID;
          if(!sl&&!sr&&!sa&&!sb){ c[i]=T.RUBBLE; break; }
          if(!sb && !sa && r<0.03 && !(sl&&sr)){ c[i]=T.RUBBLE; }   // thin ledges with a gap below slowly shed
          break; }
        case T.BEANSTALK: { // fast climbing stalk: grows upward while it has growth left, sprouts leaves
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          const g=m[i];
          if(g>0 && r<0.35){
            if(ta===T.EMPTY||(FLAGS[ta]&F_GAS)||ta===T.LEAF){ c[above]=T.BEANSTALK; m[above]=g-1; m[i]=0; up[above]=P;
              if((g&7)===0){ const side=(g&8)?1:-1; const nx=x+side; if(nx>=0&&nx<W&&c[i+side]===T.EMPTY) c[i+side]=T.LEAF; if(nx+side>=0&&nx+side<W&&c[i+side*2]===T.EMPTY&&r<0.15) c[i+side*2]=T.LEAF; } }
            else if(FLAGS[ta]&F_POWDER){ swap(i,above); m[i]=g; } // pushes up through loose ground
            else m[i]=0;
          }
          if(tb===T.EMPTY && r<0.02) c[i]=T.EMPTY;   // no support below: withers
          break; }
        case T.CLOUD:
          if(tb===T.EMPTY && r<(ta===T.CLOUD?0.0025:0.0005)){ c[below]=T.WATER; up[below]=P; }
          else if(r<0.00015 && ta!==T.CLOUD){ c[i]=T.EMPTY; }
          else if(r<0.01){ const dir=((S.frame>>8)&1)?1:-1; const nx=x+dir; if(nx>=0&&nx<W&&c[i+dir]===T.EMPTY) swap(i,i+dir); }
          break;
        case T.SPRING:
          if(tb===T.EMPTY && r<0.12){ c[below]=T.WATER; up[below]=P; }
          else if(r<0.03){ if(tl===T.EMPTY){ c[i-1]=T.WATER; } else if(tr===T.EMPTY){ c[i+1]=T.WATER; } }
          break;
        case T.GEYSER: {
          const g=(m[i]+1)&255; m[i]=g;
          if(g>170 && ta===T.EMPTY){ c[above]=T.STEAM; m[above]=(90+Math.random()*40)|0; up[above]=P; }
          else if(g>150 && ta===T.EMPTY && r<0.2){ c[above]=T.STEAM; m[above]=40; up[above]=P; }
          break;
        }
        case T.EMBER: {
          let life=m[i]; life--;
          if(tb===T.WATER||ta===T.WATER||tl===T.WATER||tr===T.WATER){ c[i]=T.ASH; break; }
          if(life<=0){ c[i]=T.ASH; break; } m[i]=life;
          if(r<0.05){ for(let n=0;n<8;n++){ const nx=x+DX8[n],ny=y+DY8[n]; if(nx<0||ny<0||nx>=W||ny>=H) continue; const j=ny*W+nx, tj=c[j]; if(tj===T.PLAYER||tj===T.PLAYERHEAD) hurtPlayer(j,'fire'); else if((FLAGS[tj]&F_FLAM)&&Math.random()<IGNITE[tj]) ignite(j,tj); } }
          if(ta===T.EMPTY && r<0.01){ c[above]=T.SPARK; m[above]=8; up[above]=P; }
          break;
        }
        case T.TORCH:
          if(ta===T.EMPTY && r<0.25){ c[above]=T.FIRE; m[above]=(3+Math.random()*4)|0; up[above]=P; }
          if(ta===T.WATER){ c[i]=T.WOOD; }
          break;
        case T.FUNGUS:
          if(isHot(tb)||isHot(ta)||isHot(tl)||isHot(tr)){ if(r<IGNITE[t]) { ignite(i,t); break; } }
          if(ta===T.EMPTY && r<0.002){ c[above]=T.SPORE; m[above]=(80+Math.random()*100)|0; up[above]=P; }
          else if(r<0.0004){ const dir=r<0.0002?1:-1; const nx=x+dir; if(nx>=0&&nx<W && c[i+dir]===T.DIRT && (y>0 && c[i+dir-W]===T.EMPTY)) c[i+dir]=T.FUNGUS; }
          if(tb===T.EMPTY) c[i]=T.SEED;
          break;
      }
    }
  }
}
