// creatures.js — enemies built from grid cells, moved with the same lift/place scheme as the player.
'use strict';

const SHAPES = {
  blob:   { t:T.BLOB,    cells:[[-1,-3],[0,-3],[-1,-2],[0,-2],[-2,-2],[1,-2],[-2,-1],[-1,-1],[0,-1],[1,-1]] },
  crawler:{ t:T.CRAWLER, cells:[[-1,-2],[0,-2],[1,-2],[-1,-1],[0,-1],[1,-1],[-2,-1],[2,-1]] },
  wisp:   { t:T.WISP,    cells:[[0,-2],[-1,-1],[0,-1],[1,-1],[0,0]] },
};
function creaturePassable(t){
  if(t===T.EMPTY||t===T.VINE||t===T.LEAF||t===T.BEANSTALK) return true;
  const f=FLAGS[t]; return (f&(F_GAS|F_LIQUID))!==0;
}

class Creature {
  constructor(kind,x,y){
    const sh=SHAPES[kind]; this.kind=kind; this.t=sh.t;
    this.slots=sh.cells.map(([dx,dy])=>({dx,dy,alive:true}));
    this.ax=x; this.ay=y; this.vx=0; this.vy=0; this.accX=0; this.accY=0; this.dir=Math.random()<0.5?-1:1;
    this.placed=false; this.dead=false; this.timer=(Math.random()*100)|0; this.hitT=0; this.grounded=false; this.wobble=Math.random()*6.28;
  }
  alive(){ let n=0; for(const s of this.slots) if(s.alive) n++; return n; }
  lift(){
    if(!this.placed) return; const W=SIM.W,c=SIM.cells;
    for(const s of this.slots){ if(!s.alive) continue; const i=(this.ay+s.dy)*W+this.ax+s.dx; if(c[i]===this.t) c[i]=T.EMPTY; else s.alive=false; }
    this.placed=false;
  }
  place(){
    const W=SIM.W,H=SIM.H,c=SIM.cells,m=SIM.meta;
    for(const s of this.slots){
      if(!s.alive) continue; const x=this.ax+s.dx,y=this.ay+s.dy;
      if(x<0||x>=W||y<0||y>=H){ s.alive=false; continue; }
      const i=y*W+x, t=c[i];
      if(!creaturePassable(t)){ s.alive=false; continue; } // buried / crushed
      if(this.kind==='wisp' && (t===T.WATER||t===T.SNOW)){ s.alive=false; c[i]=T.STEAM; m[i]=30; continue; }
      c[i]=this.t; m[i]=0;
    }
    this.placed=true;
  }
  fits(ax,ay){
    const W=SIM.W,H=SIM.H,c=SIM.cells;
    for(const s of this.slots){ if(!s.alive) continue; const x=ax+s.dx,y=ay+s.dy; if(x<0||x>=W||y<0||y>=H) return false; if(!creaturePassable(c[y*W+x])) return false; }
    return true;
  }
  hazards(){
    const W=SIM.W,H=SIM.H,c=SIM.cells,m=SIM.meta; let liquid=0;
    for(const s of this.slots){
      if(!s.alive) continue; const x=this.ax+s.dx,y=this.ay+s.dy;
      for(let n=0;n<4;n++){
        const nx=x+(n===0?-1:n===1?1:0), ny=y+(n===2?-1:n===3?1:0); if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const tj=c[ny*W+nx];
        if(this.kind==='wisp'){
          if(tj===T.WATER||tj===T.SNOW||tj===T.ICE){ s.alive=false; c[ny*W+nx]=T.STEAM; m[ny*W+nx]=40; break; }
          if((FLAGS[tj]&F_FLAM) && Math.random()<IGNITE[tj]*0.3) ignite(ny*W+nx,tj);
        } else {
          if(FLAGS[tj]&F_LIQUID) liquid++;
          if(isHot(tj) && Math.random()<0.12){ s.alive=false; break; }
          if(tj===T.ACID && Math.random()<0.1){ s.alive=false; break; }
        }
      }
    }
    this.inLiquid=liquid>0;
  }
  die(){
    this.lift(); const W=SIM.W,c=SIM.cells,m=SIM.meta;
    for(const s of this.slots){ if(!s.alive) continue; const i=(this.ay+s.dy)*W+this.ax+s.dx; if(i<0||i>=c.length) continue;
      if(this.kind==='blob'){ c[i]=T.SLIME; } else if(this.kind==='wisp'){ c[i]=Math.random()<0.5?T.SPARK:T.SMOKE; m[i]=12; } else { c[i]=Math.random()<0.5?T.ASH:T.SMOKE; m[i]=12; }
      s.alive=false; }
    if(this.kind!=='wisp' && Math.random()<0.35){ const i=(this.ay-2)*W+this.ax; if(c[i]===T.EMPTY||c[i]===T.SLIME||c[i]===T.ASH) c[i]=T.GOLD; }
    this.dead=true; CREATURES.kills++;
  }
  update(){
    const P=PLAYER; this.timer++;
    this.lift();
    if(this.alive()<Math.ceil(this.slots.length*0.45)){ this.die(); return; }
    this.hazards();
    const pdx=P.ax-this.ax, pdy=(P.ay-4)-(this.ay-1);
    const near=!P.dead && Math.abs(pdx)<80 && Math.abs(pdy)<50;
    // --- AI ---
    if(this.kind==='blob'){
      if(near){ this.dir=pdx>2?1:pdx<-2?-1:0; } else if(this.timer%150===0){ this.dir=((Math.random()*3)|0)-1; }
      this.vx=this.dir*0.38;
      const below=this.fits(this.ax,this.ay+1); this.grounded=!below;
      if(this.inLiquid){ this.vy=Math.max(-0.4,this.vy-0.08); }
      else { this.vy+=0.14; if(this.vy>2.4) this.vy=2.4; }
      if(this.grounded && this.vy>0) this.vy=0;
      if(this.grounded && (this.timer%70===0 || this.blocked) && !this.inLiquid){ this.vy=near?-1.7:-1.2; }
    } else if(this.kind==='crawler'){
      this.vx=this.dir*0.32;
      const below=this.fits(this.ax,this.ay+1); this.grounded=!below;
      this.vy = this.inLiquid? Math.min(0.5,this.vy+0.05) : Math.min(2.4,this.vy+0.14);
      if(this.grounded&&this.vy>0) this.vy=0;
      // turn at edges
      if(this.grounded){ const fx=this.ax+this.dir*3, fy=this.ay; const t=SIM.get(fx,fy); const t2=SIM.get(fx,fy+1); if(creaturePassable(t)&&creaturePassable(t2)) this.dir=-this.dir; }
      if(this.blocked) this.dir=-this.dir;
    } else { // wisp: flies toward the player with a wobble
      this.wobble+=0.07;
      let tx=P.ax, ty=P.ay-6;
      if(!near){ tx=this.ax+Math.cos(this.wobble*0.5)*30; ty=this.ay+Math.sin(this.wobble*0.3)*10; }
      const dx=tx-this.ax, dy=ty-this.ay, d=Math.hypot(dx,dy)||1;
      const sp=near?0.34:0.2;
      this.vx=dx/d*sp+Math.cos(this.wobble)*0.3; this.vy=dy/d*sp+Math.sin(this.wobble*1.3)*0.3;
      if(this.blocked && Math.random()<0.3){ this.vx=-this.vx; this.vy=-0.5; }
      if(Math.random()<0.02){ const i=(this.ay-3)*SIM.W+this.ax; if(i>0&&SIM.cells[i]===T.EMPTY){ SIM.cells[i]=T.SPARK; SIM.meta[i]=6; } }
    }
    if(this.vx!==0) this.facing=this.vx>0?1:-1;
    // --- integrate ---
    this.blocked=false;
    this.accX+=this.vx; let g=0;
    while(Math.abs(this.accX)>=1&&g++<3){ const sx=this.accX>0?1:-1; this.accX-=sx;
      if(this.fits(this.ax+sx,this.ay)) this.ax+=sx;
      else if(this.kind!=='wisp' && this.fits(this.ax+sx,this.ay-1) && this.fits(this.ax,this.ay-1)){ this.ax+=sx; this.ay-=1; }
      else { this.blocked=true; this.accX=0; break; } }
    this.accY+=this.vy; g=0;
    while(Math.abs(this.accY)>=1&&g++<3){ const sy=this.accY>0?1:-1; this.accY-=sy;
      if(this.fits(this.ax,this.ay+sy)) this.ay+=sy; else { if(sy>0) this.grounded=true; this.vy=0; this.accY=0; if(this.kind==='wisp') this.blocked=true; break; } }
    this.place();
    // --- player contact: stomp or hurt ---
    if(!P.dead){
      let minY=99,maxY=-99,minX=99,maxX=-99;
      for(const s of this.slots){ if(!s.alive) continue; minY=Math.min(minY,s.dy); maxY=Math.max(maxY,s.dy); minX=Math.min(minX,s.dx); maxX=Math.max(maxX,s.dx); }
      const left=this.ax+minX, right=this.ax+maxX, top=this.ay+minY, bottom=this.ay+maxY;
      const pl=P.ax-1, pr=P.ax+1, pt=P.ay-7, pb=P.ay-1;
      const overlapX = pr>=left-1 && pl<=right+1;
      if(overlapX && this.kind!=='wisp' && P.vy>0.2 && pb>=top-2 && pb<=top+1){ // stomp
        this.die(); P.vy=-1.7; P.accY=0; P.stomps=(P.stomps||0)+1; P.events.push('stomp'); return;
      }
      const touching = overlapX && pb>=top-1 && pt<=bottom+1;
      if(touching){ if(++this.hitT>=(this.kind==='wisp'?30:14)){ this.hitT=0; P.hurtRandom(this.kind==='wisp'?'fire':'blast'); } }
      else this.hitT=0;
    }
  }
}

const CREATURES = {
  list:[], kills:0,
  reset(){ this.list=[]; this.kills=0; for(const s of WORLD.spawns||[]) this.list.push(new Creature(s.kind,s.x,s.y)); },
  update(x0,y0,x1,y1){
    for(let k=this.list.length-1;k>=0;k--){
      const e=this.list[k];
      if(e.dead){ this.list.splice(k,1); continue; }
      const inside = e.ax>x0+6 && e.ax<x1-6 && e.ay>y0+6 && e.ay<y1-6;
      if(inside){ e.update(); }
      else if(e.placed){ e.lift(); }
    }
  },
};
