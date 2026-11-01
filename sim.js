// sim.js — GPU simulation orchestration: textures, passes, window scrolling, readback, patches.
'use strict';
const SIM = {
  W:0, H:0, cells:null, meta:null, shade:null, frame:0,
  init(W,H){ this.W=W; this.H=H; this.cells=new Uint8Array(W*H); this.meta=new Uint8Array(W*H); this.shade=new Uint8Array(W*H); for(let i=0;i<W*H;i++) this.shade[i]=(Math.random()*256)|0; },
  get(x,y){ return this.view? this.viewGet(x,y) : ((x<0||y<0||x>=this.W||y>=this.H)?T.BEDROCK:this.cells[y*this.W+x]); },
  set(x,y,t,m,f){ if(x<0||y<0||x>=this.W||y>=this.H) return; if(this.view) this.viewSet(x,y,t,m||0,f||0); else { const i=y*this.W+x; this.cells[i]=t; this.meta[i]=m||0; } },

  // ---------------- GPU ----------------
  gpuInit(canvas, winW, winH){
    const gl=GPU.init(canvas); this.gl=gl;
    const W=this.W,H=this.H;
    this.winW=winW; this.winH=winH; this.win={x:0,y:0};
    this.cellTex=[GPU.tex(W,H,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE),GPU.tex(W,H,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE)];
    this.cellFBO=this.cellTex.map(t=>GPU.fbo([t]));
    const mkF=()=>({fld:GPU.tex(winW,winH,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),fa:GPU.tex(winW,winH,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT),fb:GPU.tex(winW,winH,gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT)});
    this.field=[mkF(),mkF()]; this.fieldFBO=this.field.map(f=>GPU.fbo([f.fld,f.fa,f.fb]));
    this.infoTex=GPU.tex(winW,winH,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE); this.infoFBO=GPU.fbo([this.infoTex]);
    this.propsTex=GPU.tex(256,1,gl.RGBA8UI,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,PROPS);
    this.palTex=GPU.tex(256,1,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,PAL);
    this.surfTex=GPU.tex(W,1,gl.R32F,gl.RED,gl.FLOAT,null);
    this.cur=0; this.fcur=0;
    for(const n of ['lbm','react','move','shift','info','render']) GPU.program(n,SH[n]);
    GPU.program('patch',SH.patchFS,SH.patchVS);
    // patch buffers
    this.patchVAO=gl.createVertexArray(); gl.bindVertexArray(this.patchVAO);
    this.patchPosBuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.patchPosBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    this.patchCellBuf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.patchCellBuf); gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1,4,gl.UNSIGNED_BYTE,0,0);
    gl.bindVertexArray(null);
    this.patchPos=new Float32Array(2*65536); this.patchCell=new Uint8Array(4*65536); this.patchN=0;
    // readback
    this.pbo=[gl.createBuffer(),gl.createBuffer()]; this.pboInfo=[gl.createBuffer(),gl.createBuffer()]; this.sync=[null,null]; this.rb=0;
    this.view=null;
    // initial field state
    for(let i=0;i<2;i++){ const s=this.field[1-i]; GPU.bind(GPU.progs.shift,{uFld:s.fld,uFA:s.fa,uFB:s.fb}); this.setCommon(GPU.progs.shift); gl.uniform2i(GPU.progs.shift.u.uDelta,99999,99999); GPU.draw(this.fieldFBO[i],winW,winH); }
  },
  setCommon(prog){ const gl=this.gl; gl.uniform2i(prog.u.uWorld,this.W,this.H); gl.uniform2i(prog.u.uWin,this.win.x,this.win.y); gl.uniform2i(prog.u.uWinSize,this.winW,this.winH); gl.uniform1ui(prog.u.uFrame,this.frame>>>0); },
  upload(surface){
    const gl=this.gl, W=this.W,H=this.H; const buf=new Uint8Array(W*H*4);
    for(let i=0;i<W*H;i++){ buf[i*4]=this.cells[i]; buf[i*4+1]=this.meta[i]; buf[i*4+2]=this.shade[i]; buf[i*4+3]=0; }
    for(const tx of this.cellTex){ gl.bindTexture(gl.TEXTURE_2D,tx.t); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,H,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,buf); }
    const s=new Float32Array(W); for(let x=0;x<W;x++) s[x]=surface[x];
    gl.bindTexture(gl.TEXTURE_2D,this.surfTex.t); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,1,gl.RED,gl.FLOAT,s);
    this.surface=surface;
  },
  // move the field window so that it contains rect (x0,y0,w,h) with margins
  setWindow(x,y){
    x=Math.max(0,Math.min(this.W-this.winW,x))|0; y=Math.max(0,Math.min(this.H-this.winH,y))|0;
    if(x===this.win.x&&y===this.win.y) return;
    const gl=this.gl, dx=x-this.win.x, dy=y-this.win.y; const f=this.field[this.fcur], o=1-this.fcur;
    GPU.bind(GPU.progs.shift,{uFld:f.fld,uFA:f.fa,uFB:f.fb}); this.setCommon(GPU.progs.shift); gl.uniform2i(GPU.progs.shift.u.uDelta,dx,dy);
    GPU.draw(this.fieldFBO[o],this.winW,this.winH); this.fcur=o; this.win.x=x; this.win.y=y;
  },
  ensureWindow(vx0,vy0,vw,vh){ // keep view well inside the window
    const m=48; const wx=this.win.x, wy=this.win.y;
    if(vx0<wx+m||vy0<wy+m||vx0+vw>wx+this.winW-m||vy0+vh>wy+this.winH-m){ this.setWindow(vx0+vw/2-this.winW/2, vy0+vh/2-this.winH/2); }
  },
  // ---------------- patches (CPU writes) ----------------
  viewGet(x,y){ const v=this.view; if(x<v.x0||y<v.y0||x>=v.x0+v.w||y>=v.y0+v.h) return T.BEDROCK; return v.cells[((y-v.y0)*v.w+(x-v.x0))*4]; },
  viewMeta(x,y){ const v=this.view; if(x<v.x0||y<v.y0||x>=v.x0+v.w||y>=v.y0+v.h) return 0; return v.cells[((y-v.y0)*v.w+(x-v.x0))*4+1]; },
  temp(x,y){ const v=this.view; if(!v||x<v.x0||y<v.y0||x>=v.x0+v.w||y>=v.y0+v.h) return 20; return v.info[((y-v.y0)*v.w+(x-v.x0))*4+2]/255*1600-100; },
  vel(x,y,out){ const v=this.view; out=out||[0,0]; if(!v||x<v.x0||y<v.y0||x>=v.x0+v.w||y>=v.y0+v.h){ out[0]=0; out[1]=0; return out; } const i=((y-v.y0)*v.w+(x-v.x0))*4; out[0]=(v.info[i]/255-0.5)/1.6; out[1]=(v.info[i+1]/255-0.5)/1.6; return out; },
  viewSet(x,y,t,m,f){
    const v=this.view; if(x>=v.x0&&y>=v.y0&&x<v.x0+v.w&&y<v.y0+v.h){ const i=((y-v.y0)*v.w+(x-v.x0))*4; v.cells[i]=t; v.cells[i+1]=m; v.cells[i+3]=f; }
    const n=this.patchN; if(n>=65536) return; this.patchPos[n*2]=x; this.patchPos[n*2+1]=y; this.patchCell[n*4]=t; this.patchCell[n*4+1]=m; this.patchCell[n*4+2]=(Math.random()*256)|0; this.patchCell[n*4+3]=f; this.patchN=n+1;
  },
  flushPatches(){
    if(!this.patchN) return; const gl=this.gl, n=this.patchN;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.patchPosBuf); gl.bufferData(gl.ARRAY_BUFFER,this.patchPos.subarray(0,n*2),gl.STREAM_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.patchCellBuf); gl.bufferData(gl.ARRAY_BUFFER,this.patchCell.subarray(0,n*4),gl.STREAM_DRAW);
    const pr=GPU.progs.patch; gl.useProgram(pr.p); gl.uniform2f(pr.u.uWorldF,this.W,this.H);
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.cellFBO[this.cur]); gl.viewport(0,0,this.W,this.H); gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(this.patchVAO); gl.drawArrays(gl.POINTS,0,n); gl.bindVertexArray(null);
    this.patchN=0;
  },
  // ---------------- one simulation frame ----------------
  step(params){
    const gl=this.gl; this.frame++;
    this.flushPatches();
    const f=this.field[this.fcur], fo=1-this.fcur;
    // 1. lattice fluid + heat
    let pr=GPU.progs.lbm; GPU.bind(pr,{uCell:this.cellTex[this.cur],uProps:this.propsTex,uFld:f.fld,uFA:f.fa,uFB:f.fb,uSurf:this.surfTex}); this.setCommon(pr);
    gl.uniform1f(pr.u.uTau,params.tau); gl.uniform1f(pr.u.uBuoy,params.buoy); gl.uniform1f(pr.u.uGliq,params.gliq);
    GPU.draw(this.fieldFBO[fo],this.winW,this.winH); this.fcur=fo;
    const fld=this.field[this.fcur].fld;
    // 2. reactions
    pr=GPU.progs.react; GPU.bind(pr,{uCell:this.cellTex[this.cur],uProps:this.propsTex,uFld:fld,uSurf:this.surfTex}); this.setCommon(pr);
    GPU.draw(this.cellFBO[1-this.cur],this.W,this.H,this.win.x,this.win.y,this.winW,this.winH); this.cur=1-this.cur;
    // 3. movement substeps (Margolus phases)
    pr=GPU.progs.move;
    for(let s=0;s<params.substeps;s++){
      const ph=(this.frame*params.substeps+s)&3;
      GPU.bind(pr,{uCell:this.cellTex[this.cur],uProps:this.propsTex,uFld:fld}); this.setCommon(pr);
      gl.uniform2i(pr.u.uPhase,ph&1,(ph>>1)&1);
      GPU.draw(this.cellFBO[1-this.cur],this.W,this.H,this.win.x,this.win.y,this.winW,this.winH); this.cur=1-this.cur;
    }
    // 4. pack info
    pr=GPU.progs.info; GPU.bind(pr,{uCell:this.cellTex[this.cur],uProps:this.propsTex,uFld:fld}); this.setCommon(pr);
    GPU.draw(this.infoFBO,this.winW,this.winH);
  },
  // ---------------- readback of a region (async via PBO, consumed next frame) ----------------
  requestRead(x0,y0,w,h){
    const gl=this.gl; x0=Math.max(0,x0|0); y0=Math.max(0,y0|0); w=Math.min(w|0,this.W-x0); h=Math.min(h|0,this.H-y0);
    const k=this.rb; const bytes=w*h*4;
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.cellFBO[this.cur]); gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbo[k]); gl.bufferData(gl.PIXEL_PACK_BUFFER,bytes,gl.STREAM_READ);
    gl.readPixels(x0,y0,w,h,gl.RGBA_INTEGER,gl.UNSIGNED_BYTE,0);
    // info: window-relative sub-rectangle (clamped)
    const ix0=Math.max(x0,this.win.x), iy0=Math.max(y0,this.win.y), ix1=Math.min(x0+w,this.win.x+this.winW), iy1=Math.min(y0+h,this.win.y+this.winH);
    const iw=Math.max(0,ix1-ix0), ih=Math.max(0,iy1-iy0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pboInfo[k]); gl.bufferData(gl.PIXEL_PACK_BUFFER,Math.max(4,iw*ih*4),gl.STREAM_READ);
    if(iw>0&&ih>0){ gl.bindFramebuffer(gl.FRAMEBUFFER,this.infoFBO); gl.readBuffer(gl.COLOR_ATTACHMENT0); gl.readPixels(ix0-this.win.x,iy0-this.win.y,iw,ih,gl.RGBA,gl.UNSIGNED_BYTE,0); }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    this.pending={k,x0,y0,w,h,ix0,iy0,iw,ih}; this.sync[k]=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0); this.rb=1-k;
  },
  collectRead(){
    const p=this.pending; if(!p) return false; const gl=this.gl;
    if(this.sync[p.k]){ gl.clientWaitSync(this.sync[p.k],gl.SYNC_FLUSH_COMMANDS_BIT,0); gl.deleteSync(this.sync[p.k]); this.sync[p.k]=null; }
    const cells=new Uint8Array(p.w*p.h*4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pbo[p.k]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,cells);
    const info=new Uint8Array(p.w*p.h*4); info.fill(0); // default: no wind, temp 20
    for(let i=2;i<info.length;i+=4) info[i]=Math.round((20+100)/1600*255);
    if(p.iw>0&&p.ih>0){ const tmp=new Uint8Array(p.iw*p.ih*4); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,this.pboInfo[p.k]); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,tmp);
      for(let y=0;y<p.ih;y++){ const src=y*p.iw*4, dst=((p.iy0-p.y0+y)*p.w+(p.ix0-p.x0))*4; info.set(tmp.subarray(src,src+p.iw*4),dst); } }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    this.view={x0:p.x0,y0:p.y0,w:p.w,h:p.h,cells,info}; this.pending=null; return true;
  },
  // ---------------- render ----------------
  render(camX,camY,cellPx,screenW,screenH,time,debug,pflags){
    const gl=this.gl, pr=GPU.progs.render;
    GPU.bind(pr,{uCell:this.cellTex[this.cur],uProps:this.propsTex,uFld:this.field[this.fcur].fld,uSurf:this.surfTex,uPal:this.palTex}); this.setCommon(pr);
    gl.uniform2f(pr.u.uCam,camX,camY); gl.uniform1f(pr.u.uCellPx,cellPx); gl.uniform2f(pr.u.uScreen,screenW,screenH); gl.uniform1f(pr.u.uTime,time); gl.uniform1i(pr.u.uDebug,debug|0); gl.uniform1f(pr.u.uPFlags,pflags||0);
    GPU.draw(null,screenW,screenH);
  },
};
