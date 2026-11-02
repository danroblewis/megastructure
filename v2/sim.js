// v2/sim.js — WebGL2 simulation: lattice fluid + species + dye + dynamic mask + probes + render
'use strict';
const SIM={
  init(canvas,W,H,maskData,srcData){
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL2 unavailable');
    if(!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets unavailable');
    this.gl=gl; this.W=W; this.H=H; this.frame=0;
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.quad=gl.createVertexArray(); gl.bindVertexArray(this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null);
    const tex=(w,h,ifmt,fmt,type,data,lin)=>{ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); const f=lin?gl.LINEAR:gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,data||null); return t; };
    const fbo=(ts)=>{ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); ts.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0)); gl.drawBuffers(ts.map((_,i)=>gl.COLOR_ATTACHMENT0+i)); if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo'); gl.bindFramebuffer(gl.FRAMEBUFFER,null); return f; };
    const hf=(w,h)=>tex(w,h,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT);
    this.F=[{a:hf(W,H),b:hf(W,H),c:hf(W,H)},{a:hf(W,H),b:hf(W,H),c:hf(W,H)}]; this.Ffbo=this.F.map(f=>fbo([f.a,f.b,f.c]));
    this.S=[hf(W,H),hf(W,H)]; this.D=[tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE),tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE)];
    this.SDfbo=[fbo([this.S[0],this.D[0]]),fbo([this.S[1],this.D[1]])];
    this.LW=Math.ceil(W/4); this.LH=Math.ceil(H/4);
    this.L=[tex(this.LW,this.LH,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT,null,true),tex(this.LW,this.LH,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT,null,true)]; this.Lfbo=this.L.map(t=>fbo([t])); this.lcur=0;
    this.Wf=[hf(W,H),hf(W,H)]; this.Wfbo=this.Wf.map(t=>fbo([t])); this.wcur=0;
    this.B=[hf(W,H),hf(W,H)]; this.Bfbo=this.B.map(t=>fbo([t])); this.bcur=0; this.BV=hf(W,H); this.BVfbo=fbo([this.BV]);
    // reduction chain for mass / centroid
    this.levels=[]; let lw=Math.ceil(W/4), lh=Math.ceil(H/4);
    while(true){ const ts=[0,1,2,3].map(()=>tex(lw,lh,gl.RGBA32F,gl.RGBA,gl.FLOAT)); this.levels.push({ts,f:fbo(ts),w:lw,h:lh}); if(lw*lh<=16) break; lw=Math.ceil(lw/4); lh=Math.ceil(lh/4); }
    this.redBufs=[0,1,2,3].map(()=>new Float32Array(16*4));
    this.centres=new Float32Array(6); this.nC=1; this.dirs=new Float32Array(6);
    this.Src=tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,srcData);
    this.Mstatic=tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,maskData); this.Mdyn=tex(W,H,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE); this.Mfbo=fbo([this.Mdyn]);
    this.probeTex=tex(64,1,gl.RGBA32F,gl.RGBA,gl.FLOAT); this.probeFbo=fbo([this.probeTex]);
    this.probeTex2=tex(64,1,gl.RGBA32F,gl.RGBA,gl.FLOAT); this.probeFbo2=fbo([this.probeTex2]);
    this.cur=0; this.scur=0;
    const prog=(fs,vs)=>{ const p=gl.createProgram(); const mk=(t,src)=>{ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ const log=gl.getShaderInfoLog(s); const m=/ERROR: \d+:(\d+)/.exec(log); throw new Error(log+' >> '+(src.split('\n')[(m?+m[1]:1)-1]||'')); } return s; };
      gl.attachShader(p,mk(gl.VERTEX_SHADER,vs||SH.vs)); gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){ const inf=gl.getActiveUniform(p,i); u[inf.name.replace('[0]','')]=gl.getUniformLocation(p,inf.name); } return {p,u}; };
    this.P={lbm:prog(SH.lbm),species:prog(SH.species),body:prog(SH.body),bodyVel:prog(SH.bodyVel),walls:prog(SH.walls),wallsInit:prog(SH.wallsInit),light:prog(SH.light),bloomExtract:prog(SH.bloomExtract),blur:prog(SH.blur),reduce0:prog(SH.reduce0),reduceN:prog(SH.reduceN),maskCopy:prog(SH.maskCopy),mach:prog(SH.machFS,SH.machVS),probe:prog(SH.probe),probe2:prog(SH.probe2),render:prog(SH.render)};
    // machine geometry
    this.machVAO=gl.createVertexArray(); gl.bindVertexArray(this.machVAO); this.machBuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.machBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,20,8); gl.bindVertexArray(null);
    this.machData=new Float32Array(5*6*2000);
    // initial fluid state: equilibrium at rest. Draw lbm pass with zero inputs twice to normalise
    for(let i=0;i<2;i++){ gl.bindFramebuffer(gl.FRAMEBUFFER,this.Ffbo[i]); gl.viewport(0,0,W,H); gl.clearBufferfv(gl.COLOR,0,[4/9,1/9,1/9,1/9]); gl.clearBufferfv(gl.COLOR,1,[1/9,1/36,1/36,1/36]); gl.clearBufferfv(gl.COLOR,2,[1/36,1,0,0]); }
    for(let i=0;i<2;i++){ gl.bindFramebuffer(gl.FRAMEBUFFER,this.SDfbo[i]); gl.viewport(0,0,W,H); gl.clearBufferfv(gl.COLOR,0,[0,0,0,0]); gl.clearBufferfv(gl.COLOR,1,[0,0,0,0]); gl.bindFramebuffer(gl.FRAMEBUFFER,this.Bfbo[i]); gl.clearBufferfv(gl.COLOR,0,[0,0,0,0]); }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.probeBuf=new Float32Array(64*4); this.probeBuf2=new Float32Array(64*4); this.pts=new Float32Array(128);
    this.use(this.P.wallsInit,{uMask:this.Mstatic,uWf:this.Wf[1]}); this.draw(this.Wfbo[0],W,H); this.use(this.P.wallsInit,{uMask:this.Mstatic,uWf:this.Wf[0]}); this.draw(this.Wfbo[1],W,H);
    for(let i=0;i<2;i++){ const pr=this.P.light; this.use(pr,{uMask:this.Mstatic,uL:this.L[1-i],uB:this.B[0],uS:this.S[0]}); gl.uniform2i(pr.u.uLRes,this.LW,this.LH); gl.uniform1i(pr.u.uInit,1); this.draw(this.Lfbo[i],this.LW,this.LH); }
    this.pbos=[0,1,2,3,4,5].map(()=>gl.createBuffer()); this.fence=null; this.pending=false;
    const L=this.levels[this.levels.length-1];
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[0]); gl.bufferData(gl.PIXEL_PACK_BUFFER,64*16,gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[1]); gl.bufferData(gl.PIXEL_PACK_BUFFER,64*16,gl.STREAM_READ);
    for(let i=2;i<6;i++){ gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[i]); gl.bufferData(gl.PIXEL_PACK_BUFFER,L.w*L.h*16,gl.STREAM_READ); } gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    this.red={mass:0,cx:0,cy:0,burning:0,spread:0,elong:0,angle:0,clusters:[],far:null};
  },
  use(pr,texes){ const gl=this.gl; gl.useProgram(pr.p); let u=0; if(!('uWf' in texes)&&this.Wf) texes.uWf=this.Wf[this.wcur]; for(const k in texes){ gl.activeTexture(gl.TEXTURE0+u); gl.bindTexture(gl.TEXTURE_2D,texes[k]); gl.uniform1i(pr.u[k],u); u++; }
    gl.uniform2i(pr.u.uRes,this.W,this.H); gl.uniform1f(pr.u.uTime,this.frame/60); gl.uniform1ui(pr.u.uFrame,this.frame>>>0); },
  draw(fbo,w,h){ const gl=this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.viewport(0,0,w,h); gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES,0,3); gl.bindVertexArray(null); },
  updateMask(machines,t){
    const gl=this.gl; this.use(this.P.maskCopy,{uStatic:this.Mstatic}); this.draw(this.Mfbo,this.W,this.H);
    const n=GEN.machineQuads(machines,t,this.machData,this.H); if(!n) return;
    gl.useProgram(this.P.mach.p); gl.uniform2f(this.P.mach.u.uResF,this.W,this.H);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.machBuf); gl.bufferData(gl.ARRAY_BUFFER,this.machData.subarray(0,n*5),gl.STREAM_DRAW);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.Mfbo); gl.viewport(0,0,this.W,this.H); gl.bindVertexArray(this.machVAO); gl.drawArrays(gl.TRIANGLES,0,n); gl.bindVertexArray(null);
  },
  step(P,inject,bd){
    const gl=this.gl; this.frame++;
    const f=this.F[this.cur], o=1-this.cur;
    let pr=this.P.lbm; this.use(pr,{uMask:this.Mdyn,uFA:f.a,uFB:f.b,uFC:f.c,uS:this.S[this.scur],uB:this.B[this.bcur]});
    gl.uniform1f(pr.u.uTau,P.tau); gl.uniform1f(pr.u.uBuoy,P.buoy); gl.uniform1f(pr.u.uIgn,P.ign); gl.uniform1f(pr.u.uBurnP,P.burnP);
    gl.uniform2f(pr.u.uDir,bd.dir[0],bd.dir[1]); gl.uniform1f(pr.u.uPush,bd.push); gl.uniform2fv(pr.u.uC,this.centres); gl.uniform1i(pr.u.uCN,this.nC); gl.uniform2fv(pr.u.uDirs,this.dirs); gl.uniform1f(pr.u.uRadial,bd.radial||0);
    this.draw(this.Ffbo[o],this.W,this.H); this.cur=o;
    pr=this.P.species; const so=1-this.scur;
    this.use(pr,{uMask:this.Mdyn,uS:this.S[this.scur],uFC:this.F[this.cur].c,uDye:this.D[this.scur],uB:this.B[this.bcur],uSrc:this.Src});
    gl.uniform1f(pr.u.uAdv,P.adv); gl.uniform1f(pr.u.uIgn,P.ign); gl.uniform1f(pr.u.uBurnRate,P.burnRate); gl.uniform1f(pr.u.uCool,P.cool); gl.uniform1f(pr.u.uLifeF,P.lifeF); gl.uniform1f(pr.u.uLifeK,P.lifeK); gl.uniform1f(pr.u.uDiff,P.diff);
    gl.uniform4f(pr.u.uInject,inject?inject.x:-999,inject?inject.y:-999,inject?inject.r:0,0); gl.uniform4f(pr.u.uInjectAmt,inject?inject.fuel:0,inject?inject.heat:0,inject?inject.smoke:0,inject?inject.life:0);
    this.draw(this.SDfbo[so],this.W,this.H); this.scur=so;
    // body
    pr=this.P.bodyVel; this.use(pr,{uMask:this.Mdyn,uB:this.B[this.bcur],uFC:this.F[this.cur].c,uS:this.S[this.scur]}); gl.uniform2fv(pr.u.uC,this.centres); gl.uniform1i(pr.u.uCN,this.nC); gl.uniform2fv(pr.u.uDirs,this.dirs);
    gl.uniform1f(pr.u.uGrip,bd.grip===undefined?1:bd.grip); gl.uniform1f(pr.u.uInertia,bd.inertia||0); gl.uniform2f(pr.u.uIVel,bd.ivx||0,bd.ivy||0); gl.uniform1f(pr.u.uDense,bd.dense||0.9);
    const ap=bd.app||[0,0,0]; gl.uniform3f(pr.u.uApp,ap[0],ap[1],ap[2]); const sa=bd.splitAxis||[1,0]; gl.uniform2f(pr.u.uSplitAxis,sa[0],sa[1]); gl.uniform1f(pr.u.uSplitStr,bd.splitStr||0); gl.uniform1f(pr.u.uSplitApp,bd.splitApp||0);
    gl.uniform2f(pr.u.uDir,bd.dir[0],bd.dir[1]); gl.uniform2f(pr.u.uCentroid,bd.centroid[0],bd.centroid[1]); gl.uniform1f(pr.u.uAdv,P.adv); gl.uniform1f(pr.u.uSwim,bd.swim); gl.uniform1f(pr.u.uCoh,bd.coh); gl.uniform1f(pr.u.uRnear,bd.rnear);
    this.draw(this.BVfbo,this.W,this.H);
    pr=this.P.body; const bo=1-this.bcur;
    this.use(pr,{uMask:this.Mdyn,uB:this.B[this.bcur],uBV:this.BV,uS:this.S[this.scur],uFC:this.F[this.cur].c});
    gl.uniform2f(pr.u.uCentroid,bd.centroid[0],bd.centroid[1]); gl.uniform2fv(pr.u.uC,this.centres); gl.uniform1i(pr.u.uCN,this.nC);
    gl.uniform1f(pr.u.uRnear,bd.rnear); gl.uniform1f(pr.u.uRfar,bd.rfar); gl.uniform1f(pr.u.uGrow,bd.grow); gl.uniform1f(pr.u.uDroneR,bd.droneR||5);
    const ib=bd.injectB; gl.uniform4f(pr.u.uInjectB,ib?ib[0]:-999,ib?ib[1]:-999,ib?ib[2]:0,ib?ib[3]:0);
    gl.uniform2fv(pr.u.uDrones,bd.drones); gl.uniform1i(pr.u.uNDrones,bd.nDrones|0);
    this.draw(this.Bfbo[bo],this.W,this.H); this.bcur=bo;
    pr=this.P.walls; const wo=1-this.wcur;
    this.use(pr,{uMask:this.Mdyn,uWf:this.Wf[this.wcur],uS:this.S[this.scur],uFC:this.F[this.cur].c,uB:this.B[this.bcur]});
    this.draw(this.Wfbo[wo],this.W,this.H); this.wcur=wo;
  },
  lightStep(iters){
    const gl=this.gl, pr=this.P.light;
    for(let i=0;i<iters;i++){ const lo=1-this.lcur; this.use(pr,{uMask:this.Mdyn,uL:this.L[this.lcur],uB:this.B[this.bcur],uS:this.S[this.scur]}); gl.uniform2i(pr.u.uLRes,this.LW,this.LH); gl.uniform1i(pr.u.uInit,0); this.draw(this.Lfbo[lo],this.LW,this.LH); this.lcur=lo; }
  },
  // total mass, centroid and burning amount of the body (synchronous small readback)
  reduceDraw(){
    const gl=this.gl; let pr=this.P.reduce0; this.use(pr,{uMask:this.Mdyn,uB:this.B[this.bcur],uS:this.S[this.scur]}); gl.uniform2fv(pr.u.uC,this.centres); gl.uniform1i(pr.u.uCN,this.nC); this.draw(this.levels[0].f,this.levels[0].w,this.levels[0].h);
    for(let i=1;i<this.levels.length;i++){ pr=this.P.reduceN; const L=this.levels[i-1]; this.use(pr,{uMask:this.Mdyn,uL0:L.ts[0],uL1:L.ts[1],uL2:L.ts[2],uL3:L.ts[3]}); gl.uniform2i(pr.u.uLRes,L.w,L.h); this.draw(this.levels[i].f,this.levels[i].w,this.levels[i].h); }
  },
  // sample fields at up to 64 points and reduce the body; results are read back asynchronously
  // (collect() returns last frame's values, so the GPU never stalls)
  probe(points,n){
    const gl=this.gl; for(let i=0;i<64;i++){ this.pts[i*2]=i<n?points[i*2]:0; this.pts[i*2+1]=i<n?points[i*2+1]:0; }
    let pr=this.P.probe; this.use(pr,{uMask:this.Mdyn,uFC:this.F[this.cur].c,uS:this.S[this.scur]}); gl.uniform2fv(pr.u.uPts,this.pts); this.draw(this.probeFbo,64,1);
    pr=this.P.probe2; this.use(pr,{uMask:this.Mdyn,uFC:this.F[this.cur].c,uS:this.S[this.scur],uB:this.B[this.bcur]}); gl.uniform2fv(pr.u.uPts,this.pts); this.draw(this.probeFbo2,64,1);
    this.reduceDraw();
    const L=this.levels[this.levels.length-1];
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.probeFbo); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[0]); gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.probeFbo2); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[1]); gl.readPixels(0,0,64,1,gl.RGBA,gl.FLOAT,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,L.f); for(let i=0;i<4;i++){ gl.readBuffer(gl.COLOR_ATTACHMENT0+i); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[2+i]); gl.readPixels(0,0,L.w,L.h,gl.RGBA,gl.FLOAT,0); } gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    if(this.fence) gl.deleteSync(this.fence); this.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0); this.pending=true; gl.flush();
  },
  collect(){
    const gl=this.gl; if(!this.pending) return [this.probeBuf,this.probeBuf2,this.red];
    if(this.fence){ gl.clientWaitSync(this.fence,0,0); }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[0]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,this.probeBuf);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[1]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,this.probeBuf2);
    const L=this.levels[this.levels.length-1];
    for(let i=0;i<4;i++){ gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbos[2+i]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,this.redBufs[i],0,L.w*L.h*4); } gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    const n=L.w*L.h, R=this.redBufs; let m0=0,mx0=0,my0=0,burn=0,xx=0,yy=0,xy=0,m1=0,mx1=0,my1=0,m2=0,mx2=0,my2=0,far=[0,0,0];
    for(let i=0;i<n;i++){ m0+=R[0][i*4]; mx0+=R[0][i*4+1]; my0+=R[0][i*4+2]; burn+=R[0][i*4+3]; xx+=R[1][i*4]; yy+=R[1][i*4+1]; xy+=R[1][i*4+2]; m1+=R[1][i*4+3]; mx1+=R[2][i*4]; my1+=R[2][i*4+1]; m2+=R[2][i*4+2]; mx2+=R[2][i*4+3]; my2+=R[3][i*4]; if(R[3][i*4+1]>far[0]) far=[R[3][i*4+1],R[3][i*4+2],R[3][i*4+3]]; }
    const clusters=[{mass:m0,cx:m0>0?mx0/m0:0,cy:m0>0?my0/m0:0},{mass:m1,cx:m1>0?mx1/m1:0,cy:m1>0?my1/m1:0},{mass:m2,cx:m2>0?mx2/m2:0,cy:m2>0?my2/m2:0}];
    let spread=0, elong=1, angle=0;
    if(m0>0.5){ const cx=mx0/m0, cy=my0/m0; const vx=Math.max(0,xx/m0-cx*cx), vy=Math.max(0,yy/m0-cy*cy), cv=xy/m0-cx*cy;
      spread=Math.sqrt(vx+vy); const tr=vx+vy, det=vx*vy-cv*cv; const disc=Math.sqrt(Math.max(0,tr*tr/4-det)); const l1=tr/2+disc, l2=Math.max(1e-6,tr/2-disc); elong=Math.sqrt(l1/l2); angle=0.5*Math.atan2(2*cv,vx-vy); }
    this.red={mass:m0+m1+m2,cx:clusters[0].cx,cy:clusters[0].cy,burning:burn,spread,elong,angle,clusters,far:far[0]>0?{d:far[0],x:far[1],y:far[2]}:null}; this.pending=false;
    return [this.probeBuf,this.probeBuf2,this.red];
  },
  ensureBloom(sw,sh){ const gl=this.gl, w=Math.max(1,sw>>1), h=Math.max(1,sh>>1); if(this.bloomW===w&&this.bloomH===h) return;
    const tex=(w,h)=>{ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null); return t; };
    const fbo=(t)=>{ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0); gl.bindFramebuffer(gl.FRAMEBUFFER,null); return f; };
    this.bloomW=w; this.bloomH=h; this.bloomT=[tex(w,h),tex(w,h)]; this.bloomF=this.bloomT.map(fbo); },
  render(cam,zoom,sw,sh,debug,player,ents,nEnt,hurt,hp){
    const gl=this.gl; let pr;
    // bloom: extract emissive at half resolution, blur horizontally then vertically
    this.ensureBloom(sw,sh); const bw=this.bloomW, bh=this.bloomH;
    pr=this.P.bloomExtract; this.use(pr,{uMask:this.Mdyn,uS:this.S[this.scur],uB:this.B[this.bcur]}); gl.uniform2f(pr.u.uCam,cam[0],cam[1]); gl.uniform1f(pr.u.uZoom,zoom); gl.uniform2f(pr.u.uScreen,sw,sh); this.draw(this.bloomF[0],bw,bh);
    pr=this.P.blur; gl.useProgram(pr.p); gl.uniform2f(pr.u.uTexel,1/bw,1/bh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.bloomT[0]); gl.uniform1i(pr.u.uT,0); gl.uniform2f(pr.u.uDir,1,0); this.draw(this.bloomF[1],bw,bh);
    gl.bindTexture(gl.TEXTURE_2D,this.bloomT[1]); gl.uniform2f(pr.u.uDir,0,1); this.draw(this.bloomF[0],bw,bh);
    pr=this.P.render;
    this.use(pr,{uMask:this.Mdyn,uS:this.S[this.scur],uFC:this.F[this.cur].c,uDye:this.D[this.scur],uB:this.B[this.bcur],uLight:this.L[this.lcur]});
    gl.activeTexture(gl.TEXTURE0+9); gl.bindTexture(gl.TEXTURE_2D,this.bloomT[0]); gl.uniform1i(pr.u.uBloom,9);
    gl.uniform2f(pr.u.uCam,cam[0],cam[1]); gl.uniform1f(pr.u.uZoom,zoom); gl.uniform2f(pr.u.uScreen,sw,sh); gl.uniform1i(pr.u.uDebug,debug);
    gl.uniform4f(pr.u.uPlayer,player[0],player[1],player[2],player[3]); gl.uniform2fv(pr.u.uC,this.centres); gl.uniform1i(pr.u.uCN,this.nC);
    const tt=this.tint||[0,0,0,0]; gl.uniform4f(pr.u.uTint,tt[0],tt[1],tt[2],tt[3]); gl.uniform1f(pr.u.uSplitSideR,this.splitSideR||0); gl.uniform4fv(pr.u.uEnt,ents); gl.uniform1i(pr.u.uNEnt,nEnt); gl.uniform1f(pr.u.uPHurt,hurt); gl.uniform1f(pr.u.uPHp,hp);
    this.draw(null,sw,sh);
  },
};
