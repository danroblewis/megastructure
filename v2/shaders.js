// v2/shaders.js — GPU passes for the gas/fluid megastructure simulation
'use strict';
const SH = {};
SH.vs = `#version 300 es
layout(location=0) in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
SH.head = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D; precision highp usampler2D;
uniform ivec2 uRes; uniform float uTime; uniform uint uFrame;
// mask types (r channel * 255)
#define M_FLUID 0
#define M_WALL 1
#define M_VENT 2
#define M_DRAIN 3
#define M_MOVING 4
#define M_BURNER 5
#define M_COOLER 6
#define M_FUEL 7
#define M_SPORE 8
#define M_EXIT 9
#define M_CHECK 10
#define M_GRATE 11
uniform sampler2D uMask;   // r type/255, g,b = velocity or direction encoded (v*0.5+0.5), a unused
ivec2 wrapP(ivec2 p){ return clamp(p,ivec2(0),uRes-1); }
vec4 maskAt(ivec2 p){ if(p.x<0||p.y<0||p.x>=uRes.x||p.y>=uRes.y) return vec4(1.0/255.0,0.5,0.5,0.0); return texelFetch(uMask,p,0); }
int mtype(vec4 m){ return int(m.r*255.0+0.5); }
uniform sampler2D uWf;     // walls field: solidity, soot, residue, kind (0 metal, 0.5 frost, 1 tissue)
bool hardT(int t){ return t==M_MOVING||t==M_BURNER||t==M_COOLER||t==M_FUEL||t==M_SPORE; }
bool solidT(int t){ return t==M_WALL||hardT(t); }   // legacy: static-mask solidity
float solidity(ivec2 p){ if(p.x<0||p.y<0||p.x>=uRes.x||p.y>=uRes.y) return 1.0; return texelFetch(uWf,p,0).x; }
bool solidAt(ivec2 p){ if(p.x<0||p.y<0||p.x>=uRes.x||p.y>=uRes.y) return true; int t=mtype(maskAt(p)); if(hardT(t)) return true; if(t==M_VENT||t==M_DRAIN) return false; return texelFetch(uWf,p,0).x>=0.5; }
uint hashu(uvec3 v){ uint h=v.x*1664525u+v.y*1013904223u+v.z*69069u; h^=h>>13; h*=0x5bd1e995u; h^=h>>15; h*=0x27d4eb2du; h^=h>>13; return h; }
float rnd(ivec2 p,uint s){ return float(hashu(uvec3(uint(p.x+9999),uint(p.y+9999),uFrame*11u+s))&0xffffffu)/16777216.0; }
`;

// ---------------- lattice Boltzmann ----------------
SH.lbm = SH.head + `
uniform sampler2D uFA, uFB, uFC;   // f0..f3 | f4..f7 | f8, rho, ux, uy
uniform sampler2D uS;              // fuel heat smoke life
uniform sampler2D uB;              // body: self density
uniform vec2 uDir; uniform float uPush; uniform vec2 uC[3]; uniform int uCN; uniform vec2 uDirs[3]; uniform float uRadial;
uniform float uTau, uBuoy, uIgn, uBurnP;
layout(location=0) out vec4 oA; layout(location=1) out vec4 oB; layout(location=2) out vec4 oC;
const ivec2 E[9]=ivec2[9](ivec2(0,0),ivec2(1,0),ivec2(0,-1),ivec2(-1,0),ivec2(0,1),ivec2(1,-1),ivec2(-1,-1),ivec2(-1,1),ivec2(1,1));
const float W[9]=float[9](4.0/9.0,1.0/9.0,1.0/9.0,1.0/9.0,1.0/9.0,1.0/36.0,1.0/36.0,1.0/36.0,1.0/36.0);
const int OPP[9]=int[9](0,3,4,1,2,7,8,5,6);
float fget(ivec2 p,int i){ if(i<4) return texelFetch(uFA,p,0)[i]; if(i<8) return texelFetch(uFB,p,0)[i-4]; return texelFetch(uFC,p,0).x; }
float feq(int i,float rho,vec2 u){ float eu=float(E[i].x)*u.x+float(E[i].y)*u.y; return W[i]*rho*(1.0+3.0*eu+4.5*eu*eu-1.5*dot(u,u)); }
void outEq(float rho,vec2 u){ oA=vec4(feq(0,rho,u),feq(1,rho,u),feq(2,rho,u),feq(3,rho,u)); oB=vec4(feq(4,rho,u),feq(5,rho,u),feq(6,rho,u),feq(7,rho,u)); oC=vec4(feq(8,rho,u),rho,u); }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 m=maskAt(p); int t=mtype(m);
  vec4 s=texelFetch(uS,p,0);
  if(solidAt(p)){ outEq(1.0,vec2(0.0)); oC.zw=vec2(0.0); return; }
  if(t==M_VENT){ vec2 d=(m.gb-0.5)*2.0; outEq(1.0+0.12*length(d),d*0.18); return; }
  if(t==M_DRAIN){ outEq(0.90,vec2(0.0)); return; }
  float f[9];
  for(int i=0;i<9;i++){
    ivec2 q=p-E[i];
    if(i==0){ f[0]=fget(p,0); continue; }
    if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y){ f[i]=fget(p,OPP[i]); continue; }
    vec4 mq=maskAt(q); int tq=mtype(mq);
    if(solidAt(q)){
      vec2 uw=(tq==M_MOVING)?(mq.gb-0.5)*2.0*0.3:vec2(0.0);
      float rho0=texelFetch(uFC,p,0).y;
      f[i]=fget(p,OPP[i]) + 6.0*W[i]*rho0*(float(E[i].x)*uw.x+float(E[i].y)*uw.y);
    } else f[i]=fget(q,i);
  }
  float rho=0.0; vec2 mom=vec2(0.0);
  for(int i=0;i<9;i++){ rho+=f[i]; mom+=f[i]*vec2(E[i]); }
  rho=clamp(rho,0.3,3.0);
  vec2 u=mom/rho;
  // combustion adds pressure; heat is buoyant (up = -y); smoke slightly heavy
  float burn=s.x*smoothstep(uIgn,uIgn+0.25,s.y);
  rho+=burn*uBurnP;
  float self=texelFetch(uB,p,0).x;
  vec2 pushDir=uDir; if(self>0.0 && uCN>1){ vec2 pp=vec2(p)+0.5; int k=0; float bd=distance(pp,uC[0]); for(int j=1;j<3;j++){ if(j<uCN){ float dj=distance(pp,uC[j]); if(dj<bd){ bd=dj; k=j; } } } pushDir=uDirs[k]; }
  vec2 F=vec2(0.0,-uBuoy*s.y+0.00015*s.z)+pushDir*uPush*self;
  if(uRadial!=0.0){ vec2 rv=vec2(p)+0.5-uC[0]; float rl=length(rv); if(rl>0.5 && rl<40.0) F+=rv/rl*uRadial*(1.0-rl/40.0); }
  vec2 ueq=u+uTau*F/rho;
  ueq*=max(0.0,1.0-solidity(p)*1.8);   // porous cells drag the gas
  float sp=length(ueq); if(sp>0.3) ueq*=0.3/sp;
  float g[9];
  for(int i=0;i<9;i++) g[i]=f[i]-(f[i]-feq(i,rho,ueq))/uTau;
  oA=vec4(g[0],g[1],g[2],g[3]); oB=vec4(g[4],g[5],g[6],g[7]); oC=vec4(g[8],rho,ueq);
}`;

// ---------------- species: advect, diffuse, react ----------------
SH.species = SH.head + `
uniform sampler2D uS, uFC, uDye, uB, uSrc;   // uSrc: baked source influence (burner, cooler, fuel, spore)
uniform float uAdv, uIgn, uBurnRate, uCool, uLifeF, uLifeK, uDiff;
uniform vec4 uInject; uniform vec4 uInjectAmt; // player injection: xy pos, z radius ; amounts fuel heat smoke life
layout(location=0) out vec4 oS; layout(location=1) out vec4 oDye;
vec4 sampleS(vec2 pos){ // bilinear with wall clamping
  vec2 f=fract(pos-0.5); ivec2 i0=ivec2(floor(pos-0.5));
  vec4 acc=vec4(0.0); float wsum=0.0;
  for(int dy=0;dy<2;dy++) for(int dx=0;dx<2;dx++){ ivec2 q=i0+ivec2(dx,dy); float w=(dx==0?1.0-f.x:f.x)*(dy==0?1.0-f.y:f.y);
    if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y) continue; if(solidAt(q)) continue; acc+=w*texelFetch(uS,q,0); wsum+=w; }
  return wsum>0.0? acc/wsum : texelFetch(uS,ivec2(pos),0);
}
vec4 sampleD(vec2 pos){ vec2 f=fract(pos-0.5); ivec2 i0=ivec2(floor(pos-0.5)); vec4 acc=vec4(0.0); float wsum=0.0;
  for(int dy=0;dy<2;dy++) for(int dx=0;dx<2;dx++){ ivec2 q=i0+ivec2(dx,dy); float w=(dx==0?1.0-f.x:f.x)*(dy==0?1.0-f.y:f.y);
    if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y) continue; if(solidAt(q)) continue; acc+=w*texelFetch(uDye,q,0); wsum+=w; }
  return wsum>0.0? acc/wsum : texelFetch(uDye,ivec2(pos),0); }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec4 m=maskAt(p); int t=mtype(m);
  vec4 me=texelFetch(uS,p,0);
  if(solidAt(p)){
    // sources live in the wall: they push into neighbouring fluid via the neighbour rule below; keep own value as a marker
    oS=vec4(0.0); oDye=vec4(0.0);
    if(t==M_BURNER) oS.y=1.5; if(t==M_COOLER) oS.y=-1.0; if(t==M_FUEL) oS.x=1.0; if(t==M_SPORE) oS.w=1.0;
    return;
  }
  vec2 u=texelFetch(uFC,p,0).zw;
  vec2 back=vec2(p)+0.5-u*uAdv;
  vec4 s=sampleS(back);
  { // the organism creeps up the gradient of self, hunting you through the gas
    float sl=texelFetch(uB,wrapP(p-ivec2(2,0)),0).x, sr=texelFetch(uB,wrapP(p+ivec2(2,0)),0).x, su=texelFetch(uB,wrapP(p-ivec2(0,2)),0).x, sd=texelFetch(uB,wrapP(p+ivec2(0,2)),0).x;
    vec2 gs=vec2(sr-sl,sd-su); float gl=length(gs); if(gl>0.002){ vec2 drift=gs/gl*min(0.25,gl*6.0); float Lw=sampleS(back-drift).w; s.w=max(s.w,Lw); } }
  vec4 d=sampleD(back);
  // diffusion
  vec4 nb=vec4(0.0); float n=0.0;
  for(int k=0;k<4;k++){ ivec2 q=p+ivec2(k==0?1:k==1?-1:0, k==2?1:k==3?-1:0); if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y) continue; if(solidAt(q)) continue; nb+=texelFetch(uS,q,0); n+=1.0; }
  if(n>0.0) s+=uDiff*(nb/n-s);
  // sources (baked once from the static mask): burner, cooler, fuel, spore influence
  vec4 src=texelFetch(uSrc,p,0);
  if(src.r>0.0){ s.y=max(s.y,1.0); }
  if(src.g>0.0){ s.y=min(s.y,-0.6); }
  if(src.b>0.0){ s.x=min(1.0,s.x+0.12); }
  if(src.a>0.0){ s.w=max(s.w,0.5); s.x=min(1.0,s.x+0.05); }
  // combustion
  float burn=s.x*smoothstep(uIgn,uIgn+0.25,s.y)*uBurnRate;
  s.x-=burn; s.y+=burn*2.2; s.z+=burn*1.5;
  // organism: eats fuel (Gray-Scott style), dies in heat
  float L=s.w, Fu=s.x;
  float growth=L*L*Fu;
  s.w+=growth*uLifeF - L*uLifeK*0.5;
  s.x-=growth*uLifeF*0.9;
  if(s.y>0.35) s.w-=(s.y-0.35)*0.6;
  // the body burns into smoke, and feeds the organism a little
  float selfHere=texelFetch(uB,p,0).x; s.z+=selfHere*max(s.y-0.35,0.0)*0.6;
  s.w+=selfHere*max(s.w-0.08,0.0)*0.5;                      // the organism grows from the self it feeds on
  // cooling, smoke settling
  s.y-=uCool*(s.y>0.0?s.y:s.y*0.5);
  s.z*=0.996;
  // player injection
  vec2 dv=vec2(p)+0.5-uInject.xy; float dd=dot(dv,dv); if(dd<uInject.z*uInject.z){ float k=1.0-dd/(uInject.z*uInject.z); s+=uInjectAmt*k; }
  s=clamp(s,vec4(0.0,-1.0,0.0,0.0),vec4(1.0,3.0,2.0,1.0));
  oS=s;
  // dye: an advected noise pattern, relaxed slowly toward a fixed field so the flow draws streaklines through it
  vec3 pat=vec3(float(hashu(uvec3(uint(p.x),uint(p.y),101u))&255u),float(hashu(uvec3(uint(p.x/2),uint(p.y/2),77u))&255u),float(hashu(uvec3(uint(p.x/3),uint(p.y/3),55u))&255u))/255.0;
  d.rgb=mix(d.rgb,pat,0.012);
  // vents breathe dye so every current is visible
  if(t==M_VENT) d.rgb=max(d.rgb,vec3(0.2,0.55,0.8));
  d.rgb=max(d.rgb,vec3(0.5,0.7,1.0)*min(1.0,selfHere*0.8));   // the body writes its path into the flow
  oDye=clamp(d,0.0,1.0);
}`;

// ---------------- body: the player as a cohesive cloud of matter ----------------
// pass 1: velocity of the body matter in each cell (gas drag + swimming + cohesion + homing)
SH.bodyVel = SH.head + `
uniform sampler2D uB, uFC, uS;
uniform vec2 uDir, uCentroid; uniform float uAdv, uSwim, uCoh, uRnear;
uniform vec2 uC[3]; uniform int uCN; uniform vec2 uDirs[3];
uniform float uGrip, uInertia; uniform vec2 uIVel;   // how much the gas grips the self; the self's own coasting velocity
uniform float uDense;                                 // preferred density of the self
uniform vec3 uApp;                                    // appetites: drift up (+) or down (-) the gradients of heat, fuel, cold
uniform float uJet;                                   // how much harder fast gas grips matter
uniform vec2 uSplitAxis; uniform float uSplitStr, uSplitApp;   // differentiate: push halves apart along an axis; flip appetites across it
int nearestI(vec2 pp){ int k=0; float bd=distance(pp,uC[0]); for(int j=1;j<3;j++){ if(j<uCN){ float dj=distance(pp,uC[j]); if(dj<bd){ bd=dj; k=j; } } } return k; }
vec2 nearestC(vec2 pp){ return uC[nearestI(pp)]; }
float calmAt(ivec2 p){ vec4 s=texelFetch(uS,p,0); vec2 u=texelFetch(uFC,p,0).zw; return smoothstep(0.08,0.35,-s.y)*(1.0-smoothstep(0.01,0.04,length(u))); }
out vec4 o;
float selfAt(ivec2 q){ if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y) return 0.0; if(solidAt(q)) return 0.0; return texelFetch(uB,q,0).x; }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); int t=mtype(maskAt(p));
  if(solidAt(p)){ o=vec4(0.0); return; }
  vec2 u=texelFetch(uFC,p,0).zw;
  float gx=(selfAt(p+ivec2(1,0))-selfAt(p-ivec2(1,0)))*0.5+(selfAt(p+ivec2(3,0))-selfAt(p-ivec2(3,0)))/6.0;
  float gy=(selfAt(p+ivec2(0,1))-selfAt(p-ivec2(0,1)))*0.5+(selfAt(p+ivec2(0,3))-selfAt(p-ivec2(0,3)))/6.0;
  // cohesion toward denser matter while below the preferred density; repulsion once over it
  float here=texelFetch(uB,p,0).x;
  float calm=calmAt(p);
  float shear=0.0; { vec2 u0=u; for(int k=0;k<4;k++){ ivec2 q=wrapP(p+ivec2(k==0?3:k==1?-3:0,k==2?3:k==3?-3:0)); shear=max(shear,length(texelFetch(uFC,q,0).zw-u0)); } }
  float hold=1.0-smoothstep(0.06,0.18,shear);
  vec2 g=vec2(gx,gy)*uCoh*(1.0+1.5*calm)*(uDense-here)/uDense*hold; float gl=length(g); if(gl>0.3) g*=0.3/gl;
  vec2 toC=nearestC(vec2(p)+0.5)-(vec2(p)+0.5); float dc=length(toC); vec2 home= dc>uRnear? toC/dc*min(0.2,(dc-uRnear)*0.01): vec2(0.0);
  home*=max(0.0,1.0-here);
  int ki=nearestI(vec2(p)+0.5);
  vec2 drive=uDirs[ki];
  if(ki>0){ // a past life keeps a habit of its last intention and seeks the cold
    float tl=texelFetch(uS,wrapP(p-ivec2(3,0)),0).y, tr=texelFetch(uS,wrapP(p+ivec2(3,0)),0).y, tu=texelFetch(uS,wrapP(p-ivec2(0,3)),0).y, td=texelFetch(uS,wrapP(p+ivec2(0,3)),0).y;
    vec2 gt=vec2(tr-tl,td-tu); float gl=length(gt); if(gl>0.001) drive-=gt/gl*min(0.5,gl*3.0); }
  float jet=1.0+uJet*smoothstep(0.10,0.20,length(u));
  vec2 carry=u*uAdv*jet; if(ki==0) carry=carry*uGrip+uIVel*uInertia*0.92;
  vec2 v=carry+drive*uSwim+g+home;
  if(ki==0 && (abs(uApp.x)+abs(uApp.y)+abs(uApp.z))>0.0){ // chase chemistry
    vec4 sl=texelFetch(uS,wrapP(p-ivec2(3,0)),0), sr=texelFetch(uS,wrapP(p+ivec2(3,0)),0), su=texelFetch(uS,wrapP(p-ivec2(0,3)),0), sd=texelFetch(uS,wrapP(p+ivec2(0,3)),0);
    vec2 gh=vec2(sr.y-sl.y,sd.y-su.y), gf=vec2(sr.x-sl.x,sd.x-su.x), gc=-gh;
    float side=1.0; if(uSplitApp>0.0){ side= dot(vec2(p)+0.5-uC[0],uSplitAxis)>=0.0?1.0:-1.0; }
    vec3 app=uApp*mix(1.0,side,uSplitApp);
    vec2 ga=gh*app.x+gf*app.y+gc*app.z; float gl2=length(ga); if(gl2>0.0003) v+=ga/gl2*min(0.45,0.12+gl2*8.0); else { float a=float(hashu(uvec3(uFrame/40u,7u,3u))&1023u)/1024.0*6.2832; v+=vec2(cos(a),sin(a))*0.06; }
  }
  if(ki==0 && uSplitStr>0.0){ // differentiate: matter sorts itself by what it has lived through — warm-remembering cells toward heat, the rest toward cold
    float ex=texelFetch(uB,p,0).z; float side= ex>0.5?1.0:-1.0;
    vec4 sl=texelFetch(uS,wrapP(p-ivec2(3,0)),0), sr=texelFetch(uS,wrapP(p+ivec2(3,0)),0), su=texelFetch(uS,wrapP(p-ivec2(0,3)),0), sd=texelFetch(uS,wrapP(p+ivec2(0,3)),0);
    vec2 gh=vec2(sr.y-sl.y,sd.y-su.y); float gl3=length(gh); vec2 away=vec2(p)+0.5-uC[0]; float al=length(away);
    vec2 dirv= gl3>0.0005? gh/gl3*side : (al>0.5? away/al*side : vec2(0.0));
    v+=dirv*uSplitStr; }
  if(ki==0 && uSplitStr<0.0){ vec2 toC=uC[0]-(vec2(p)+0.5); float tl=length(toC); if(tl>1.0) v+=toC/tl*(-uSplitStr); }   // integrate: all of it is one
  float sp=length(v); if(sp>0.45) v*=0.45/sp;
  o=vec4(v,0.0,0.0);
}`;
// pass 2: conservative flux transport, then growth / withering / damage / injection
SH.body = SH.head + `
uniform sampler2D uB, uBV, uS, uFC;
uniform vec2 uCentroid; uniform float uRnear, uRfar, uGrow, uDroneR;
uniform vec2 uC[3]; uniform int uCN;
vec2 nearestD(vec2 pp){ float bd=distance(pp,uC[0]); float bi=0.0; for(int j=1;j<3;j++){ if(j<uCN){ float d=distance(pp,uC[j]); if(d<bd){ bd=d; bi=float(j); } } } return vec2(bd,bi); }
uniform vec4 uInjectB;              // x y radius amount
uniform vec2 uDrones[16]; uniform int uNDrones;
out vec4 o;
bool fluidAt(ivec2 q){ return !solidAt(q); }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); int t=mtype(maskAt(p));
  if(solidAt(p)||t==M_DRAIN){ o=vec4(0.0); return; }
  float self=texelFetch(uB,p,0).x; float s0=self;
  vec2 v0=texelFetch(uBV,p,0).xy;
  const ivec2 E4[4]=ivec2[4](ivec2(1,0),ivec2(-1,0),ivec2(0,1),ivec2(0,-1));
  for(int k=0;k<4;k++){ ivec2 q=p+E4[k]; if(!fluidAt(q)) continue;
    float sq=texelFetch(uB,q,0).x; vec2 vq=texelFetch(uBV,q,0).xy;
    float vf=dot(0.5*(v0+vq),vec2(E4[k]));          // velocity across the face, positive = leaving p
    float flux= vf>0.0? vf*s0 : vf*sq;                // upwind
    self-=flux;
    self+=0.03*(sq-s0);                               // symmetric exchange: conservative diffusion
  }
  vec2 nd=nearestD(vec2(p)+0.5); float dc=nd.x; bool ghost=nd.y>0.5;
  float avg=0.0; float nn=0.0; for(int k=0;k<4;k++){ ivec2 q=p+E4[k]; if(fluidAt(q)){ avg+=texelFetch(uB,q,0).x; nn+=1.0; } } if(nn>0.0) avg/=nn;
  vec4 sp=texelFetch(uS,p,0);
  float before=self;
  if(dc>uRfar) self*=0.95;                                       // stragglers wither
  else if(dc<uRnear){ float calm=smoothstep(0.08,0.35,-sp.y)*(1.0-smoothstep(0.01,0.04,length(texelFetch(uFC,p,0).zw)));
    if(ghost){ if(calm<0.4) self*=0.986; }                                            // a past life fades unless it rests in a cold still pocket
    else self+=uGrow*(1.0+2.5*calm)*avg*max(0.0,1.0-self); }                          // close cells reinforce; cold still pockets condense you
  self*=0.9995;
  if(sp.y>0.35) self*=1.0-min(0.3,(sp.y-0.35)*0.18);
  self-=max(sp.w-0.08,0.0)*0.04;                                   // the organism feeds on you
  if(sp.y>0.35 && sp.w>0.05 && dc<uRfar) self+=sp.w*(sp.y-0.35)*0.35;   // organism burning near you becomes you
  for(int i=0;i<uNDrones;i++){ if(distance(vec2(p)+0.5,uDrones[i])<uDroneR) self*=0.93; }
  float lost=max(0.0,before-self);
  vec2 dv=vec2(p)+0.5-uInjectB.xy; float dd=dot(dv,dv); if(dd<uInjectB.z*uInjectB.z){ self=max(self,uInjectB.w*(1.0-dd/(uInjectB.z*uInjectB.z)*0.5)); }
  if(self<0.003){ lost+=self; self=0.0; }
  // exposure: what this matter has lived through (heat), carried with it
  float ex=texelFetch(uB,p,0).z; vec2 v0b=texelFetch(uBV,p,0).xy; ivec2 from=ivec2(floor(vec2(p)+0.5-v0b)); float exFrom=texelFetch(uB,wrapP(from),0).z;
  ex=mix(ex,exFrom,0.5); ex+=max(sp.y,0.0)*0.02-ex*0.0008; if(self<=0.0) ex=0.0;
  o=vec4(clamp(self,0.0,2.0),lost,clamp(ex,0.0,1.0),0.0);
}`;
// ---------------- walls: solidity, soot, residue, kind ----------------
SH.wallsInit = SH.head + `
out vec4 o;
float vn(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f); float a=float(hashu(uvec3(uint(i.x+500.0),uint(i.y+500.0),9u))&255u)/255.0, b=float(hashu(uvec3(uint(i.x+501.0),uint(i.y+500.0),9u))&255u)/255.0, c=float(hashu(uvec3(uint(i.x+500.0),uint(i.y+501.0),9u))&255u)/255.0, d=float(hashu(uvec3(uint(i.x+501.0),uint(i.y+501.0),9u))&255u)/255.0; return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); int t=mtype(maskAt(p)); bool s=solidT(t);
  if(!s){ o=vec4(0.0); return; }
  bool face=false; for(int k=0;k<4;k++){ ivec2 q=p+ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0); if(q.x>=0&&q.y>=0&&q.x<uRes.x&&q.y<uRes.y && !solidT(mtype(maskAt(q)))) face=true; }
  float grime=vn(vec2(p)/37.0)*0.7+vn(vec2(p)/9.0)*0.3;          // patchy soot
  float wear=vn(vec2(p)/23.0+7.0);                                 // eroded faces
  float phi=1.0; if(face){ phi=mix(1.0,0.55,smoothstep(0.55,0.9,wear)); }
  float soot=face? smoothstep(0.5,0.95,grime)*0.6 : 0.0;
  float kind=face&&vn(vec2(p)/31.0+3.0)>0.8 ? 0.5 : 0.0;           // old frost crusts here and there
  o=vec4(phi,soot,0.0,kind); }`;
SH.walls = SH.head + `
uniform sampler2D uS, uFC, uB; out vec4 o;
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); vec4 w=texelFetch(uWf,p,0); float phi=w.x, soot=w.y, res=w.z, kind=w.w;
  int t=mtype(maskAt(p));
  if(p.x<=0||p.y<=0||p.x>=uRes.x-1||p.y>=uRes.y-1){ o=vec4(1.0,soot,res,0.0); return; }
  vec4 s=texelFetch(uS,p,0); vec2 u=texelFetch(uFC,p,0).zw; vec2 b=texelFetch(uB,p,0).xy;
  float nsmoke=0.0, nheat=0.0, nlife=0.0, ncold=0.0, ncond=0.0; bool solidN=false;
  for(int k=0;k<4;k++){ ivec2 q=p+ivec2(k==0?1:k==1?-1:0, k==2?1:k==3?-1:0); vec4 ns=texelFetch(uS,q,0); nsmoke=max(nsmoke,ns.z); nheat=max(nheat,ns.y); nlife=max(nlife,ns.w); ncold=max(ncold,-ns.y); ncond=max(ncond,ns.z+ns.x); if(solidAt(q)) solidN=true; }
  float heat=max(s.y,nheat);
  if(hardT(t)){ if(t!=M_MOVING) soot+=nsmoke*0.004+max(heat-0.5,0.0)*0.002; o=vec4(phi,min(soot,1.0),res,kind); return; }
  if(phi>0.0){
    float meltT=mix(0.9,0.45,kind);                       // grown material gives way easily
    if(heat>meltT) phi-=(heat-meltT)*mix(0.004,0.03,kind);
    soot+=nsmoke*0.004+max(heat-0.5,0.0)*0.002;
    if(phi<0.5) phi-=length(u)*0.03;                      // porous rubble erodes in the flow
  }
  if(phi<1.0 && t!=M_VENT && t!=M_DRAIN && t!=M_EXIT && t!=M_CHECK && solidN){
    float cold=max(-s.y,ncold); float cond=max(s.z+s.x,ncond);
    if(cold>0.15 && cond>0.05){ phi+=cold*cond*0.04; kind=mix(kind,0.5,0.05); }   // frost crust
    float life=max(s.w,nlife); if(life>0.45){ phi+=(life-0.45)*0.012; kind=mix(kind,1.0,0.05); } // tissue
  }
  res+=b.y*0.6+b.x*0.0003; res*=0.9994;                   // the trace of lost selves
  soot*=0.99995;
  o=vec4(clamp(phi,0.0,1.0),min(soot,1.0),min(res,1.0),clamp(kind,0.0,1.0));
}`;
// ---------------- light: emitted by the body and by heat, diffused through open cells ----------------
// texture is world/4: r light, g solid fraction of the block, b emission
SH.light = SH.head + `
uniform sampler2D uL, uB, uS; uniform ivec2 uLRes; uniform int uInit; out vec4 o;
void main(){
  ivec2 lp=ivec2(gl_FragCoord.xy); ivec2 b=lp*4;
  float em=0.0, sol=0.0;
  for(int y=0;y<4;y++) for(int x=0;x<4;x++){ ivec2 q=b+ivec2(x,y); if(q.x>=uRes.x||q.y>=uRes.y){ sol+=1.0; continue; } if(solidAt(q)) sol+=1.0; else { vec4 sp=texelFetch(uS,q,0); em+=texelFetch(uB,q,0).x*1.6+max(sp.y,0.0)*0.35; } }
  sol/=16.0; em/=16.0;
  if(uInit==1){ o=vec4(0.0,sol,em,0.0); return; }
  float best=0.0;
  for(int k=0;k<8;k++){ ivec2 d=ivec2(k==0?1:k==1?-1:k==4?1:k==5?-1:k==6?1:k==7?-1:0, k==2?1:k==3?-1:k==4?1:k==5?1:k==6?-1:k==7?-1:0); ivec2 q=lp+d; if(q.x<0||q.y<0||q.x>=uLRes.x||q.y>=uLRes.y) continue; vec4 n=texelFetch(uL,q,0); float att=(k<4)?0.945:0.92; best=max(best,n.r*att*(1.0-n.g*0.9)); }
  float prev=texelFetch(uL,lp,0).r;
  float L=max(min(em*4.0,2.5), best);
  L*=1.0-sol*0.7;
  L=mix(prev,L,0.6);
  o=vec4(L,sol,em,0.0);
}`;
// ---------------- bloom: emissive extract (half res) and separable blur ----------------
SH.bloomExtract = SH.head + `
uniform sampler2D uS, uB; uniform vec2 uCam; uniform float uZoom; uniform vec2 uScreen; out vec4 o;
void main(){ vec2 wc=uCam+vec2(gl_FragCoord.x,uScreen.y*0.5-gl_FragCoord.y)*2.0/uZoom; ivec2 p=wrapP(ivec2(floor(wc)));
  float self=texelFetch(uB,p,0).x; float h=max(texelFetch(uS,p,0).y,0.0);
  vec3 e=vec3(0.55,0.78,1.0)*min(1.0,self*1.2)+vec3(1.0,0.5,0.15)*h*0.9+vec3(1.0,0.9,0.7)*h*h*0.5;
  o=vec4(e,1.0); }`;
SH.blur = `#version 300 es
precision highp float; uniform sampler2D uT; uniform vec2 uDir; uniform vec2 uTexel; out vec4 o;
void main(){ vec2 uv=gl_FragCoord.xy*uTexel; vec3 acc=vec3(0.0); float ws[5]=float[5](0.227,0.195,0.122,0.054,0.016);
  acc+=texture(uT,uv).rgb*ws[0]; for(int i=1;i<5;i++){ vec2 off=uDir*uTexel*float(i)*2.0; acc+=texture(uT,uv+off).rgb*ws[i]; acc+=texture(uT,uv-off).rgb*ws[i]; }
  o=vec4(acc,1.0); }`;
// reductions: cells are assigned to the nearest live centre (up to 3 selves); sums per centre, second moments
// of the main self (centre 0), and the farthest cell from the main self (for re-seeding a lost fragment).
//  T0 (m0, mx0, my0, burn)   T1 (xx0, yy0, xy0, m1)   T2 (mx1, my1, m2, mx2)   T3 (my2, farDist, farX, farY)
SH.reduce0 = SH.head + `
uniform sampler2D uB, uS; uniform vec2 uC[3]; uniform int uCN;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2; layout(location=3) out vec4 o3;
void main(){ ivec2 b=ivec2(gl_FragCoord.xy)*4; vec4 a0=vec4(0.0),a1=vec4(0.0),a2=vec4(0.0),a3=vec4(0.0);
  for(int y=0;y<4;y++) for(int x=0;x<4;x++){ ivec2 q=b+ivec2(x,y); if(q.x>=uRes.x||q.y>=uRes.y) continue; float s=texelFetch(uB,q,0).x; if(s<=0.0) continue;
    float px=float(q.x)+0.5, py=float(q.y)+0.5; vec2 pp=vec2(px,py);
    int k=0; float bd=distance(pp,uC[0]); for(int j=1;j<3;j++){ if(j<uCN){ float dj=distance(pp,uC[j]); if(dj<bd){ bd=dj; k=j; } } }
    float h=max(texelFetch(uS,q,0).y,0.0); a0.w+=s*h;
    if(k==0){ a0.xyz+=vec3(s,s*px,s*py); a1.xyz+=vec3(s*px*px,s*py*py,s*px*py); }
    else if(k==1){ a1.w+=s; a2.xy+=vec2(s*px,s*py); }
    else { a2.z+=s; a2.w+=s*px; a3.x+=s*py; }
    float d0=distance(pp,uC[0]); if(s>0.15 && d0>a3.y){ a3.yzw=vec3(d0,px,py); } }
  o0=a0; o1=a1; o2=a2; o3=a3; }`;
SH.reduceN = SH.head + `
uniform sampler2D uL0, uL1, uL2, uL3; uniform ivec2 uLRes;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2; layout(location=3) out vec4 o3;
void main(){ ivec2 b=ivec2(gl_FragCoord.xy)*4; vec4 a0=vec4(0.0),a1=vec4(0.0),a2=vec4(0.0),a3=vec4(0.0);
  for(int y=0;y<4;y++) for(int x=0;x<4;x++){ ivec2 q=b+ivec2(x,y); if(q.x>=uLRes.x||q.y>=uLRes.y) continue; a0+=texelFetch(uL0,q,0); a1+=texelFetch(uL1,q,0); a2+=texelFetch(uL2,q,0); vec4 t=texelFetch(uL3,q,0); a3.x+=t.x; if(t.y>a3.y) a3.yzw=t.yzw; }
  o0=a0; o1=a1; o2=a2; o3=a3; }`;

// ---------------- dynamic mask: copy static then machines are drawn as quads ----------------
SH.maskCopy = SH.head + `
uniform sampler2D uStatic; out vec4 o; void main(){ o=texelFetch(uStatic,ivec2(gl_FragCoord.xy),0); }`;
SH.machVS = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in vec3 aVel; uniform vec2 uResF; out vec3 vVel;
void main(){ vVel=aVel; gl_Position=vec4(aPos/uResF*2.0-1.0,0.0,1.0); }`;
SH.machFS = `#version 300 es
precision highp float; in vec3 vVel; out vec4 o; void main(){ o=vec4(vVel.z/255.0, clamp(vVel.xy*0.5+0.5,0.0,1.0), 1.0); }`;

// ---------------- probe: sample fields at N positions for the CPU ----------------
SH.probe = SH.head + `
uniform sampler2D uFC, uS; uniform vec2 uPts[64]; out vec4 o;
void main(){ int i=int(gl_FragCoord.x); vec2 pt=uPts[i]; ivec2 p=ivec2(floor(pt)); p=wrapP(p);
  vec4 c=texelFetch(uFC,p,0); vec4 s=texelFetch(uS,p,0); int t=mtype(maskAt(p));
  o=vec4(c.z,c.w,s.y,float(t)+ (s.x<0.0?0.0:0.0)); }`;
SH.probe2 = SH.head + `
uniform sampler2D uFC, uS, uB; uniform vec2 uPts[64]; out vec4 o;
void main(){ int i=int(gl_FragCoord.x); vec2 pt=uPts[i]; ivec2 p=wrapP(ivec2(floor(pt))); vec4 s=texelFetch(uS,p,0); float b=texelFetch(uB,p,0).x; o=vec4(s.x,s.z,s.w,b); }`;

// ---------------- render ----------------
SH.render = SH.head + `
uniform sampler2D uS, uFC, uDye, uB, uLight, uBloom;
uniform vec2 uCam; uniform float uZoom; uniform vec2 uScreen; uniform int uDebug;
uniform vec4 uPlayer;        // x y radius facing
uniform vec4 uEnt[48]; uniform int uNEnt;   // x y kind radius
uniform float uPHurt, uPHp; uniform vec2 uC[3]; uniform int uCN; uniform vec4 uTint; uniform vec2 uSplitAxisR; uniform float uSplitSideR;
out vec4 o;
vec3 hsv(float h,float s,float v){ vec3 k=vec3(1.0,2.0/3.0,1.0/3.0); vec3 p=abs(fract(vec3(h)+k)*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float wallShade(ivec2 p){ // bevel from neighbours
  float s=0.0; for(int k=0;k<4;k++){ ivec2 q=p+ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0); if(!solidAt(q)) s+=(k==3)?0.35:(k==2)?-0.15:0.12; } return s; }
void main(){
  vec2 wc=uCam+vec2(gl_FragCoord.x,uScreen.y-gl_FragCoord.y)/uZoom;
  ivec2 p=ivec2(floor(wc));
  vec4 m=maskAt(p); int t=mtype(m);
  vec4 s=texelFetch(uS,wrapP(p),0); vec4 c=texelFetch(uFC,wrapP(p),0); vec4 d=texelFetch(uDye,wrapP(p),0);
  vec3 col;
  vec4 wf=texelFetch(uWf,wrapP(p),0); bool solid=solidAt(p);
  float light=texture(uLight,(wc)/vec2(uRes)).r; float lit=0.045+min(1.6,light*1.6);
  if(uDebug==4){ o=vec4(vec3(min(1.0,light)),1.0); return; }
  if(uDebug==1){ vec2 u=c.zw; col=mix(vec3(0.05),hsv(atan(u.y,u.x)/6.2832+0.5,1.0,1.0),clamp(length(u)*5.0,0.0,1.0)); if(solid) col=vec3(0.2); o=vec4(col,1.0); return; }
  if(uDebug==2){ col=vec3(s.x,max(s.y,0.0),s.w); if(s.y<0.0) col.b+= -s.y; if(solid) col=vec3(0.2); o=vec4(col,1.0); return; }
  if(uDebug==3){ col=vec3(wf.x,wf.y,wf.z); o=vec4(col,1.0); return; }
  if(solid){
    ivec2 pp=p/24; float pn=float(hashu(uvec3(uint(pp.x+31),uint(pp.y+17),7u))&255u)/255.0;
    float grid=(mod(float(p.x),24.0)<1.0||mod(float(p.y),24.0)<1.0)?0.07:0.0;
    float rivet=((mod(float(p.x),24.0)<3.0&&mod(float(p.y),24.0)<3.0)&&mod(float(p.x),24.0)>=1.0&&mod(float(p.y),24.0)>=1.0)?0.08:0.0;
    float fine=float(hashu(uvec3(uint(p.x),uint(p.y),3u))&255u)/255.0*0.04;
    col=vec3(0.27,0.29,0.33)+pn*0.08+wallShade(p)*0.5-grid+rivet+fine;
    vec3 frost=vec3(0.72,0.82,0.92), tissue=vec3(0.45,0.22,0.5);
    if(wf.w>0.0){ col=mix(col, wf.w<0.5? mix(col,frost,wf.w*2.0) : mix(frost,tissue,(wf.w-0.5)*2.0), 0.9); }
    float er=smoothstep(0.5,0.95,wf.x); col*=0.45+0.55*er; if(er<0.7) col+=fine*6.0*(0.7-er);
    col=mix(col,vec3(0.06,0.04,0.03),min(0.8,wf.y*0.9));
    if(t==M_BURNER) col=mix(col,vec3(1.0,0.45,0.1),0.7+0.3*sin(uTime*6.0+float(p.x)));
    else if(t==M_COOLER) col=mix(col,vec3(0.3,0.7,1.0),0.7)*(0.8+0.2*sin(uTime*2.0));
    else if(t==M_FUEL) col=mix(col,vec3(0.3,0.9,0.5),0.7);
    else if(t==M_SPORE) col=mix(col,vec3(0.8,0.3,0.9),0.7);
    else if(t==M_MOVING) col=vec3(0.55,0.5,0.45)+wallShade(p)*0.3;
    bool src=(t==M_BURNER||t==M_COOLER||t==M_FUEL||t==M_SPORE);
    col*=src? max(lit,0.55) : lit;
    if(s.y>0.0 && t!=M_BURNER) col+=vec3(1.0,0.4,0.1)*clamp(s.y*0.3,0.0,0.5); // hot walls glow
    o=vec4(col,1.0); return;
  }
  // gas volume
  vec3 bg=vec3(0.035,0.04,0.055);
  if(t==M_VENT) bg=vec3(0.1,0.25,0.3); if(t==M_DRAIN) bg=vec3(0.25,0.1,0.1); if(t==M_EXIT) bg=vec3(1.0,0.85,0.25)*(0.7+0.3*sin(uTime*4.0)); if(t==M_CHECK) bg=vec3(0.2,0.6,0.3)*(0.7+0.3*sin(uTime*3.0)); if(t==M_GRATE) bg=vec3(0.12,0.13,0.15);
  col=bg;
  if(wf.x>0.0){ col=mix(col,vec3(0.3,0.3,0.33)*(0.5+0.5*(1.0-wf.y)),wf.x*0.8); }
  float sp=length(c.zw);
  float streak=(d.r+d.g+d.b)/3.0-0.5;                       // signed noise, stretched along the flow
  col+=vec3(0.30,0.40,0.55)*(0.10+min(1.0,sp*6.0)*0.55)*(0.5+streak);  // streaklines, brighter where the gas moves
  col+=vec3(0.15,0.55,0.35)*s.x*0.45;                     // fuel haze
  col=mix(col,vec3(0.02),clamp(s.z*0.5,0.0,0.7));          // smoke
  col*=lit;                                               // lit by the self and by fire
  float h=max(s.y,0.0);
  col+=vec3(1.0,0.5,0.15)*h*0.8+vec3(1.0,0.9,0.7)*h*h*0.5; // heat glow
  if(s.y<0.0) col+=vec3(0.18,0.42,0.8)*min(1.0,-s.y*1.6);     // cold: a blue breath you can see
  float L=s.w; col=mix(col,vec3(0.75,0.25,0.9)*(0.6+0.4*sin(uTime*2.0+L*12.0)),clamp(L*1.6,0.0,0.85)); // organism
  float pr=c.y; col+=vec3(0.3,0.25,0.2)*clamp((pr-1.15)*1.5,0.0,1.0);  // pressure fronts
  col+=vec3(0.35,0.5,0.85)*wf.z*0.9*(0.85+0.15*sin(uTime*1.5+float(p.x+p.y)*0.2));   // residue: where selves were lost
  col+=texture(uBloom,gl_FragCoord.xy/uScreen).rgb*0.55;
  col=1.0-exp(-col*1.4);
  // entities
  for(int i=0;i<uNEnt;i++){ vec4 e=uEnt[i]; float dd=length(wc-e.xy); if(dd<e.w){ vec3 ec = e.z<1.0? vec3(1.0,0.85,0.2) : e.z<2.0? vec3(1.0,0.2,0.2) : vec3(0.4,1.0,0.9); col=mix(col,ec,0.9); } else if(dd<e.w*2.5){ col+=(e.z<1.0?vec3(0.5,0.4,0.1):e.z<2.0?vec3(0.4,0.05,0.05):vec3(0.1,0.3,0.3))*(1.0-dd/(e.w*2.5)); } }
  float self=texelFetch(uB,wrapP(p),0).x;
  self=(self*4.0+texelFetch(uB,wrapP(p+ivec2(1,0)),0).x+texelFetch(uB,wrapP(p-ivec2(1,0)),0).x+texelFetch(uB,wrapP(p+ivec2(0,1)),0).x+texelFetch(uB,wrapP(p-ivec2(0,1)),0).x)/8.0;
  if(self>0.0){ float k=min(1.0,pow(self/0.9,0.7)); vec3 bc=mix(vec3(0.5,0.78,1.0),vec3(1.0,1.0,1.0),k*k);
    { float d0=distance(wc,uC[0]); bool ghost=false; for(int j=1;j<3;j++){ if(j<uCN && distance(wc,uC[j])<d0) ghost=true; } if(ghost){ bc=mix(bc,vec3(0.45,0.6,0.9),0.5)*0.8; k*=0.85; } }
    if(uTint.a>0.0) bc=mix(bc,uTint.rgb,uTint.a);
    if(uSplitSideR>0.0){ float ex=texelFetch(uB,wrapP(p),0).z; bc=mix(bc, ex>0.5? vec3(1.0,0.6,0.3):vec3(0.4,0.7,1.0), uSplitSideR*0.6); } bc=mix(bc,vec3(1.0,0.35,0.3),uPHurt*0.7); col=mix(col,bc,min(1.0,k*1.2)); col+=vec3(0.12,0.22,0.4)*k; }
  o=vec4(col,1.0);
}`;
