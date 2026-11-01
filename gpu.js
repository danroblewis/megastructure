// gpu.js — tiny WebGL2 helper layer
'use strict';
const GPU = {
  gl:null, quad:null, progs:{},
  init(canvas){
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL2 not available');
    if(!gl.getExtension('EXT_color_buffer_float')) throw new Error('float render targets not available');
    this.gl=gl;
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bindBuffer(gl.ARRAY_BUFFER,vb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null);
    this.quad=vao;
    this.VS=`#version 300 es\nlayout(location=0) in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
    return gl;
  },
  compile(type,src){
    const gl=this.gl, s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ const log=gl.getShaderInfoLog(s); const lines=src.split('\n'); const m=/ERROR: \d+:(\d+)/.exec(log); const ln=m?+m[1]:0; throw new Error('shader compile: '+log+'\n>> '+(lines[ln-1]||'')); }
    return s;
  },
  program(name,fs,vs){
    const gl=this.gl, p=gl.createProgram();
    gl.attachShader(p,this.compile(gl.VERTEX_SHADER,vs||this.VS)); gl.attachShader(p,this.compile(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('link '+name+': '+gl.getProgramInfoLog(p));
    const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){ const info=gl.getActiveUniform(p,i); u[info.name.replace('[0]','')]=gl.getUniformLocation(p,info.name); }
    this.progs[name]={p,u}; return this.progs[name];
  },
  tex(w,h,ifmt,fmt,type,data,filter){
    const gl=this.gl, t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter||gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter||gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,data||null);
    return {t,w,h,ifmt,fmt,type};
  },
  fbo(texes){
    const gl=this.gl, f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    const bufs=[]; texes.forEach((tx,i)=>{ gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,tx.t,0); bufs.push(gl.COLOR_ATTACHMENT0+i); });
    gl.drawBuffers(bufs);
    const st=gl.checkFramebufferStatus(gl.FRAMEBUFFER); if(st!==gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete '+st);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); return f;
  },
  bind(prog,texes){ // texes: {name: texObj}
    const gl=this.gl; gl.useProgram(prog.p); let unit=0;
    for(const k in texes){ gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,texes[k].t); gl.uniform1i(prog.u[k],unit); unit++; }
  },
  draw(fbo,w,h,x,y,sw,sh){ const gl=this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.viewport(0,0,w,h);
    if(sw!==undefined){ gl.enable(gl.SCISSOR_TEST); gl.scissor(x,y,sw,sh); } else gl.disable(gl.SCISSOR_TEST);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLES,0,3); gl.bindVertexArray(null); },
};
