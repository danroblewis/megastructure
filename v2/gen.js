// v2/gen.js — procedural megastructure: chambers, ducts, shafts, machines, sources
'use strict';
const M={FLUID:0,WALL:1,VENT:2,DRAIN:3,MOVING:4,BURNER:5,COOLER:6,FUEL:7,SPORE:8,EXIT:9,CHECK:10,GRATE:11};
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const GEN={
  build(W,H,seed){
    const R=mulberry32(seed); const ri=(a,b)=>a+Math.floor(R()*(b-a+1));
    const mask=new Uint8Array(W*H*4);
    const type=new Uint8Array(W*H); type.fill(M.WALL);
    const set=(x,y,t)=>{ if(x<0||y<0||x>=W||y>=H) return; type[y*W+x]=t; };
    const rect=(x0,y0,x1,y1,t)=>{ x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1); for(let y=Math.max(0,Math.min(y0,y1));y<=Math.min(H-1,Math.max(y0,y1));y++) for(let x=Math.max(0,Math.min(x0,x1));x<=Math.min(W-1,Math.max(x0,x1));x++) type[y*W+x]=t; };
    const disc=(cx,cy,r,t)=>{ for(let y=cy-r;y<=cy+r;y++) for(let x=cx-r;x<=cx+r;x++){ if((x-cx)*(x-cx)+(y-cy)*(y-cy)<=r*r) set(x,y,t); } };
    const machines=[], cores=[], drones=[], checkpoints=[], rooms=[];
    const dirs=new Int8Array(W*H*2);
    const setDir=(x,y,dx,dy)=>{ if(x<0||y<0||x>=W||y>=H) return; dirs[(y*W+x)*2]=dx; dirs[(y*W+x)*2+1]=dy; };
    // ---- slot grid, snake path ----
    const cols=Math.max(3,Math.round(W/250)), tiers=Math.max(1,Math.floor(H/330));
    const sw=W/cols, shh=H/tiers;
    let idx=0;
    for(let tier=0;tier<tiers;tier++){
      for(let k=0;k<cols;k++){
        const col=(tier%2===0)?k:cols-1-k;
        const big=R()<0.25;
        const w=Math.round(sw*(big?0.9:0.55+R()*0.3)), h=Math.round(shh*(big?0.88:0.45+R()*0.4));
        const sx0=col*sw+12, sx1=(col+1)*sw-12, sy0=tier*shh+14, sy1=(tier+1)*shh-14;
        const x0=Math.round(sx0+R()*(sx1-sx0-w)), y0=Math.round(sy0+R()*(sy1-sy0-h));
        rooms.push({x0,x1:x0+w,y0,y1:y0+h,cx:x0+w/2,cy:y0+h/2,big,i:idx++,tier,col});
      }
    }
    for(const r of rooms) rect(r.x0,r.y0,r.x1,r.y1,M.FLUID);
    // organic reshaping: the walls of each chamber bulge outward and pinch inward with low-frequency noise
    const noiseTbl=new Float32Array(4096); for(let i=0;i<4096;i++) noiseTbl[i]=R();
    const vnoise=(x,y)=>{ const xi=Math.floor(x), yi=Math.floor(y), fx=x-xi, fy=y-yi; const h=(i,j)=>noiseTbl[((i*73+j*151)&4095+4096)&4095]; const sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
      return (h(xi,yi)*(1-sx)+h(xi+1,yi)*sx)*(1-sy)+(h(xi,yi+1)*(1-sx)+h(xi+1,yi+1)*sx)*sy; };
    const AMP=14;
    for(const r of rooms){
      for(let y=r.y0-AMP-1;y<=r.y1+AMP+1;y++) for(let x=r.x0-AMP-1;x<=r.x1+AMP+1;x++){
        if(x<4||y<4||x>=W-4||y>=H-4) continue;
        const dx=Math.max(r.x0-x,0,x-r.x1), dy=Math.max(r.y0-y,0,y-r.y1);
        const inside=(x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1);
        const d= inside? -Math.min(x-r.x0,r.x1-x,y-r.y0,r.y1-y) : Math.hypot(dx,dy);   // signed distance to the rectangle
        const n=(vnoise(x/46+r.i*7.3,y/46+r.i*3.1)-0.5)*2*AMP + (vnoise(x/16+r.i,y/16)-0.5)*5 + (vnoise(x/5,y/5)-0.5)*1.5;
        if(d<n){ if(type[y*W+x]===M.WALL) type[y*W+x]=M.FLUID; }
        else if(inside && d>n+1){ type[y*W+x]=M.WALL; }
      }
    }
    // ---- connections ----
    const ductLoop=(a,b)=>{ // thin duct with a vent at one end and a drain at the other: permanent current
      const dh=ri(10,16); const ya=ri(a.y0+8,a.y1-8), yb=ri(b.y0+8,b.y1-8); const left=a.x1<b.x0?a:b, right=left===a?b:a;
      const yl=left===a?ya:yb, yr=left===a?yb:ya; const mid=Math.round((left.x1+right.x0)/2)+ri(-20,20);
      rect(left.x1,yl-dh/2,mid+dh/2,yl+dh/2,M.FLUID); rect(mid-dh/2,Math.min(yl,yr)-dh/2,mid+dh/2,Math.max(yl,yr)+dh/2,M.FLUID); rect(mid-dh/2,yr-dh/2,right.x0,yr+dh/2,M.FLUID);
      const dir=R()<0.5?1:-1; const vx=dir>0?left.x1+3:right.x0-3, vy=dir>0?yl:yr, dxx=dir>0?right.x0-3:left.x1+3, dyy=dir>0?yr:yl;
      for(let k=-dh/2+1;k<dh/2;k++){ set(vx,Math.round(vy+k),M.VENT); setDir(vx,Math.round(vy+k),dir,0); set(dxx,Math.round(dyy+k),M.DRAIN); } };
    const connectH=(a,b)=>{ // a left of b
      const ch=ri(24,44); const ya=ri(a.y0+16,a.y1-16), yb=ri(b.y0+16,b.y1-16); const mid=Math.round((a.x1+b.x0)/2);
      rect(a.x1,ya-ch/2,mid+ch/2,ya+ch/2,M.FLUID); rect(mid-ch/2,Math.min(ya,yb)-ch/2,mid+ch/2,Math.max(ya,yb)+ch/2,M.FLUID); rect(mid-ch/2,yb-ch/2,b.x0,yb+ch/2,M.FLUID);
      if(R()<0.65) machines.push({kind:'fan',x:mid,y:Math.round((ya+yb)/2),r:Math.round(ch/2-2),blades:ri(2,4),omega:(R()<0.5?1:-1)*(0.025+R()*0.035),phase:R()*6.28});
      if(R()<0.4) machines.push({kind:'door',x:Math.round(a.x1+8),y:ya,w:6,h:ch+2,vertical:true,period:ri(300,700),phase:R()*6.28});
      if(R()<0.7) ductLoop(a,b); };
    const connectV=(a,b)=>{ // a above b (any x relation)
      const ch=ri(24,40); const xa=ri(a.x0+16,a.x1-16), xb=ri(b.x0+16,b.x1-16); const mid=Math.round((a.y1+b.y0)/2);
      rect(xa-ch/2,a.y1,xa+ch/2,mid+ch/2,M.FLUID); rect(Math.min(xa,xb)-ch/2,mid-ch/2,Math.max(xa,xb)+ch/2,mid+ch/2,M.FLUID); rect(xb-ch/2,mid-ch/2,xb+ch/2,b.y0,M.FLUID);
      machines.push({kind:'fan',x:xa,y:Math.round((a.y1+mid)/2),r:Math.round(ch/2-2),blades:ri(2,4),omega:(R()<0.5?1:-1)*(0.025+R()*0.035),phase:R()*6.28}); };
    for(let i=0;i<rooms.length-1;i++){ const a=rooms[i], b=rooms[i+1]; if(a.tier===b.tier){ connectH(a.x0<b.x0?a:b, a.x0<b.x0?b:a); } else { connectV(a.y0<b.y0?a:b, a.y0<b.y0?b:a); } }
    // cross-tier shortcut ducts (loops): vertically adjacent slots
    for(const a of rooms) for(const b of rooms){ if(b.tier===a.tier+1 && b.col===a.col && R()<0.5){ const dh=ri(8,14); const x=ri(Math.max(a.x0,b.x0)+6,Math.min(a.x1,b.x1)-6); if(x>Math.max(a.x0,b.x0)+6){ rect(x-dh/2,a.y1,x+dh/2,b.y0,M.FLUID); const dir=R()<0.5?1:-1; for(let k=-dh/2+1;k<dh/2;k++){ set(Math.round(x+k),dir>0?a.y1+3:b.y0-3,M.VENT); setDir(Math.round(x+k),dir>0?a.y1+3:b.y0-3,0,dir); set(Math.round(x+k),dir>0?b.y0-3:a.y1+3,M.DRAIN); } } } }
    // ---- room furniture ----
    for(const r of rooms){
      const w=r.x1-r.x0, h=r.y1-r.y0;
      const nG=Math.round(w*h/7000);
      for(let k=0;k<nG;k++){ const gx=ri(r.x0+10,r.x1-50), gy=ri(r.y0+15,r.y1-15), gl=ri(30,Math.min(130,r.x1-gx-5)); rect(gx,gy,gx+gl,gy+2,M.WALL); if(R()<0.35) rect(gx+gl/2-1,gy,gx+gl/2+1,Math.min(r.y1,gy+ri(12,30)),M.WALL); if(R()<0.2) rect(gx+gl/2-1,Math.max(r.y0,gy-ri(12,30)),gx+gl/2+1,gy,M.WALL); }
      if(R()<0.5){ const px=ri(r.x0+30,r.x1-30); rect(px-4,r.y0,px+4,r.y1,M.WALL); rect(px-4,r.cy-22,px+4,r.cy+22,M.FLUID); rect(px-4,r.y1-34,px+4,r.y1-6,M.FLUID); if(R()<0.6) rect(px-4,r.y0+6,px+4,r.y0+30,M.FLUID); }
      // side chambers with a core inside
      const nSide=ri(0,2);
      for(let k=0;k<nSide;k++){ const top=R()<0.5; const cw=ri(30,70), chh=ri(20,50); const cx0=ri(r.x0+10,r.x1-10-cw); const y0=top?r.y0-10-chh:r.y1+10, y1=y0+chh; if(y0<4||y1>H-4) continue; rect(cx0,y0,cx0+cw,y1,M.FLUID); const dx=cx0+ri(6,cw-6); rect(dx-4,top?y1:r.y1,dx+4,top?r.y0:y0,M.FLUID); cores.push({x:cx0+cw/2,y:(y0+y1)/2}); if(R()<0.5){ rect(cx0,top?y0-2:y1,cx0+cw,top?y0:y1+2,R()<0.5?M.FUEL:M.SPORE); } }
      // cross vents + opposite drains
      if(R()<0.8){ const side=R()<0.5?-1:1; const vy=ri(r.y0+10,r.y1-10); const len=ri(10,26); for(let k=0;k<len;k++){ const yy=vy+k; if(yy>r.y1-2) break; const xx=side<0?r.x0:r.x1; set(xx,yy,M.VENT); setDir(xx,yy,-side,0); const ox=side<0?r.x1:r.x0; set(ox,Math.min(r.y1,Math.max(r.y0,yy+ri(-12,12))),M.DRAIN); } }
      if(R()<0.55){ const vx=ri(r.x0+20,r.x1-30), len=ri(8,18); for(let k=0;k<len;k++){ set(vx+k,r.y1,M.VENT); setDir(vx+k,r.y1,0,-1); set(Math.min(r.x1,vx+k+ri(-8,8)),r.y0,M.DRAIN); } }
      // sources
      const role=R();
      if(role<0.4){ const bx=ri(r.x0+10,r.x1-45), bl=ri(12,34); rect(bx,r.y1,bx+bl,r.y1+3,M.BURNER); rect(bx-12,r.y0-3,bx+bl+12,r.y0,M.FUEL); }
      else if(role<0.6){ const fx=ri(r.x0+10,r.x1-50); rect(fx,r.y0-3,fx+ri(25,60),r.y0,M.FUEL); if(R()<0.6){ const c2=ri(r.x0+10,r.x1-30); rect(c2,r.y1,c2+ri(12,28),r.y1+3,M.COOLER); } }
      else if(role<0.78){ const sx=ri(r.x0+10,r.x1-30); rect(r.x0-3,r.cy,r.x0,r.cy+ri(12,40),M.SPORE); rect(sx,r.y1,sx+ri(10,24),r.y1+3,M.SPORE); if(R()<0.5) rect(sx+30,r.y0-3,sx+50,r.y0,M.FUEL); }
      else { const c2=ri(r.x0+10,r.x1-40); rect(c2,r.y0-3,c2+ri(15,40),r.y0,M.COOLER); const bx=ri(r.x0+10,r.x1-40); rect(bx,r.y1,bx+ri(8,18),r.y1+3,M.BURNER); }
      // machines inside
      if(r.big){ machines.push({kind:'fan',x:Math.round(r.cx),y:Math.round(r.cy),r:ri(20,34),blades:ri(3,5),omega:(R()<0.5?1:-1)*(0.012+R()*0.02),phase:R()*6.28});
        for(let k=0;k<ri(1,3);k++) machines.push({kind:'piston',x:ri(r.x0+20,r.x1-20),y:R()<0.5?r.y0:r.y1,w:ri(10,22),len:ri(30,90),speed:0.01+R()*0.02,phase:R()*6.28}); }
      else { if(R()<0.4) machines.push({kind:'piston',x:ri(r.x0+20,r.x1-20),y:R()<0.5?r.y0:r.y1,w:ri(8,16),len:ri(25,60),speed:0.015+R()*0.02,phase:R()*6.28}); if(R()<0.3) machines.push({kind:'fan',x:ri(r.x0+30,r.x1-30),y:ri(r.y0+30,r.y1-30),r:ri(10,18),blades:ri(2,4),omega:(R()<0.5?1:-1)*(0.02+R()*0.03),phase:R()*6.28}); }
      const nC=ri(1,3); for(let k=0;k<nC;k++) cores.push({x:ri(r.x0+10,r.x1-10),y:ri(r.y0+10,r.y1-10)});
      if(r.i>0){ const nD=ri(0,1+(r.big?1:0)); for(let k=0;k<nD;k++) drones.push({x:ri(r.x0+10,r.x1-10),y:ri(r.y0+10,r.y1-10)}); }
      if(r.i>0){ const cx3=(r.tier%2===0)?r.x0+8:r.x1-8; checkpoints.push({x:cx3,y:Math.round(r.cy)}); disc(cx3,Math.round(r.cy),4,M.CHECK); }
    }
    const last=rooms[rooms.length-1]; const exit={x:(last.tier%2===0)?last.x1-10:last.x0+10,y:Math.round(last.cy)}; disc(exit.x,exit.y,10,M.EXIT);
    const spawn={x:rooms[0].x0+30,y:Math.round(rooms[0].cy)};
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ const i=y*W+x; if(type[i]===M.FLUID && type[i-1]===M.WALL&&type[i+1]===M.WALL&&type[i-W]===M.WALL&&type[i+W]===M.WALL) type[i]=M.WALL; }
    // bake source influence: which source blocks lie within ~3 cells of each fluid cell
    const src=new Uint8Array(W*H*4);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const t=type[y*W+x]; if(t<5||t>8) continue; const ch=t-5;
      for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++){ if(dx*dx+dy*dy>10) continue; const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=W||ny>=H) continue; src[(ny*W+nx)*4+ch]=255; } }
    for(let i=0;i<W*H;i++){ mask[i*4]=type[i]; mask[i*4+1]=Math.round((dirs[i*2]*0.5+0.5)*255); mask[i*4+2]=Math.round((dirs[i*2+1]*0.5+0.5)*255); mask[i*4+3]=255; }
    return {W,H,mask,src,type,machines,cores,drones,checkpoints,rooms,spawn,exit};
  },
  // machine quads for this frame: returns Float32Array of [x,y,vx,vy,type] per vertex (6 per quad)
  machineQuads(machines,t,out,H){ H=H||1024;
    let n=0; const push=(x,y,vx,vy,tp)=>{ out[n++]=x; out[n++]=y; out[n++]=vx; out[n++]=vy; out[n++]=tp; };
    const quad=(cx,cy,ux,uy,hl,hw,vcx,vcy,om,tp)=>{ // oriented box: centre, unit axis, half length, half width; velocity = linear + omega x r
      const px=-uy, py=ux; const c=[[cx+ux*hl+px*hw,cy+uy*hl+py*hw],[cx-ux*hl+px*hw,cy-uy*hl+py*hw],[cx-ux*hl-px*hw,cy-uy*hl-py*hw],[cx+ux*hl-px*hw,cy+uy*hl-py*hw]];
      const v=c.map(([x,y])=>[vcx-om*(y-cy)*0.0+0, vcy+0]); // filled below
      const vel=(x,y)=>[vcx+(-om*(y-cy)), vcy+(om*(x-cx))];
      const idx=[0,1,2,0,2,3]; for(const k of idx){ const [x,y]=c[k]; const [vx,vy]=vel(x,y); push(x,y,vx,vy,tp); } };
    for(const m of machines){
      if(m.kind==='fan'){ const a=m.phase+t*m.omega; for(let b=0;b<m.blades;b++){ const ang=a+b*Math.PI*2/m.blades; quad(m.x,m.y,Math.cos(ang),Math.sin(ang),m.r,2.2,0,0,m.omega,M.MOVING); } quad(m.x,m.y,1,0,3,3,0,0,0,M.MOVING); }
      else if(m.kind==='piston'){ const ph=(Math.sin(m.phase+t*m.speed)*0.5+0.5); const ext=ph*m.len; const dirY = m.y<=H/2? 1 : -1; // extends into room
        const vy=Math.cos(m.phase+t*m.speed)*0.5*m.len*m.speed*dirY; const cy=m.y+dirY*ext/2; quad(m.x,cy,0,1,ext/2+1,m.w/2,0,vy,0,M.MOVING); }
      else if(m.kind==='door'){ const open=(Math.sin(m.phase+t*2*Math.PI/m.period)>0.2); if(!open){ quad(m.x,m.y,0,1,m.h/2,m.w/2,0,0,0,M.MOVING); } }
    }
    return n/5;
  },
};
if(typeof module!=='undefined') module.exports={GEN,M};
