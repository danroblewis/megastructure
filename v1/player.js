// player.js — the player is a small cluster of cells living inside the grid.
'use strict';

const BODY = [];
(function(){
  // head (hair row then face), torso, legs — anchor is bottom-centre.
  for(let dx=-1;dx<=1;dx++) BODY.push({dx,dy:-7,head:true,part:0});
  for(let dx=-1;dx<=1;dx++) BODY.push({dx,dy:-6,head:false,part:dx===1?1:0});   // face, eye slot
  for(let dy=-5;dy<=-3;dy++) for(let dx=-1;dx<=1;dx++) BODY.push({dx,dy,head:false,part:2}); // shirt
  for(let dx=-1;dx<=1;dx++) BODY.push({dx,dy:-2,head:false,part:3}); // trousers
  BODY.push({dx:-1,dy:-1,head:false,part:4}); BODY.push({dx:1,dy:-1,head:false,part:4}); // boots
})();
const GRAB_OFFSETS=[]; for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) if(dx*dx+dy*dy<=18) GRAB_OFFSETS.push([dx,dy]);
GRAB_OFFSETS.sort((a,b)=>(a[0]*a[0]+a[1]*a[1])-(b[0]*b[0]+b[1]*b[1]));
const POWDER_TYPES = new Set([T.SAND,T.DIRT,T.MUD,T.SNOW,T.ASH,T.GUNPOWDER,T.SEED,T.GRASS,T.MOSS,T.FUNGUS,T.GOLD]);

const KEEP_UNDER=new Set([T.VINE,T.LEAF,T.BEANSTALK]);
function passableForPlayer(t){
  if(t===T.EMPTY||t===T.VINE||t===T.LEAF||t===T.BEANSTALK||t===T.GOLD||t===T.FLAG||t===T.PLAYER||t===T.PLAYERHEAD) return true;
  const f=FLAGS[t]; return (f&(F_GAS|F_LIQUID))!==0;
}

const PLAYER = {
  ax:0, ay:0, vx:0, vy:0, accX:0, accY:0,
  slots:[], lifted:false, prev:[],
  grounded:false, coyote:0, inLiquid:0, inHoney:0, inSlime:0, onVine:false, inSteam:0,
  facing:1, wallTouch:0, wallJumps:0, dead:false, deadTimer:0, regen:0, burrowT:0, spikeT:0, hurtFlash:0,
  gold:0, maxX:0, minY:9999, maxY:0, checkpoint:{x:0,y:0}, won:false, winTime:0, deaths:0,
  jumpBuffered:false, startTime:0,
  pouch:[], POUCH_MAX:160, grabT:0, stomps:0, sinkT:0,
  wet:0, oily:0, burning:0, slimed:0, onIce:false, hotNear:false, kx:0, ky:0, prevVy:0, events:[],

  spawn(x,y){
    this.ax=x; this.ay=y; this.vx=0; this.vy=0; this.accX=0; this.accY=0;
    this.slots=BODY.map(b=>({dx:b.dx,dy:b.dy,head:b.head,part:b.part,alive:true,under:T.EMPTY}));
    this.dead=false; this.lifted=true; this.pouch.length=0; this.wet=0; this.oily=0; this.burning=0; this.slimed=0; this.kx=0; this.ky=0; this.vx=0; // nothing placed yet
    // clear space
    for(const s of this.slots){ const i=(y+s.dy)*SIM.W+x+s.dx; const t=SIM.cells[i]; if(!passableForPlayer(t)) SIM.cells[i]=T.EMPTY; }
    this.place();
    this.checkpoint={x,y}; this.justSpawned=true;
  },

  aliveCount(){ let n=0; for(const s of this.slots) if(s.alive) n++; return n; },

  lift(){
    if(this.lifted) return;
    const W=SIM.W, c=SIM.cells; this.prev.length=0;
    for(const s of this.slots){ if(!s.alive) continue; const i=(this.ay+s.dy)*W+this.ax+s.dx; c[i]=s.under; s.under=T.EMPTY; this.prev.push(i); }
    this.lifted=true;
  },

  place(){
    const W=SIM.W, H=SIM.H, c=SIM.cells, m=SIM.meta;
    const displaced=[]; const occupied=new Set();
    for(const s of this.slots){ if(!s.alive) continue; occupied.add((this.ay+s.dy)*W+this.ax+s.dx); }
    for(const s of this.slots){
      if(!s.alive) continue;
      const x=this.ax+s.dx, y=this.ay+s.dy;
      if(x<0||x>=W||y<0||y>=H){ s.alive=false; continue; }
      const i=y*W+x; const t=c[i];
      if(s.dy===-6 && s.dx!==0) s.part = (s.dx===this.facing)?1:0;
      if(KEEP_UNDER.has(t)){ s.under=t; }
      else if(t===T.GOLD){ this.gold++; this.goldFlash=20; s.under=T.EMPTY; this.events.push('gold'); }
      else if(t===T.FLAG){ if(!this.won){ this.won=true; this.winTime=0; } s.under=T.FLAG; }
      else { if(t!==T.EMPTY && t!==T.PLAYER && t!==T.PLAYERHEAD) displaced.push([t,m[i]]); s.under=T.EMPTY; }
      c[i]=s.head?T.PLAYERHEAD:T.PLAYER; m[i]=s.part;
    }
    // push displaced fluids into vacated cells, else nearby empties
    let k=0;
    for(const d of displaced){
      let placed=false;
      while(k<this.prev.length){ const j=this.prev[k++]; if(!occupied.has(j) && c[j]===T.EMPTY){ c[j]=d[0]; m[j]=d[1]; placed=true; break; } }
      if(placed) continue;
      for(let r=1;r<5&&!placed;r++){
        for(let dy=-r;dy<=r&&!placed;dy++) for(let dx=-r;dx<=r;dx++){
          if(Math.abs(dx)!==r&&Math.abs(dy)!==r) continue;
          const nx=this.ax+dx, ny=this.ay-4+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const j=ny*W+nx; if(c[j]===T.EMPTY){ c[j]=d[0]; m[j]=d[1]; placed=true; break; }
        }
      }
    }
    this.lifted=false; this.prev.length=0;
  },

  // 0 = fits, 1 = blocked only by powder, 2 = blocked by solid
  fits(ax,ay){
    const W=SIM.W,H=SIM.H,c=SIM.cells; let code=0;
    for(const s of this.slots){
      if(!s.alive) continue;
      const x=ax+s.dx, y=ay+s.dy;
      if(x<0||x>=W||y<0||y>=H) return 2;
      const t=c[y*W+x];
      if(passableForPlayer(t)) continue;
      if(POWDER_TYPES.has(t)) code=Math.max(code,1); else return 2;
    }
    return code;
  },

  // what is the body touching / standing in?
  sense(){
    const W=SIM.W,H=SIM.H,c=SIM.cells;
    let liq=0, honey=0, slime=0, vine=0, steam=0, n=0, lava=0, water=0, oil=0, hot=false;
    for(const s of this.slots){
      if(!s.alive) continue; n++;
      const x=this.ax+s.dx, y=this.ay+s.dy; if(x<0||x>=W||y<0||y>=H) continue;
      const t=c[y*W+x];
      if(FLAGS[t]&F_LIQUID){ liq++; if(t===T.HONEY) honey++; if(t===T.SLIME) slime++; if(t===T.LAVA) lava++; if(t===T.WATER) water++; if(t===T.OIL) oil++; }
      if(t===T.VINE||t===T.BEANSTALK) vine++;
      if(t===T.STEAM) steam++;
      if(!hot && x>0&&x<W-1&&y>0&&y<H-1){ if(isHot(c[y*W+x-1])||isHot(c[y*W+x+1])||isHot(c[(y-1)*W+x])||isHot(c[(y+1)*W+x])) hot=true; }
    }
    this.inLiquid=n?liq/n:0; this.inHoney=n?honey/n:0; this.inSlime=n?slime/n:0; this.onVine=vine>0; this.inSteam=n?steam/n:0;
    this.inWater=n?water/n:0; this.inOil=n?oil/n:0; this.hotNear=hot;
    // ground check: anything non-passable directly under any foot-row cell
    let ground=false, bounce=false, spikes=0, slimeFloor=false;
    for(let dx=-1;dx<=1;dx++){
      const x=this.ax+dx, y=this.ay; if(y>=H||x<0||x>=W){ ground=true; continue; }
      const t=c[y*W+x];
      if(!passableForPlayer(t)||t===T.PLAYER||t===T.PLAYERHEAD){ if(t!==T.PLAYER&&t!==T.PLAYERHEAD) ground=true; if(t===T.BOUNCE) bounce=true; if(t===T.SPIKE) spikes++; if(t===T.SLIME) slimeFloor=true; }
    }
    // spikes beside
    for(const s of this.slots){ if(!s.alive) continue; const x=this.ax+s.dx,y=this.ay+s.dy; if(x>0&&x<W-1&&y>0&&y<H){ if(c[y*W+x-1]===T.SPIKE||c[y*W+x+1]===T.SPIKE||c[(y-1)*W+x]===T.SPIKE) spikes++; } }
    let ice=false; for(let dx=-1;dx<=1;dx++){ const t=SIM.get(this.ax+dx,this.ay); if(t===T.ICE||t===T.GLASS) ice=true; }
    this.grounded=ground; this.onBounce=bounce; this.touchingSpikes=spikes; this.onIce=ice;
  },

  hurt(idx, cause){
    if(this.dead) return;
    const W=SIM.W;
    for(const s of this.slots){
      if(!s.alive) continue;
      if((this.ay+s.dy)*W+this.ax+s.dx===idx){
        s.alive=false; this.hurtFlash=8; this.events.push('hurt');
        if(!this.lifted){ SIM.cells[idx]= cause==='acid'?T.SMOKE : cause==='blast'?T.SPARK : T.FIRE; SIM.meta[idx]= cause==='fire'||cause==='lava'?6:12; }
        if(KEEP_UNDER.has(s.under) && !this.lifted) SIM.cells[idx]=s.under;
        break;
      }
    }
    if(this.aliveCount()<9) this.die();
  },

  die(){
    if(this.dead) return;
    this.lift();
    const W=SIM.W;
    for(const s of this.slots){ if(!s.alive) continue; const i=(this.ay+s.dy)*W+this.ax+s.dx; SIM.cells[i]=Math.random()<0.5?T.SPARK:T.SMOKE; SIM.meta[i]=(10+Math.random()*20)|0; s.alive=false; }
    this.dead=true; this.deadTimer=70; this.deaths++; this.events.push('die');
  },

  update(inp){
    const W=SIM.W, H=SIM.H;
    if(this.dead){
      if(--this.deadTimer<=0){ this.spawn(this.checkpoint.x,this.checkpoint.y); }
      return;
    }
    if(this.won) this.winTime++;
    if(this.hurtFlash>0) this.hurtFlash--;
    if(this.goldFlash>0) this.goldFlash--;
    const wasGrounded=this.grounded, wasLiquid=this.inLiquid;
    this.sense();
    if(this.inLiquid>0.3 && wasLiquid<0.3 && this.vy>0.8) this.events.push('splash');
    // --- element status effects carried on the body ---
    if(this.inWater>0.2){ if(this.burning) this.events.push('hiss'); this.wet=240; this.burning=0; this.oily=0; }
    if(this.inOil>0.2) this.oily=900;
    if(this.inSlime>0.2) this.slimed=420;
    if(this.wet>0) this.wet--; if(this.oily>0) this.oily--; if(this.slimed>0) this.slimed--;
    if(this.oily && !this.burning && this.hotNear){ this.burning=200; this.events.push('ignite'); }
    if(this.burning>0){
      this.burning--; const W2=SIM.W;
      if(this.burning%32===0) this.hurtRandom('fire');
      for(const s of this.slots){ if(!s.alive||Math.random()>0.12) continue; const x=this.ax+s.dx+(Math.random()<0.5?-1:1), y=this.ay+s.dy-1; const i=y*W2+x; if(i>0&&i<SIM.cells.length&&SIM.cells[i]===T.EMPTY){ SIM.cells[i]=T.FIRE; SIM.meta[i]=(4+Math.random()*5)|0; } }
    }
    SIM.playerWet=this.wet>0;
    this.lift();

    // --- horizontal intent (momentum; ice is slippery, blasts shove you) ---
    const dir=inp.dir;
    let speed=0.95;
    if(this.inLiquid>0.5) speed=0.55;
    if(this.inHoney>0.3) speed=0.18;
    if(this.inSlime>0.3) speed=0.4;
    if(this.onVine) speed=0.6;
    if(this.slimed) speed*=0.85;
    if(dir!==0) this.facing=dir;
    { const target=dir*speed; const accel=this.onIce?0.03:this.grounded?0.3:0.14; const d=target-this.vx; this.vx+=Math.max(-accel,Math.min(accel,d)); }
    if(this.kx){ this.vx+=this.kx; this.kx*=0.55; if(Math.abs(this.kx)<0.03) this.kx=0; }
    if(this.ky){ this.vy+=this.ky; this.ky=0; this.grounded=false; }

    // --- vertical intent ---
    const g=0.14;
    if(this.onVine && !this.grounded){
      this.vy = inp.up? -0.75 : inp.down? 0.9 : 0;
      if(inp.jump){ this.vy=-1.9; this.vx=dir*1.2; this.onVine=false; this.ay-=0; }
    } else if(this.inLiquid>0.4){
      this.vy += this.inLiquid>0.8? -0.03 : g*0.5;
      if(inp.up||inp.jumpHeld) this.vy -= 0.09;
      if(inp.down) this.vy += 0.08;
      const cap = this.inHoney>0.3?0.25:0.9;
      this.vy=Math.max(-cap,Math.min(cap,this.vy));
      if(this.grounded && inp.jump){ this.vy=-1.4; }
      // leap out when near surface
      if(inp.jump && this.inLiquid<0.8){ this.vy=-1.8; }
    } else {
      if(this.grounded){
        if(this.vy>0) this.vy=0;
        this.coyote=6;
        if(this.onBounce){ this.vy=-3.6; }
      } else { if(this.coyote>0) this.coyote--; }
      this.vy += g;
      if(this.inSteam>0.2){ this.vy -= 0.32; if(this.vy<-1.6) this.vy=-1.6; }
      if(this.vy>2.8) this.vy=2.8;
      if(inp.jump && (this.grounded||this.coyote>0)){ this.vy = (this.inSlime>0||this.slimed)?-2.6:-2.05; this.coyote=0; this.grounded=false; this.events.push('jump'); }
      if(this.vy<-4.5) this.vy=-4.5;
      if(!inp.jumpHeld && this.vy<-0.8) this.vy=-0.8; // short hop
    }

    // wall jump: airborne, pressing into a wall
    if(inp.jump && !this.grounded && this.coyote===0 && this.wallTouch!==0 && this.wallTouch===dir && this.inLiquid<0.4 && this.wallJumps<3){
      this.vy=-1.7; this.wallJumps++;
    }
    if(this.grounded) this.wallJumps=0;
    this.wallTouch=0;
    // --- integrate: horizontal ---
    this.accX += this.vx;
    let guard=0;
    while(Math.abs(this.accX)>=1 && guard++<4){
      const sx=this.accX>0?1:-1; this.accX-=sx;
      let f=this.fits(this.ax+sx,this.ay);
      if(f===0){ this.ax+=sx; continue; }
      // step up slopes
      if(this.fits(this.ax+sx,this.ay-1)===0 && this.fits(this.ax,this.ay-1)===0){ this.ax+=sx; this.ay-=1; continue; }
      if((this.grounded||this.onVine) && this.fits(this.ax+sx,this.ay-2)===0 && this.fits(this.ax,this.ay-2)===0){ this.ax+=sx; this.ay-=2; continue; }
      if(f===1){ // burrow through powder slowly
        this.burrowT++;
        if(this.burrowT%5===0){ this.ax+=sx; }
        this.accX=0; break;
      }
      this.accX=0; this.vx=0; this.wallTouch=sx; break;
    }

    // --- integrate: vertical ---
    this.accY += this.vy; guard=0;
    while(Math.abs(this.accY)>=1 && guard++<4){
      const sy=this.accY>0?1:-1; this.accY-=sy;
      const f=this.fits(this.ax,this.ay+sy);
      if(f===0){ this.ay+=sy; continue; }
      if(f===1 && sy<0 && inp.jumpHeld){ // push up through loose stuff overhead
        if(++this.burrowT%9===0){ this.ay-=1; }
        this.accY=0; break;
      }
      if(sy>0){ this.grounded=true; this.vy=0; } else { this.vy=0; }
      this.accY=0; break;
    }
    // sinking: hold down while standing on loose ground (sand, dirt, snow, grass...) to burrow downward
    if(inp.down && this.grounded && this.inLiquid<0.4 && !this.onVine && this.fits(this.ax,this.ay+1)===1){
      if(++this.sinkT>=4){ this.sinkT=0; this.ay+=1; this.vy=0; this.accY=0; }
    } else this.sinkT=0;
    if(!inp.down && dir===0) this.burrowT=0;

    if(this.grounded && !wasGrounded && this.prevVy>1.2){
      this.events.push('land:'+this.prevVy.toFixed(1));
      const W2=SIM.W; for(let dx=-2;dx<=2;dx++){ const i=(this.ay-1)*W2+this.ax+dx; if(i>0&&i<SIM.cells.length&&SIM.cells[i]===T.EMPTY&&Math.random()<0.6){ SIM.cells[i]=T.DUST; SIM.meta[i]=(4+Math.random()*6)|0; } }
    }
    this.prevVy=this.vy;
    this.place();

    this.tool(inp);
    // spikes
    if(this.touchingSpikes>0){ if(++this.spikeT>=8){ this.spikeT=0; this.hurtRandom('blast'); } } else this.spikeT=0;

    // regen
    if(++this.regen>=40){ this.regen=0;
      for(const s of this.slots){ if(s.alive) continue; const i=(this.ay+s.dy)*W+this.ax+s.dx; if(i>=0&&i<W*H&&passableForPlayer(SIM.cells[i])&&SIM.cells[i]!==T.GOLD&&SIM.cells[i]!==T.FLAG){ s.alive=true; s.under=KEEP_UNDER.has(SIM.cells[i])?SIM.cells[i]:T.EMPTY; SIM.cells[i]=s.head?T.PLAYERHEAD:T.PLAYER; SIM.meta[i]=s.part; break; } }
    }

    // stats / checkpoints
    const cx=this.ax, cy=this.ay-4;
    if(cx>this.maxX){ this.maxX=cx; }
    if(cy<this.minY) this.minY=cy; if(cy>this.maxY) this.maxY=cy;
    if(this.grounded && this.inLiquid===0 && this.touchingSpikes===0 && cx>this.checkpoint.x+60){ this.checkpoint={x:cx,y:this.ay}; }
  },

  // grab: vacuum nearby cells into the pouch (nearest first). spray: emit them in front.
  tool(inp){
    const W=SIM.W,H=SIM.H,c=SIM.cells,m=SIM.meta;
    const cx=this.ax+this.facing*2, cy=this.ay-4;
    if(inp.grab && this.pouch.length<this.POUCH_MAX){
      this.grabT++;
      let budget=2;
      for(const [dx,dy] of GRAB_OFFSETS){
        if(budget<=0) break;
        const x=cx+dx,y=cy+dy; if(x<0||y<0||x>=W||y>=H) continue;
        const i=y*W+x, t=c[i];
        if(t===T.EMPTY||t===T.PLAYER||t===T.PLAYERHEAD||t===T.BEDROCK||t===T.FLAG||t===T.SPRING||t===T.GEYSER||t===T.BOUNCE||t===T.CLOUD||CREATURE_TYPES.has(t)) continue;
        if(FLAGS[t]&F_GAS) continue;
        if(t===T.GOLD){ this.gold++; this.goldFlash=20; c[i]=T.EMPTY; continue; }
        if(FLAGS[t]&F_STATIC){ if(this.grabT%4!==0) continue; budget=0; } // digging solids is slower
        this.pouch.push((t===T.LEAF&&Math.random()<0.4?T.SEED:t)|(m[i]<<8)); c[i]=T.EMPTY; m[i]=0; budget--; if(this.grabT%6===0) this.events.push('grab');
        if(this.pouch.length>=this.POUCH_MAX) break;
      }
    }
    if(inp.spray && this.pouch.length){
      for(let k=0;k<2 && this.pouch.length;k++){
        const v=this.pouch[this.pouch.length-1]; const t=v&255, mt=v>>8;
        const ux = inp.up? (this.facing*0.4) : inp.down? this.facing*0.6 : this.facing;
        const uy = inp.up? -1 : inp.down? 0.9 : -0.15;
        let placed=false;
        for(let d=4;d<=8&&!placed;d++){
          const x=Math.round(this.ax+ux*d+(Math.random()-0.5)*2), y=Math.round(cy+uy*d+(Math.random()-0.5)*2);
          if(x<0||y<0||x>=W||y>=H) break;
          const i=y*W+x; if(c[i]===T.EMPTY||(FLAGS[c[i]]&F_GAS)){ c[i]=t; m[i]=mt; SIM.shade[i]=(Math.random()*256)|0; SIM.upd[i]=SIM.parity; placed=true; }
        }
        if(placed){ this.pouch.pop(); if(SIM.frame%5===0) this.events.push('spray'); } else break;
      }
    }
  },

  blast(cx,cy,r){
    if(this.dead) return;
    const dx=this.ax-cx, dy=(this.ay-4)-cy; const d=Math.hypot(dx,dy); const R=r*3;
    if(d>R) return; const f=1-d/R;
    this.kx+=(dx/(d||1))*4*f; this.ky+=-3.4*f+(dy/(d||1))*1.2*f; this.accY=0;
    this.events.push('blasted');
  },

  hurtRandom(cause){
    const alive=this.slots.filter(s=>s.alive); if(!alive.length) return;
    const s=alive[(Math.random()*alive.length)|0];
    this.hurt((this.ay+s.dy)*SIM.W+this.ax+s.dx, cause);
  },
};

SIM.onPlayerHit=(idx,cause)=>PLAYER.hurt(idx,cause);
