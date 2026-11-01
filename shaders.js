// shaders.js — GLSL for the GPU cellular automaton
'use strict';
const SH = {};
SH.header = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D; precision highp sampler2D;
${GLSL_TYPES}
#define F_SOLID 1u
#define F_LIQUID 2u
#define F_POWDER 4u
#define F_GAS 8u
#define F_FLAM 16u
#define F_HOT 32u
#define F_ENT 64u
#define F_CLIMB 128u
uniform usampler2D uCell;   // world: r type, g meta, b shade, a flags
uniform usampler2D uProps;  // 256x1: r density, g flags, b ignite/8, a burn life
uniform ivec2 uWorld;       // world size
uniform ivec2 uWin;         // window origin in world cells
uniform ivec2 uWinSize;
uniform uint uFrame;
uvec4 cellAt(ivec2 wp){ if(wp.x<0||wp.y<0||wp.x>=uWorld.x||wp.y>=uWorld.y) return uvec4(T_BEDROCK,0u,128u,0u); return texelFetch(uCell,wp,0); }
uvec4 propsOf(uint t){ return texelFetch(uProps,ivec2(int(t),0),0); }
uint flagsOf(uint t){ return propsOf(t).g; }
uint densOf(uint t){ return propsOf(t).r; }
bool isSolid(uint t){ return (flagsOf(t)&F_SOLID)!=0u && (flagsOf(t)&F_POWDER)==0u; }
bool isPowder(uint t){ return (flagsOf(t)&F_POWDER)!=0u; }
bool isLiquid(uint t){ return (flagsOf(t)&F_LIQUID)!=0u; }
bool isGas(uint t){ return (flagsOf(t)&F_GAS)!=0u; }
bool isHot(uint t){ return (flagsOf(t)&F_HOT)!=0u; }
bool isEnt(uint t){ return (flagsOf(t)&F_ENT)!=0u; }
bool isFlam(uint t){ return (flagsOf(t)&F_FLAM)!=0u; }
bool blocksFluid(uint t){ uint f=flagsOf(t); return (f&(F_SOLID|F_POWDER))!=0u && t!=T_CLOUD; } // cloud lets air through
uint hashu(uvec3 v){ uint h=v.x*1664525u + v.y*1013904223u + v.z*69069u; h^=h>>13; h*=0x5bd1e995u; h^=h>>15; h*=0x27d4eb2du; h^=h>>13; return h; }
float rnd(ivec2 p, uint salt){ return float(hashu(uvec3(uint(p.x+7777),uint(p.y+7777),uFrame*7u+salt))&0xffffffu)/16777216.0; }
`;

// ---------------- Lattice Boltzmann + heat ----------------
SH.lbm = SH.header + `
uniform sampler2D uFld;   // window: vx vy T f0
uniform sampler2D uFA;    // f1..f4  (E N W S)   N = up (y-1)
uniform sampler2D uFB;    // f5..f8  (NE NW SW SE)
uniform sampler2D uSurf;  // world width x 1: surface row
uniform float uTau, uBuoy, uGliq;
layout(location=0) out vec4 oFld; layout(location=1) out vec4 oFA; layout(location=2) out vec4 oFB;
const float w0=4.0/9.0, w1=1.0/9.0, w2=1.0/36.0;
const ivec2 E[9]=ivec2[9](ivec2(0,0),ivec2(1,0),ivec2(0,-1),ivec2(-1,0),ivec2(0,1),ivec2(1,-1),ivec2(-1,-1),ivec2(-1,1),ivec2(1,1));
const float W[9]=float[9](w0,w1,w1,w1,w1,w2,w2,w2,w2);
const int OPP[9]=int[9](0,3,4,1,2,7,8,5,6);
bool inWin(ivec2 p){ return p.x>=0&&p.y>=0&&p.x<uWinSize.x&&p.y<uWinSize.y; }
float fget(ivec2 p,int i){ if(i==0) return texelFetch(uFld,p,0).a; if(i<=4) return texelFetch(uFA,p,0)[i-1]; return texelFetch(uFB,p,0)[i-5]; }
float feq(int i,float rho,vec2 u){ float eu=float(E[i].x)*u.x+float(E[i].y)*u.y; return W[i]*rho*(1.0+3.0*eu+4.5*eu*eu-1.5*dot(u,u)); }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); ivec2 wp=p+uWin;
  uvec4 me=cellAt(wp); uint t=me.r;
  vec4 fld=texelFetch(uFld,p,0);
  // ---- heat: conduction, advection, sources ----
  float T=fld.z;
  float Tn[4]; bool blk[4];
  for(int k=0;k<4;k++){ ivec2 q=p+E[k+1]; if(inWin(q)){ Tn[k]=texelFetch(uFld,q,0).z; blk[k]=blocksFluid(cellAt(q+uWin).r); } else { Tn[k]=T; blk[k]=true; } }
  float alpha = isSolid(t)? 0.06 : isLiquid(t)? 0.10 : isPowder(t)? 0.08 : 0.22;
  if(t==T_WATER) alpha=0.14;
  float avg=(Tn[0]+Tn[1]+Tn[2]+Tn[3])*0.25;
  float Tnew=T+alpha*(avg-T);
  vec2 u=fld.xy;
  if(!blocksFluid(t)){ // upwind advection by the fluid
    float ux=u.x, uy=u.y;
    Tnew -= max(ux,0.0)*(T-Tn[2]) + min(ux,0.0)*(Tn[0]-T);
    Tnew -= max(uy,0.0)*(T-Tn[1]) + min(uy,0.0)*(Tn[3]-T);
  }
  float surf=texelFetch(uSurf,ivec2(clamp(wp.x,0,uWorld.x-1),0),0).r;
  float depth=float(wp.y)-surf;
  float Tamb=20.0+max(0.0,depth)*0.12;
  float relax=(t==T_EMPTY||isGas(t))?0.006:0.0008;
  Tnew=mix(Tnew,Tamb,relax);
  if(t==T_LAVA) Tnew=mix(Tnew,1100.0,0.08);
  else if(t==T_FIRE) Tnew=mix(Tnew,650.0+float(me.g)*3.0,0.35);
  else if(t==T_BLAST) Tnew=mix(Tnew,1200.0,0.6);
  else if(t==T_EMBER) Tnew=mix(Tnew,480.0,0.15);
  else if(t==T_TORCH) Tnew=mix(Tnew,420.0,0.25);
  else if(t==T_SPARK) Tnew=mix(Tnew,500.0,0.3);
  else if(t==T_WISP) Tnew=mix(Tnew,400.0,0.3);
  else if(t==T_ICE) Tnew=mix(Tnew,-14.0,0.12);
  else if(t==T_SNOW) Tnew=mix(Tnew,-6.0,0.08);
  else if(t==T_STEAM) Tnew=max(Tnew,mix(Tnew,110.0,0.05));
  else if(t==T_GEYSER) Tnew=mix(Tnew,140.0,0.1);
  Tnew=clamp(Tnew,-60.0,1500.0);
  // ---- lattice fluid ----
  if(blocksFluid(t)){ oFld=vec4(0.0,0.0,Tnew,w0); oFA=vec4(w1); oFB=vec4(w2); return; }
  if(t==T_BLAST){ float rho=2.6; oFld=vec4(0.0,0.0,Tnew,feq(0,rho,vec2(0))); oFA=vec4(feq(1,rho,vec2(0)),feq(2,rho,vec2(0)),feq(3,rho,vec2(0)),feq(4,rho,vec2(0))); oFB=vec4(feq(5,rho,vec2(0)),feq(6,rho,vec2(0)),feq(7,rho,vec2(0)),feq(8,rho,vec2(0))); return; }
  float f[9];
  f[0]=fld.a;
  for(int i=1;i<9;i++){
    ivec2 q=p-E[i];
    if(!inWin(q)){ f[i]=W[i]; continue; }
    uint nt=cellAt(q+uWin).r;
    if(blocksFluid(nt)) f[i]=fget(p,OPP[i]);         // bounce back off solids and piles
    else f[i]=fget(q,i);
  }
  float rho=0.0; vec2 mom=vec2(0.0);
  for(int i=0;i<9;i++){ rho+=f[i]; mom+=f[i]*vec2(E[i]); }
  rho=clamp(rho,0.4,3.0);
  vec2 un=mom/rho;
  vec2 F=vec2(0.0);
  if(isLiquid(t)){ F.y+=uGliq; un*=0.985; }
  else { F.y-= uBuoy*(Tnew-Tamb)/1000.0; }
  vec2 ueq=un+uTau*F/rho;
  float sp=length(ueq); if(sp>0.28) ueq*=0.28/sp;
  float tau=uTau; if(isLiquid(t)) tau=uTau+0.4;
  float g[9];
  for(int i=0;i<9;i++) g[i]=f[i]-(f[i]-feq(i,rho,ueq))/tau;
  oFld=vec4(ueq,Tnew,g[0]); oFA=vec4(g[1],g[2],g[3],g[4]); oFB=vec4(g[5],g[6],g[7],g[8]);
}`;

// ---------------- reactions (in place, reads neighbours) ----------------
SH.react = SH.header + `
uniform sampler2D uFld; uniform sampler2D uSurf;
out uvec4 o;
bool inWin(ivec2 p){ return p.x>=0&&p.y>=0&&p.x<uWinSize.x&&p.y<uWinSize.y; }
float tempAt(ivec2 p){ return inWin(p)? texelFetch(uFld,p,0).z : 20.0; }
bool dissolvable(uint t){ return !(t==T_EMPTY||t==T_ACID||t==T_GLASS||t==T_OBSIDIAN||t==T_BEDROCK||t==T_FLAG||t==T_GOLD||t==T_SPRING||t==T_GEYSER||t==T_BOUNCE||t==T_TORCH||t==T_CRYSTAL||isGas(t)); }
bool supportsVine(uint t){ return t==T_VINE||t==T_LEAF||t==T_WOOD||t==T_STONE||t==T_DIRT||t==T_GRASS||t==T_MOSS||t==T_BEDROCK||t==T_CLOUD||t==T_BEANSTALK||t==T_ICE||t==T_OBSIDIAN||t==T_CRYSTAL||isEnt(t); }
uvec4 mk(uint t,uint m,ivec2 wp){ return uvec4(t,m,hashu(uvec3(uint(wp.x),uint(wp.y),uFrame))&255u,0u); }
void main(){
  ivec2 wp=ivec2(gl_FragCoord.xy); ivec2 p=wp-uWin;
  uvec4 me=cellAt(wp); uint t=me.r; uint life=me.g; uint fl=me.a;
  o=me;
  if(t==T_BEDROCK) return;
  uvec4 N=cellAt(wp+ivec2(0,-1)), S=cellAt(wp+ivec2(0,1)), Wc=cellAt(wp+ivec2(-1,0)), Ec=cellAt(wp+ivec2(1,0));
  uvec4 NE=cellAt(wp+ivec2(1,-1)), NW=cellAt(wp+ivec2(-1,-1)), SE=cellAt(wp+ivec2(1,1)), SW=cellAt(wp+ivec2(-1,1));
  float T=tempAt(p);
  float r=rnd(wp,1u), r2=rnd(wp,2u);
  float surf=texelFetch(uSurf,ivec2(clamp(wp.x,0,uWorld.x-1),0),0).r;
  uvec4 pr=propsOf(t);
  bool hotN=isHot(N.r)||isHot(S.r)||isHot(Wc.r)||isHot(Ec.r);
  bool waterN=(N.r==T_WATER||S.r==T_WATER||Wc.r==T_WATER||Ec.r==T_WATER);
  // ---- blast wave: expands one cell per step, then becomes fire ----
  uint bl=0u; bool diag=false;
  if(N.r==T_BLAST) bl=max(bl,N.g); if(S.r==T_BLAST) bl=max(bl,S.g); if(Wc.r==T_BLAST) bl=max(bl,Wc.g); if(Ec.r==T_BLAST) bl=max(bl,Ec.g);
  if(NE.r==T_BLAST&&NE.g>bl){ bl=NE.g; diag=true; } if(NW.r==T_BLAST&&NW.g>bl){ bl=NW.g; diag=true; } if(SE.r==T_BLAST&&SE.g>bl){ bl=SE.g; diag=true; } if(SW.r==T_BLAST&&SW.g>bl){ bl=SW.g; diag=true; }
  if(t==T_BLAST){ o= r<0.6? mk(T_FIRE,8u+uint(r2*14.0),wp) : mk(T_SMOKE,20u+uint(r2*30.0),wp); return; }
  if(bl>0u && t!=T_FLAG){
    bool resist = (t==T_STONE||t==T_OBSIDIAN||t==T_GLASS||t==T_CRYSTAL||t==T_ICE) ? (bl<4u || r<0.5) : false;
    if(t==T_GUNPOWDER){ o=mk(T_BLAST,9u,wp); return; }
    if(!resist && (!diag || r<0.45)){ o=mk(T_BLAST,bl-1u,wp); return; }
  }
  // ---- ignition by heat or hot neighbours ----
  if(isFlam(t) && t!=T_GUNPOWDER){
    float ig=float(pr.b)*8.0;
    bool catchFire = (T>ig && r<0.25) || (hotN && r<0.08*(isGas(t)?4.0:1.0));
    if(catchFire && !waterN){ o=mk(T_FIRE,uint(pr.a),wp); return; }
  } else if(t==T_GUNPOWDER && (hotN || T>150.0)){ o=mk(T_BLAST,9u,wp); return; }
  // ---- entities burn, dissolve ----
  if(isEnt(t)){
    if((fl&1u)==0u){ // not wet
      if((T>320.0 && r<0.08) || (N.r==T_LAVA||S.r==T_LAVA||Wc.r==T_LAVA||Ec.r==T_LAVA) && r<0.3){ o=mk(T_FIRE,6u,wp); return; }
      if((fl&2u)!=0u && (hotN || T>140.0) && r<0.25){ o=mk(T_FIRE,8u,wp); return; }   // oily
    }
    if((N.r==T_ACID||S.r==T_ACID||Wc.r==T_ACID||Ec.r==T_ACID) && r<0.08){ o=mk(T_SMOKE,12u,wp); return; }
    return;
  }
  switch(t){
    case T_EMPTY: {
      if(S.r==T_FIRE && r<0.08){ o=mk(T_SMOKE,20u+uint(r2*40.0),wp); return; }
      if(N.r==T_SPRING && r<0.12){ o=mk(T_WATER,0u,wp); return; }
      if(N.r==T_GEYSER && N.g>170u){ o=mk(T_STEAM,90u+uint(r2*40.0),wp); return; }
      if(N.r==T_TORCH && r<0.25){ o=mk(T_FIRE,3u+uint(r2*4.0),wp); return; }
      if(N.r==T_CLOUD && r<(cellAt(wp+ivec2(0,-2)).r==T_CLOUD?0.0025:0.0005)){ o=mk(T_WATER,0u,wp); return; }
      if(N.r==T_VINE && N.g>0u && rnd(wp+ivec2(0,-1),9u)<0.04){ o=mk(T_VINE,N.g-1u,wp); return; }
      if(N.r==T_LEAF && r<0.00015){ o=mk(T_VINE,8u+uint(r2*14.0),wp); return; }
      if(S.r==T_BEANSTALK && S.g>0u && rnd(wp+ivec2(0,1),9u)<0.35){ o=mk(T_BEANSTALK,S.g-1u,wp); return; }
      if((Wc.r==T_BEANSTALK && (Wc.g&7u)==0u && (Wc.g&8u)!=0u && Wc.g>0u) || (Ec.r==T_BEANSTALK && (Ec.g&7u)==0u && (Ec.g&8u)==0u && Ec.g>0u)){ if(r<0.5){ o=mk(T_LEAF,0u,wp); return; } }
      if(N.r==T_FUNGUS && r<0.002){ o=mk(T_SPORE,80u+uint(r2*100.0),wp); return; }
      if(S.r==T_LAVA && r<0.003){ o=mk(T_SPARK,5u+uint(r2*10.0),wp); return; }
      if(N.r==T_EMBER && r<0.01){ o=mk(T_SPARK,8u,wp); return; }
      if(S.r==T_WISP && r<0.03){ o=mk(T_SPARK,6u,wp); return; }
      return; }
    case T_FIRE: {
      if(waterN){ o=mk(T_STEAM,30u,wp); return; }
      if(life<=1u){ if(r<0.1 && isSolid(S.r)) o=mk(T_ASH,0u,wp); else if(r<0.35) o=mk(T_SMOKE,20u,wp); else o=mk(T_EMPTY,0u,wp); return; }
      o.g=life-1u; return; }
    case T_SMOKE: case T_DUST: case T_SPARK: {
      if(t==T_DUST && r<0.3) life=life>1u?life-1u:1u;
      if(life<=1u){ o=mk(T_EMPTY,0u,wp); return; } o.g=life-1u; return; }
    case T_SPORE: {
      if(hotN){ o=mk(T_FIRE,4u,wp); return; }
      if(r<0.02){ if(life<=1u){ o=mk(T_EMPTY,0u,wp); return; } o.g=life-1u; } return; }
    case T_STEAM: {
      if(wp.y<48 && r<0.02 && (N.r==T_CLOUD||Wc.r==T_CLOUD||Ec.r==T_CLOUD||r2<0.2)){ o=mk(T_CLOUD,0u,wp); return; }
      if(T<45.0 && r<0.08){ o=mk(r2<0.4?T_WATER:T_EMPTY,0u,wp); return; }
      uint dec = (blocksFluid(N.r)&&!isGas(N.r)) ? 4u : 1u;
      if(life<=dec){ o=mk(r2<0.35?T_WATER:T_EMPTY,0u,wp); return; } o.g=life-dec; return; }
    case T_WATER: {
      if(N.r==T_LAVA||S.r==T_LAVA||Wc.r==T_LAVA||Ec.r==T_LAVA){ o=mk(T_STEAM,80u,wp); return; }
      if(T>100.0 && r<0.25){ o=mk(T_STEAM,70u+uint(r2*50.0),wp); return; }
      if(T<-3.0 && (N.r==T_ICE||S.r==T_ICE||Wc.r==T_ICE||Ec.r==T_ICE||r<0.01) && r2<0.3){ o=mk(T_ICE,0u,wp); return; }
      if(N.r==T_EMPTY && r<0.00012){ o=mk(T_EMPTY,0u,wp); return; }
      return; }
    case T_LAVA: {
      if((N.r==T_WATER||S.r==T_WATER||Wc.r==T_WATER||Ec.r==T_WATER||N.r==T_ICE||N.r==T_SNOW) && r<0.45){ o=mk(T_OBSIDIAN,0u,wp); return; }
      if(T<420.0 && r<0.05){ o=mk(T_STONE,0u,wp); return; }
      return; }
    case T_ACID: {
      bool d=dissolvable(N.r)||dissolvable(S.r)||dissolvable(Wc.r)||dissolvable(Ec.r);
      if(d && r<0.03){ o=mk(T_SMOKE,15u,wp); return; }
      return; }
    case T_ICE: { if(T>3.0 && r<0.08){ o=mk(T_WATER,0u,wp); } return; }
    case T_SNOW: { if((T>2.0 && r<0.08)||waterN){ o=mk(T_WATER,0u,wp); } return; }
    case T_DIRT: {
      if(N.r==T_EMPTY && r<0.002 && float(wp.y)<surf+3.0){ o=mk(T_GRASS,0u,wp); return; }
      if(waterN && r<0.01){ o=mk(T_MUD,0u,wp); return; }
      bool below=blocksFluid(S.r)||isEnt(S.r); bool left=blocksFluid(Wc.r), right=blocksFluid(Ec.r);
      if(!below && (!left||!right) && r<0.5){ o=mk(T_CLOD,0u,wp); return; }   // crumbles when unsupported
      return; }
    case T_CLOD: { if(blocksFluid(S.r) && !isPowder(S.r) && r<0.01){ o=mk(T_DIRT,0u,wp); } else if(S.r==T_CLOD && r<0.004){ o=mk(T_DIRT,0u,wp); } return; }
    case T_MUD: { if(!waterN && r<0.0015){ o=mk(T_DIRT,0u,wp); } return; }
    case T_GRASS: { if(!(S.r==T_DIRT||S.r==T_GRASS||S.r==T_MUD||S.r==T_STONE||S.r==T_BEDROCK||S.r==T_CLOD)){ o=mk(T_SEED,0u,wp); } return; }
    case T_SEED: { if(waterN){ o=mk(T_BEANSTALK,45u+uint(r2*40.0),wp); return; } if((S.r==T_DIRT||S.r==T_GRASS||S.r==T_MUD)&&N.r==T_EMPTY&&r<0.0005){ o=mk(T_WOOD,0u,wp); } return; }
    case T_VINE: { if(!supportsVine(N.r)){ o=mk(T_EMPTY,0u,wp); return; } if(life>0u && S.r==T_EMPTY && rnd(wp,9u)<0.04) o.g=0u; return; }
    case T_BEANSTALK: { if(life>0u && (N.r==T_EMPTY||isGas(N.r)||N.r==T_LEAF) && rnd(wp,9u)<0.35) o.g=0u; if(S.r==T_EMPTY && r<0.02) o=mk(T_EMPTY,0u,wp); return; }
    case T_STONE: {
      if(r>0.25) return;
      bool sl=blocksFluid(Wc.r), sr=blocksFluid(Ec.r), sa=blocksFluid(N.r), sb=blocksFluid(S.r)||isEnt(S.r);
      if(!sl&&!sr&&!sa&&!sb){ o=mk(T_RUBBLE,0u,wp); return; }
      return; }
    case T_RUBBLE: { if(blocksFluid(S.r)&&!isPowder(S.r)&&r<0.002){ o=mk(T_STONE,0u,wp); } return; }
    case T_GEYSER: { o.g=(life+1u)&255u; return; }
    case T_CLOUD: { if(r<0.00012 && N.r!=T_CLOUD){ o=mk(T_EMPTY,0u,wp); } return; }
    case T_EMBER: { if(waterN||life<=1u){ o=mk(T_ASH,0u,wp); return; } o.g=life-1u; return; }
    case T_TORCH: { if(N.r==T_WATER){ o=mk(T_WOOD,0u,wp); } return; }
    case T_FUNGUS: { if(S.r==T_EMPTY){ o=mk(T_SEED,0u,wp); } return; }
    case T_SAND: { if((N.r==T_LAVA||S.r==T_LAVA||Wc.r==T_LAVA||Ec.r==T_LAVA||T>900.0) && r<0.05){ o=mk(T_GLASS,0u,wp); } return; }
    case T_GLASS: { if(T>1000.0 && r<0.02){ o=mk(T_LAVA,0u,wp); } return; }
    case T_WOOD: { if(life>0u && N.r==T_EMPTY && r<0.08){ o.g=0u; } return; }
    default: {
      if(dissolvable(t) && (N.r==T_ACID||S.r==T_ACID||Wc.r==T_ACID||Ec.r==T_ACID) && r<0.08){ o=mk(T_SMOKE,12u,wp); return; }
      return; }
  }
}`;

// ---------------- movement: Margolus 2x2 block automaton ----------------
SH.move = SH.header + `
uniform sampler2D uFld; uniform ivec2 uPhase;
out uvec4 o;
bool inWin(ivec2 p){ return p.x>=0&&p.y>=0&&p.x<uWinSize.x&&p.y<uWinSize.y; }
vec2 velAt(ivec2 wp){ ivec2 p=wp-uWin; return inWin(p)? texelFetch(uFld,p,0).xy : vec2(0.0); }
bool canSinkInto(uint me,uint o){ if(o==T_EMPTY) return true; uint f=flagsOf(o); if((f&F_SOLID)!=0u && (f&F_POWDER)==0u) return false; if((f&F_GAS)!=0u) return true; return densOf(o)<densOf(me); }
bool gasCanEnter(uint o){ if(o==T_EMPTY) return true; uint f=flagsOf(o); return (f&(F_GAS|F_LIQUID))!=0u; }
bool faller(uint t){ uint f=flagsOf(t); return (f&(F_POWDER|F_LIQUID))!=0u; }
float viscosity(uint t){ return t==T_HONEY?0.12 : t==T_LAVA?0.35 : t==T_SLIME?0.3 : t==T_MUD?0.25 : 1.0; }
uvec4 C[4]; bool mv[4]; vec2 V[4];
void sw(int i,int j){ uvec4 tmp=C[i]; C[i]=C[j]; C[j]=tmp; mv[i]=true; mv[j]=true; }
void main(){
  ivec2 wp=ivec2(gl_FragCoord.xy);
  ivec2 bo=wp-((wp-uPhase)&1);        // block origin (top-left)
  int li=(wp.x-bo.x)+(wp.y-bo.y)*2;   // my index: 0 TL, 1 TR, 2 BL, 3 BR
  C[0]=cellAt(bo); C[1]=cellAt(bo+ivec2(1,0)); C[2]=cellAt(bo+ivec2(0,1)); C[3]=cellAt(bo+ivec2(1,1));
  V[0]=velAt(bo); V[1]=velAt(bo+ivec2(1,0)); V[2]=velAt(bo+ivec2(0,1)); V[3]=velAt(bo+ivec2(1,1));
  mv[0]=false; mv[1]=false; mv[2]=false; mv[3]=false;
  float r0=rnd(bo,11u), r1=rnd(bo,12u), r2=rnd(bo,13u), r3=rnd(bo,14u);
  // ---- gravity: top over bottom, both columns (random order) ----
  int c0 = r0<0.5?0:1;
  for(int k=0;k<2;k++){
    int top=(c0+k)&1; int bot=top+2;
    uint tt=C[top].r, tb=C[bot].r;
    if(!mv[top]&&!mv[bot]){
      if(faller(tt) && canSinkInto(tt,tb)){
        float pr=1.0; if(isLiquid(tb)&&isPowder(tt)) pr=0.5; if(tt==T_SNOW) pr=0.45; if(isLiquid(tt)) pr*=max(viscosity(tt),0.5);
        if(r1<pr) sw(top,bot);
      } else if(isGas(tb) && gasCanEnter(tt) && !isGas(tt)){
        float pr=(tt==T_EMPTY)?0.7:0.4; if(tb==T_FIRE) pr*=0.6;
        if(r2<pr) sw(top,bot);
      } else if(isGas(tb)&&isGas(tt)&&tb!=tt&&r3<0.2) sw(top,bot);
    }
  }
  // ---- diagonal slides (TL->BR, TR->BL) and gas diagonals ----
  if(!mv[0]&&!mv[3]&&faller(C[0].r)&&!canSinkInto(C[0].r,C[2].r)&&canSinkInto(C[0].r,C[3].r)&&!isSolid(C[1].r)){ float pr=isLiquid(C[0].r)?0.8*viscosity(C[0].r):0.45; if(C[0].r==T_CLOD) pr=0.25; if(r2<pr) sw(0,3); }
  if(!mv[1]&&!mv[2]&&faller(C[1].r)&&!canSinkInto(C[1].r,C[3].r)&&canSinkInto(C[1].r,C[2].r)&&!isSolid(C[0].r)){ float pr=isLiquid(C[1].r)?0.8*viscosity(C[1].r):0.45; if(C[1].r==T_CLOD) pr=0.25; if(r3<pr) sw(1,2); }
  if(!mv[2]&&!mv[1]&&isGas(C[2].r)&&!gasCanEnter(C[0].r)&&gasCanEnter(C[1].r)&&!isGas(C[1].r)&&r1<0.5) sw(2,1);
  if(!mv[3]&&!mv[0]&&isGas(C[3].r)&&!gasCanEnter(C[1].r)&&gasCanEnter(C[0].r)&&!isGas(C[0].r)&&r0<0.5) sw(3,0);
  // ---- horizontal: liquids spread, gases drift, wind pushes powders ----
  for(int row=0;row<2;row++){
    int L=row*2, R=L+1;
    if(mv[L]||mv[R]) continue;
    uint tl=C[L].r, tr=C[R].r;
    float rr = row==0? r3 : r0;
    float wind = (V[L].x+V[R].x)*0.5;   // local fluid velocity
    if(isLiquid(tl) && (tr==T_EMPTY||isGas(tr))){ float pr=0.5*viscosity(tl)+clamp(wind*6.0,-0.45,0.45); if(rr<pr) sw(L,R); }
    else if(isLiquid(tr) && (tl==T_EMPTY||isGas(tl))){ float pr=0.5*viscosity(tr)-clamp(wind*6.0,-0.45,0.45); if(rr<pr) sw(L,R); }
    else if(isLiquid(tl)&&isLiquid(tr)&&tl!=tr){ if(rr<0.08) sw(L,R); }
    else if(isGas(tl) && (tr==T_EMPTY)){ float pr=0.25+clamp(wind*8.0,-0.25,0.7); if(rr<pr) sw(L,R); }
    else if(isGas(tr) && (tl==T_EMPTY)){ float pr=0.25-clamp(wind*8.0,-0.7,0.25); if(rr<pr) sw(L,R); }
    else if(isPowder(tl) && tr==T_EMPTY){ float w=V[R].x; if(w>0.05 && rr<(w-0.05)*4.0) sw(L,R); }
    else if(isPowder(tr) && tl==T_EMPTY){ float w=V[L].x; if(w<-0.05 && rr<(-w-0.05)*4.0) sw(L,R); }
  }
  // ---- vertical wind: updrafts lift powders & drag gases, downdrafts push gases down ----
  for(int col=0;col<2;col++){
    int top=col, bot=col+2; if(mv[top]||mv[bot]) continue;
    uint tt=C[top].r, tb=C[bot].r; float rr= col==0? r1 : r2;
    if(isPowder(tb) && tt==T_EMPTY){ float w=V[top].y; if(w<-0.1 && rr<(-w-0.1)*3.0) sw(top,bot); }
    else if(isGas(tt) && tb==T_EMPTY){ float w=V[tt==T_EMPTY?bot:top].y; if(w>0.04 && rr<(w-0.04)*5.0) sw(top,bot); }
    else if(isGas(tb) && tt==T_EMPTY){ float w=V[bot].y; if(w<-0.03 && rr<(-w)*4.0) sw(top,bot); }
  }
  o=C[li];
}`;

// ---------------- scroll the field window ----------------
SH.shift = SH.header + `
uniform sampler2D uFld, uFA, uFB; uniform ivec2 uDelta;
layout(location=0) out vec4 oFld; layout(location=1) out vec4 oFA; layout(location=2) out vec4 oFB;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); ivec2 q=p+uDelta;
  if(q.x>=0&&q.y>=0&&q.x<uWinSize.x&&q.y<uWinSize.y){ oFld=texelFetch(uFld,q,0); oFA=texelFetch(uFA,q,0); oFB=texelFetch(uFB,q,0); }
  else { oFld=vec4(0.0,0.0,20.0,4.0/9.0); oFA=vec4(1.0/9.0); oFB=vec4(1.0/36.0); } }`;

// ---------------- pack fields for CPU readback ----------------
SH.info = SH.header + `
uniform sampler2D uFld; out vec4 o;
void main(){ vec4 f=texelFetch(uFld,ivec2(gl_FragCoord.xy),0); o=vec4(f.x*1.6+0.5, f.y*1.6+0.5, (f.z+100.0)/1600.0, 0.0); }`;

// ---------------- write entity/tool patches as points ----------------
SH.patchVS = `#version 300 es
layout(location=0) in vec2 aPos; layout(location=1) in uvec4 aCell; uniform vec2 uWorldF; flat out uvec4 vCell;
void main(){ vCell=aCell; vec2 ndc=((aPos+0.5)/uWorldF)*2.0-1.0; gl_Position=vec4(ndc,0.0,1.0); gl_PointSize=1.0; }`;
SH.patchFS = `#version 300 es
precision highp float; precision highp int; flat in uvec4 vCell; out uvec4 o; void main(){ o=vCell; }`;

// ---------------- render ----------------
SH.render = SH.header + `
uniform sampler2D uFld, uSurf, uPal;
uniform vec2 uCam; uniform float uCellPx; uniform vec2 uScreen; uniform float uTime; uniform int uDebug; uniform float uPFlags; // player status bits
out vec4 o;
bool inWin(ivec2 p){ return p.x>=0&&p.y>=0&&p.x<uWinSize.x&&p.y<uWinSize.y; }
vec3 hsv(float h,float s,float v){ vec3 k=vec3(1.0,2.0/3.0,1.0/3.0); vec3 p=abs(fract(vec3(h)+k)*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
void main(){
  vec2 cell=uCam+vec2(gl_FragCoord.x,uScreen.y-gl_FragCoord.y)/uCellPx;
  ivec2 wp=ivec2(floor(cell));
  uvec4 c=cellAt(wp); uint t=c.r;
  ivec2 p=wp-uWin; vec4 f=inWin(p)?texelFetch(uFld,p,0):vec4(0.0,0.0,20.0,0.0);
  float surf=texelFetch(uSurf,ivec2(clamp(wp.x,0,uWorld.x-1),0),0).r;
  float depth=float(wp.y)-surf;
  // background
  float sky=clamp(float(wp.y)/float(uWorld.y)*1.6,0.0,1.0);
  vec3 bg=mix(vec3(0.35,0.6,0.92),vec3(0.65,0.8,0.78),sky);
  if(depth>0.0){ float k=max(0.12,1.0-depth/70.0); bg=vec3(0.17,0.14,0.16)*k; }
  if(uDebug==1){ vec2 u=f.xy; float m=length(u); o=vec4(mix(bg*0.3,hsv(atan(u.y,u.x)/6.2832+0.5,1.0,1.0),clamp(m*6.0,0.0,1.0)),1.0); if(blocksFluid(t)) o.rgb=vec3(0.1); return; }
  if(uDebug==2){ float T=f.z; vec3 col= T<20.0? mix(vec3(0.2,0.3,1.0),vec3(0.0),clamp((20.0-T)/60.0,0.0,1.0)) : hsv(0.66-clamp((T-20.0)/1100.0,0.0,1.0)*0.66,1.0,0.3+clamp((T-20.0)/300.0,0.0,0.7)); if(t==T_BEDROCK) col=vec3(0.0); o=vec4(col,1.0); return; }
  if(t==T_EMPTY){ o=vec4(bg,1.0); return; }
  vec4 pal=texelFetch(uPal,ivec2(int(t),0),0);
  float v=(float(c.b)/255.0-0.5)*pal.a;
  vec3 col=pal.rgb+v;
  float life=float(c.g);
  float alpha=1.0;
  switch(t){
    case T_FIRE: { float k=clamp(life/20.0,0.0,1.0); col=vec3(1.0,0.3+k*0.55+float(c.b&31u)/255.0,0.08+k*0.15); alpha=0.85; break; }
    case T_SMOKE: { float k=clamp(life/50.0,0.0,1.0); col=vec3(0.2+k*0.15); alpha=0.45+k*0.4; break; }
    case T_STEAM: { float k=clamp(life/80.0,0.0,1.0); col=vec3(0.75+k*0.2); alpha=0.3+k*0.5; break; }
    case T_DUST: { alpha=0.5; break; }
    case T_SPORE: { float k=clamp(life/80.0,0.0,1.0); col=vec3(0.47+k*0.3,0.3+k*0.25,0.8+k*0.2); alpha=0.8; break; }
    case T_SPARK: { col=vec3(1.0,0.86+float(c.b&31u)/255.0,0.47); break; }
    case T_BLAST: { col=vec3(1.0,0.95,0.8); break; }
    case T_WATER: { float sp=length(f.xy); float w=sin(uTime*3.0+float(wp.x)*0.3+float(wp.y)*0.7+float(c.b))*0.04; col=vec3(0.12,0.41,0.84)+w+sp*2.5; alpha=0.9; break; }
    case T_LAVA: { float pp=sin(uTime*5.0+float(c.b)*0.1)*0.1; col=vec3(0.92+pp*0.3,0.35+pp+float(c.b&15u)/255.0,0.08); break; }
    case T_ACID: { col=vec3(0.55+sin(uTime*6.0+float(c.b))*0.08,0.9,0.27); break; }
    case T_GOLD: { if(((uint(uTime*60.0)+c.b)&63u)<4u) col=vec3(1.0,1.0,0.86); break; }
    case T_FLAG: { if(((wp.x+wp.y)&3)<2) col=vec3(0.98); break; }
    case T_CRYSTAL: { col=vec3(0.67+sin(uTime*4.0+float(c.b))*0.12,0.43,1.0); break; }
    case T_EMBER: { col=vec3(0.78+sin(uTime*9.0+float(c.b))*0.1,0.25+sin(uTime*9.0+float(c.b))*0.15,0.08); break; }
    case T_TORCH: { if(((uint(uTime*15.0)+c.b)&1u)==1u) col+=vec3(0.12,0.08,0.0); break; }
    case T_CLOUD: { col=vec3(0.88+float(c.b&15u)/255.0); alpha=0.9; break; }
    case T_WISP: { col=vec3(1.0,0.55+float(c.b&63u)/255.0,0.2); break; }
    case T_PLAYER: { uint part=c.g; if(part==1u) col=vec3(0.12,0.12,0.16); else if(part==2u) col=vec3(0.27,0.51,0.86); else if(part==3u) col=vec3(0.24,0.24,0.35); else if(part==4u) col=vec3(0.35,0.24,0.16);
      if(uPFlags>=8.0) col=mix(col,vec3(1.0,0.35,0.35),0.7); else { if(mod(uPFlags,2.0)>=1.0) col=mix(col,vec3(0.3,0.5,1.0),0.3); if(mod(uPFlags,4.0)>=2.0) col*=0.6; }
      if(mod(uPFlags,8.0)>=4.0 && ((uint(uTime*20.0)+c.b)&3u)<2u) col=vec3(1.0,0.5+float(c.b&63u)/255.0,0.1); break; }
    case T_PLAYERHEAD: { if(uPFlags>=8.0) col=mix(col,vec3(1.0,0.35,0.35),0.7); if(mod(uPFlags,8.0)>=4.0 && ((uint(uTime*20.0)+c.b)&3u)<2u) col=vec3(1.0,0.55,0.1); break; }
  }
  // hot things glow
  float T=f.z;
  if(T>380.0 && !isGas(t) && t!=T_LAVA){ float g=smoothstep(380.0,1100.0,T); col=mix(col,vec3(1.0,0.35,0.06),g*0.85); }
  // underground darkness (not for glowing things)
  bool emissive = isHot(t)||t==T_CRYSTAL||t==T_GOLD||t==T_SPORE||t==T_ACID||t==T_SLIME||isEnt(t)||t==T_FLAG||t==T_FUNGUS||t==T_BOUNCE||T>380.0;
  if(depth>8.0 && !emissive){ col*=max(0.3,1.0-(depth-8.0)/60.0); }
  col=mix(bg,col,alpha);
  o=vec4(col,1.0);
}`;
