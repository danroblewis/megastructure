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
#define M_ORE 12
#define M_DEAD 13
#define M_ORB 14
uniform sampler2D uMask;   // r type/255, g,b = velocity or direction encoded (v*0.5+0.5), a unused
uniform vec2 uC[3]; uniform int uCN;   // the centres: 0 you, then past lives or the other wisp
uniform sampler2D uQ;      // identity state per cell (see IDENTITY.md): carried with the cell like exposure; meaning set by the identity model
uniform int uIdent;        // which identity model is running (0 = centroid, the baseline)
uniform float uWill, uStray;   // PARAMS.will: intention travels through the matter from the core instead of reaching every cell at once; PARAMS.stray: cells beyond rfar persist instead of withering
uniform vec4 uSpot;            // an attended point in the world: x y strength active (shared by the will injection in the body pass and the steering in bodyVel)
uniform float uRnear, uRfar;   // body radii, shared
uniform float uAuto;           // PARAMS.auto: a part left behind long enough settles into a wisp of its own, with a will and a temperament
uniform float uGrowOther;      // regrowth of every wisp that is not you, capped on the CPU by all of them together
uniform vec4 uSeed;            // x y radius number: for one frame, loose matter of yours inside the circle becomes wisp <number> (radius 0: none)
// ---- identity model hooks: an experiment branch replaces these bodies (keep the signatures) ----
// q is updated once per substep in the body pass. vel is the cell's own velocity, dc its distance to its nearest centre, kk that centre's index,
// sp the species at the cell (x fuel, y heat, z smoke, w organism), drive the intention its centre gave it this substep.
// which centre is nearest among the ones that are not you (1 or 2), or 0 if there are none
int nearestOther(vec2 pp){ int k=0; float bd=1e9; for(int j=1;j<3;j++){ if(j<uCN){ float d=distance(pp,uC[j]); if(d<bd){ bd=d; k=j; } } } return k; }
// the centre a cell belongs to: yours while q.w says so, else the nearest other. ownership has memory (see identUpdate)
int idOf(vec4 q){ return int(floor(q.w+0.5)); }   // q.w is the cell's wisp number: 0 you, 1.. a wisp of its own. numbers never convert each other
int ownerK(vec4 q, vec2 pp){ return idOf(q)==0 ? 0 : -1; }   // the only centre is yours; a wisp of its own has none
uint idHash(int id, uint salt){ uint h=uint(id)*2654435761u+salt*40503u+12345u; h^=h>>13; h*=0x5bd1e995u; h^=h>>15; return h; }
vec3 idHue(int id){ float hh=float(idHash(id,1u)&1023u)/1024.0; vec3 c=clamp(abs(fract(vec3(hh)+vec3(0.0,0.667,0.333))*6.0-3.0)-1.0,0.0,1.0); return mix(vec3(1.0),c,0.55); }   // a pale hue of its own

vec4 identUpdate(vec4 q, float self, vec2 vel, float dc, int kk, vec4 sp, vec2 drive, ivec2 p){
  // q.w the cell's wisp number (0 you); for yours, q.xy the point it has heard it should go to and q.z how connected it is to your core.
  // dc is the distance to your centre, drive your plain drive (uDirs[0]).
  if(uWill<0.5){ q.xy=mix(q.xy,vel*8.0,0.03); q.z=mix(q.z,1.0,0.005); return q; }
  int id=idOf(q); vec2 pp=vec2(p)+0.5;
  if(id>0){ // a wisp of its own hears no will: its cells each feel an appetite (bodyVel). but it has a body: a connection spreads from its dense
    // cells through matter of the same number (q.z), and a fragment that stays out of reach of any dense core for four seconds becomes a
    // wisp of its own with a fresh number (q.x counts the orphaned substeps). that is how they split by accident and make new ones.
    float z=q.z*0.985; float best=0.0;
    for(int k=0;k<4;k++){ ivec2 n=clamp(p+ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0),ivec2(0),uRes-1); vec4 qn=texelFetch(uQ,n,0); if(idOf(qn)==id) best=max(best,qn.z); }
    z=max(z,best*0.97); if(self>0.5) z=1.0;
    float orphan= z<0.1? q.x+1.0 : 0.0;
    if(uAuto>0.5 && orphan>600.0){ q.w=float(1000+int(idHash(id,uFrame/600u)%900u)); orphan=0.0; }   // every orphan of this number in the same ten-second window takes the same new number, so a fragment leaves as one
    q.x=orphan; q.y=0.0; q.z=z; return q; }
  // the will: intention enters only at your core (within half rnear of your centre) and travels cell to cell through your own
  // matter, a hop every few substeps with a little lost per hop; it fades where nothing renews it. you are whatever the will reaches.
  float z=q.z*0.985; float best=0.0; vec2 bg=q.xy; int grab=0;
  for(int k=0;k<4;k++){ ivec2 n=clamp(p+ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0),ivec2(0),uRes-1); vec4 qn=texelFetch(uQ,n,0); int idn=idOf(qn); if(idn==0){ if(qn.z>best){ best=qn.z; bg=qn.xy; } } else grab=idn; }
  uint h=uint(p.x)*1664525u+uint(p.y)*1013904223u+uFrame*69069u; h^=h>>13; h*=0x5bd1e995u; h^=h>>15;
  if((h&3u)==0u && best*0.985>z){ z=best*0.985; q.xy=bg; }
  float core=1.0-smoothstep(uRnear*0.5,uRnear,dc);
  if(core>0.0){ z=max(z,core); float dl=length(drive); if(uSpot.w>0.0) q.xy=mix(q.xy,uSpot.xy,core); else if(dl>0.05) q.xy=mix(q.xy,uC[0]+drive/dl*40.0,core); }   // what the core hears: your attended point, or a plain direction (keys, the lab, the bot) as a point forty cells that way
  // loose matter (yours, out of the will's reach) is gathered: by a wisp whose cells touch it, or by a seed that makes a new wisp of it
  if(uAuto>0.5 && z<0.1){ if(grab>0 && (h&15u)<3u){ q=vec4(0.0,0.0,0.0,float(grab)); return q; }
    if(uSeed.z>0.0 && distance(pp,uSeed.xy)<uSeed.z){ q=vec4(0.0,0.0,0.0,uSeed.w); return q; } }
  q.z=z; q.w=0.0; return q; }
// how strongly this cell belongs to centre k (0..1). the baseline is its owner, hard.
float identWeight(int k, int nearestK, vec4 q, vec2 pp){ if(k!=0 || idOf(q)!=0) return 0.0; return uWill>0.5? smoothstep(0.03,0.2,q.z) : 1.0; }   // with the will on, only matter the will reaches counts as you: strays do not move the centroid or the camera
// the drive a cell actually follows, given the drive of its centre
vec2 identDrive(int ki, vec4 q, vec2 drive, float self){ return drive; }
// the cohesion a cell actually feels, given the gradient climb and homing computed for it
vec2 identCohere(vec4 q, vec2 coh, float self){ return coh; }
// how a cell is tinted for display, given the colour it would have
vec3 identTint(vec4 q, vec3 bc, float self){ return bc; }
ivec2 wrapP(ivec2 p){ return clamp(p,ivec2(0),uRes-1); }
vec4 maskAt(ivec2 p){ if(p.x<0||p.y<0||p.x>=uRes.x||p.y>=uRes.y) return vec4(1.0/255.0,0.5,0.5,0.0); return texelFetch(uMask,p,0); }
int mtype(vec4 m){ return int(m.r*255.0+0.5); }
uniform sampler2D uWf;     // walls field: solidity, soot, residue, kind (0 metal, 0.5 frost, 1 tissue)
bool hardT(int t){ return t==M_MOVING||t==M_BURNER||t==M_COOLER||t==M_FUEL||t==M_SPORE||t==M_ORE||t==M_DEAD; }
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
uniform vec2 uDir; uniform float uPush; uniform vec2 uDirs[3]; uniform float uRadial;
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
uniform sampler2D uS, uFC, uDye, uB, uSrc, uLight;   // uSrc: baked source influence (burner, cooler, fuel, spore); uLight: the glow of bodies, which the organism hunts by
uniform float uAdv, uIgn, uBurnRate, uCool, uLifeF, uLifeK, uDiff, uHunt;   // uHunt: PARAMS.hunt, the organism's starvation inside your light relative to the dark
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
  float glow=0.0;
  { // the organism hunts: up the gradient of self when it is touching you, and from further away up the gradient of your glow (the light grid)
    float sl=texelFetch(uB,wrapP(p-ivec2(2,0)),0).x, sr=texelFetch(uB,wrapP(p+ivec2(2,0)),0).x, su=texelFetch(uB,wrapP(p-ivec2(0,2)),0).x, sd=texelFetch(uB,wrapP(p+ivec2(0,2)),0).x;
    vec2 gs=vec2(sr-sl,sd-su);
    vec2 lc=(vec2(p)+0.5)/vec2(uRes), e=3.0/vec2(uRes); glow=texture(uLight,lc).r;
    vec2 gL=vec2(texture(uLight,lc+vec2(e.x,0.0)).r-texture(uLight,lc-vec2(e.x,0.0)).r, texture(uLight,lc+vec2(0.0,e.y)).r-texture(uLight,lc-vec2(0.0,e.y)).r);
    vec2 g= length(gs)>0.002? gs*6.0 : gL*40.0; float gl=length(g);
    if(gl>0.002){ vec2 drift=g/gl*min(0.25,gl); float Lw=sampleS(back-drift).w; s.w=max(s.w,Lw); } }
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
  if(src.a>0.0){ s.w=max(s.w,0.5); s.x=min(1.0,s.x+0.12); }   // enough fuel that every spore strip keeps a living colony, not just the ones beside a fuel panel
  // combustion
  float burn=s.x*smoothstep(uIgn,uIgn+0.25,s.y)*uBurnRate;
  s.x-=burn; s.y+=burn*2.2; s.z+=burn*1.5;
  // organism: eats fuel (Gray-Scott style), dies in heat
  float L=s.w, Fu=s.x;
  float growth=L*L*Fu;
  s.w+=growth*uLifeF - L*uLifeK*0.5*mix(1.0,uHunt,min(1.0,glow*4.0));   // starvation, eased inside your light by the hunt dial
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
uniform sampler2D uB, uFC, uS, uLight;
uniform vec2 uDir, uCentroid; uniform float uAdv, uSwim, uCoh;
uniform vec2 uDirs[3];
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
// self n cells along d, or this cell's own value if a wall lies on the way (so gradients never pull across a wall)
float selfThru(ivec2 p, ivec2 d, int n, float h0, int id){ for(int k=1;k<=n;k++){ ivec2 q=p+d*k; if(q.x<0||q.y<0||q.x>=uRes.x||q.y>=uRes.y) return 0.0; if(solidAt(q)) return h0; } ivec2 q=p+d*n; return idOf(texelFetch(uQ,q,0))==id? texelFetch(uB,q,0).x : 0.0; }   // cohesion is per wisp: another wisp's matter reads as empty
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); int t=mtype(maskAt(p));
  if(solidAt(p)){ o=vec4(0.0); return; }
  vec2 u=texelFetch(uFC,p,0).zw;
  // the gradient does not see through walls: a tap whose line crosses solid reads as this cell, so two halves split by a thin girder do not cling to each other across it
  float h0=texelFetch(uB,p,0).x; vec4 qme=texelFetch(uQ,p,0); int idc=idOf(qme);
  float gx=(selfThru(p,ivec2(1,0),1,h0,idc)-selfThru(p,ivec2(-1,0),1,h0,idc))*0.5+(selfThru(p,ivec2(1,0),3,h0,idc)-selfThru(p,ivec2(-1,0),3,h0,idc))/6.0;
  float gy=(selfThru(p,ivec2(0,1),1,h0,idc)-selfThru(p,ivec2(0,-1),1,h0,idc))*0.5+(selfThru(p,ivec2(0,1),3,h0,idc)-selfThru(p,ivec2(0,-1),3,h0,idc))/6.0;
  // cohesion toward denser matter while below the preferred density; repulsion once over it
  float here=texelFetch(uB,p,0).x;
  float calm=calmAt(p);
  float shear=0.0; { vec2 u0=u; for(int k=0;k<4;k++){ ivec2 q=wrapP(p+ivec2(k==0?3:k==1?-3:0,k==2?3:k==3?-3:0)); shear=max(shear,length(texelFetch(uFC,q,0).zw-u0)); } }
  float hold=1.0-0.5*smoothstep(0.16,0.32,shear);
  vec2 g=vec2(gx,gy)*uCoh*(1.0+1.5*calm)*(uDense-here)/uDense*hold; float gl=length(g); if(gl>0.09) g*=0.09/gl;
  vec2 toC=nearestC(vec2(p)+0.5)-(vec2(p)+0.5); float dc=length(toC); vec2 home= dc>uRnear? toC/dc*min(0.08,(dc-uRnear)*0.01): vec2(0.0);
  // no homing through a wall: if the straight line to the centre crosses solid, this cell only follows its local gradient
  if(dc>uRnear){ for(int k=1;k<=6;k++){ vec2 q=vec2(p)+0.5+toC*(float(k)/6.0); if(solidAt(ivec2(floor(q)))){ home=vec2(0.0); break; } } }
  if(uStray>0.5 && dc>uRfar) home=vec2(0.0);   // a part left behind does not crawl back across rooms on its own; you go and get it
  if(idc>0) home=vec2(0.0);   // a wisp of its own has no centre to home to
  home*=max(0.0,1.0-here);
  int ki=ownerK(qme,vec2(p)+0.5);
  vec2 drive= ki==0? uDirs[0] : vec2(0.0);
  if(uWill>0.5 && ki==0){ vec4 qw=texelFetch(uQ,p,0); vec2 to=qw.xy-(vec2(p)+0.5); float dl=length(to);   // each cell steers toward the point it has heard of, as strongly as it is connected; a cell that has heard nothing waits
    float str= uSpot.w>0.0? uSpot.z : min(1.0,length(uDirs[0]));   // how hard: the pad's strength, or the plain direction's
    drive= (str>0.01 && qw.z>0.02 && dl>0.5)? to/dl*str*min(1.0,qw.z*1.5)*smoothstep(1.5,9.0,dl) : vec2(0.0); }
  else if(ki==0 && uSpot.w>0.0){ vec2 to=uSpot.xy-(vec2(p)+0.5); float dl=length(to); drive= dl>0.5? to/dl*uSpot.z*smoothstep(1.5,9.0,dl) : vec2(0.0); }   // every cell its own angle; cells that arrive settle
  float jet=1.0+uJet*smoothstep(0.10,0.20,length(u));
  vec2 carry=u*uAdv*jet; if(ki==0) carry=carry*uGrip+uIVel*uInertia*0.92; else carry=carry*uGrip;
  vec2 coh=g+home; float dl=length(drive); if(dl>0.05){ vec2 dd=drive/dl; float along=dot(coh,dd); if(along<0.0) coh-=along*dd*0.85; }   // cohesion does not fight locomotion
  float pw=clamp(-texelFetch(uB,p,0).w/max(0.02,here),0.0,1.0);   // power charge fraction of this cell
  vec4 qq=texelFetch(uQ,p,0); drive=identDrive(ki,qq,drive,here); coh=identCohere(qq,coh,here);   // identity model hooks
  float hurtC=texelFetch(uB,p,0).z;   // hurt matter answers weakly: a red part lags, and in a current it is the part you lose unless you heal it
  vec2 v=carry*(1.0-0.7*pw)+drive*uSwim*(1.0+1.6*pw)*(1.0-0.6*hurtC)+coh;
  if(idc>0 && uAuto>0.5){ // a wisp of its own: its will is an appetite every cell feels, drawn from its number, so each wisp is a different creature
    vec4 sl=texelFetch(uS,wrapP(p-ivec2(3,0)),0), sr=texelFetch(uS,wrapP(p+ivec2(3,0)),0), su=texelFetch(uS,wrapP(p-ivec2(0,3)),0), sd=texelFetch(uS,wrapP(p+ivec2(0,3)),0);
    vec2 gh=vec2(sr.y-sl.y,sd.y-su.y), gf=vec2(sr.x-sl.x,sd.x-su.x);
    vec2 lc=(vec2(p)+0.5)/vec2(uRes), e=3.0/vec2(uRes); vec2 gL=vec2(texture(uLight,lc+vec2(e.x,0.0)).r-texture(uLight,lc-vec2(e.x,0.0)).r, texture(uLight,lc+vec2(0.0,e.y)).r-texture(uLight,lc-vec2(0.0,e.y)).r);
    float wHeat=float(idHash(idc,2u)&255u)/127.5-1.0, wFuel=float(idHash(idc,3u)&255u)/127.5-1.0, wLight=float(idHash(idc,4u)&255u)/127.5-1.0, wFlow=float(idHash(idc,5u)&255u)/255.0;
    vec2 ga=gh*wHeat+gf*wFuel+gL*40.0*wLight; { float hot=texelFetch(uS,p,0).y; if(hot>0.3) ga=-gh*4.0; }   // whatever its appetite, once the air is hot enough to burn it, it flees the heat: a survival instinct
    float gl2=length(ga);
    float a=float((idHash(idc,7u)+uFrame/90u*2654435761u)&1023u)/1024.0*6.2832; vec2 want=ga/(gl2+0.0006)+vec2(cos(a),sin(a))*0.35; float wl=length(want); if(wl>1.0) want/=wl;   // a smooth blend of what it smells and a slow wander, so it never dithers
    want*=clamp(1.3-h0,0.0,1.0);   // a cell already packed tight stops pushing, so a wisp cannot crush itself against a wall or its own core (mass above the density clamp is lost)
    v+=want*uSwim*0.9*(1.0-0.6*hurtC)+u*wFlow*0.4;   // some ride the currents more than others
    { // homing without a centre: the connection field (q.z) rises toward the wisp's dense core, so each cell climbs it, more the further out it is. this is what keeps a moving wisp whole
      float zc=qme.z; float zl=0.0,zr=0.0,zu=0.0,zd=0.0; ivec2 ql=clamp(p-ivec2(2,0),ivec2(0),uRes-1), qr=clamp(p+ivec2(2,0),ivec2(0),uRes-1), qu=clamp(p-ivec2(0,2),ivec2(0),uRes-1), qd=clamp(p+ivec2(0,2),ivec2(0),uRes-1);
      vec4 a=texelFetch(uQ,ql,0); if(idOf(a)==idc) zl=a.z; a=texelFetch(uQ,qr,0); if(idOf(a)==idc) zr=a.z; a=texelFetch(uQ,qu,0); if(idOf(a)==idc) zu=a.z; a=texelFetch(uQ,qd,0); if(idOf(a)==idc) zd=a.z;
      vec2 gz=vec2(zr-zl,zd-zu); float gl3=length(gz); if(gl3>0.001) v+=gz/gl3*0.08*(1.0-0.6*zc)*max(0.0,1.0-h0); }   // and eases off as the cell gets dense, as your homing does, so a small wisp does not crush itself onto its core (mass above the density clamp is lost)
    { vec2 nrm=vec2(0.0); if(solidAt(p+ivec2(1,0))) nrm.x+=1.0; if(solidAt(p-ivec2(1,0))) nrm.x-=1.0; if(solidAt(p+ivec2(0,1))) nrm.y+=1.0; if(solidAt(p-ivec2(0,1))) nrm.y-=1.0;
      float nl=length(nrm); if(nl>0.0){ nrm/=nl; float vn=dot(v,nrm); if(vn>0.0){ v-=vn*nrm; float sgn=(idHash(idc,9u)&1u)==0u?1.0:-1.0; v+=vec2(-nrm.y,nrm.x)*sgn*0.5*uSwim; } } } }   // it slides along a wall instead of smearing itself on it, and when pushed into one it crawls along it (each wisp its own way round), so none stays pinned
  if(ki==0 && (abs(uApp.x)+abs(uApp.y)+abs(uApp.z))>0.0){ // chase chemistry
    vec4 sl=texelFetch(uS,wrapP(p-ivec2(3,0)),0), sr=texelFetch(uS,wrapP(p+ivec2(3,0)),0), su=texelFetch(uS,wrapP(p-ivec2(0,3)),0), sd=texelFetch(uS,wrapP(p+ivec2(0,3)),0);
    vec2 gh=vec2(sr.y-sl.y,sd.y-su.y), gf=vec2(sr.x-sl.x,sd.x-su.x), gc=-gh;
    float side=1.0; if(uSplitApp>0.0){ side= dot(vec2(p)+0.5-uC[0],uSplitAxis)>=0.0?1.0:-1.0; }
    vec3 app=uApp*mix(1.0,side,uSplitApp);
    vec2 ga=gh*app.x+gf*app.y+gc*app.z; float gl2=length(ga); if(gl2>0.0003) v+=ga/gl2*min(0.45,0.12+gl2*8.0); else { float a=float(hashu(uvec3(uFrame/40u,7u,3u))&1023u)/1024.0*6.2832; v+=vec2(cos(a),sin(a))*0.1; }
  }
  if(ki==0 && uSplitStr>0.0){ // differentiate: matter sorts itself by what it has lived through — warm-remembering cells toward heat, the rest toward cold
    float ex=texelFetch(uB,p,0).z; float side= ex>0.5?1.0:-1.0;
    vec4 sl=texelFetch(uS,wrapP(p-ivec2(3,0)),0), sr=texelFetch(uS,wrapP(p+ivec2(3,0)),0), su=texelFetch(uS,wrapP(p-ivec2(0,3)),0), sd=texelFetch(uS,wrapP(p+ivec2(0,3)),0);
    vec2 gh=vec2(sr.y-sl.y,sd.y-su.y); float gl3=length(gh); vec2 away=vec2(p)+0.5-uC[0]; float al=length(away);
    vec2 dirv= gl3>0.0005? gh/gl3*side : (al>0.5? away/al*side : vec2(0.0));
    v+=dirv*uSplitStr; }
  if(ki==0 && uSplitStr<0.0){ vec2 toC=uC[0]-(vec2(p)+0.5); float tl=length(toC); if(tl>1.0) v+=toC/tl*(-uSplitStr); }   // integrate: all of it is one
  if(ki==0){ // stick: press into a wall and the cells touching it hold on, but they slide along it rather than freeze
    vec2 nrm=vec2(0.0); float press=0.0;
    if(solidAt(p+ivec2(1,0))){ nrm.x+=1.0; press=max(press,drive.x); } if(solidAt(p-ivec2(1,0))){ nrm.x-=1.0; press=max(press,-drive.x); }
    if(solidAt(p+ivec2(0,1))){ nrm.y+=1.0; press=max(press,drive.y); } if(solidAt(p-ivec2(0,1))){ nrm.y-=1.0; press=max(press,-drive.y); }
    if(press>0.2){ float k=min(1.0,(press-0.2)/0.4); float nl=length(nrm); if(nl>0.0){ nrm/=nl; float vn=dot(v,nrm); if(vn>0.0) v-=vn*nrm*k; }   // the part of the motion into the wall is taken away
      v*=mix(1.0,0.4,k); } }   // what is left is held to 40%: enough grip to resist a current, not enough to pin you
  float sp=length(v); if(sp>0.45) v*=0.45/sp;
  o=vec4(v,0.0,0.0);
}`;
// pass 2: conservative flux transport, then growth / withering / damage / injection
SH.body = SH.head + `
uniform sampler2D uB, uBV, uS, uFC;
uniform vec2 uCentroid; uniform float uGrow, uDroneR;
uniform vec2 uDirs[3];
vec2 nearestD(vec2 pp){ float bd=distance(pp,uC[0]); float bi=0.0; for(int j=1;j<3;j++){ if(j<uCN){ float d=distance(pp,uC[j]); if(d<bd){ bd=d; bi=float(j); } } } return vec2(bd,bi); }
uniform vec4 uInjectB;              // x y radius amount
uniform vec2 uDrones[16]; uniform int uNDrones;
uniform vec4 uAlcove;               // x0 y0 x1 y1 of a dead alcove being repaired (zeros: none)
uniform vec4 uPick;                 // x y radius charge of a power pickup being taken (radius 0: none)
uniform float uPayInit;             // test hook: payload given to injected cells
layout(location=0) out vec4 o; layout(location=1) out vec4 oq;
bool fluidAt(ivec2 q){ return !solidAt(q); }
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy); int t=mtype(maskAt(p));
  if(t==M_MOVING){ vec4 bb=texelFetch(uB,p,0); o=vec4(bb.x*0.9,bb.x*0.1,bb.z,bb.w*0.9); oq=texelFetch(uQ,p,0); return; }   // a blade wears at what it sweeps through; it does not erase it
  if(solidAt(p)||t==M_DRAIN){ o=vec4(0.0); oq=vec4(0.0); return; }
  float self=texelFetch(uB,p,0).x; float s0=self;
  // payload: what these cells carry. positive is resource (ore) to deposit in a dead alcove, negative is a power charge.
  // it moves with the cells (same upwind flux and exchange as self), so it cannot spread across the self, and it dies with them.
  float pay=texelFetch(uB,p,0).w; float w0=pay; bool ore=false;
  vec2 v0=texelFetch(uBV,p,0).xy;
  const ivec2 E4[4]=ivec2[4](ivec2(1,0),ivec2(-1,0),ivec2(0,1),ivec2(0,-1));
  for(int k=0;k<4;k++){ ivec2 q=p+E4[k]; if(!fluidAt(q)) continue;
    float sq=texelFetch(uB,q,0).x; vec2 vq=texelFetch(uBV,q,0).xy;
    float vf=dot(0.5*(v0+vq),vec2(E4[k]));          // velocity across the face, positive = leaving p
    float flux= vf>0.0? vf*s0 : vf*sq;                // upwind
    self-=flux;
    self+=0.03*(sq-s0);                               // symmetric exchange: conservative diffusion
    float wq=texelFetch(uB,q,0).w; pay-= vf>0.0? vf*w0 : vf*wq; pay+=0.03*(wq-w0);
  }
  // near ore: any ore cell within a 9x9 window (the attention point lets cells settle a few cells short of a bar, so reach must be generous)
  for(int dy=-4;dy<=4&&!ore;dy++) for(int dx=-4;dx<=4;dx++){ if(mtype(maskAt(p+ivec2(dx,dy)))==M_ORE){ ore=true; break; } }
  float st=max(self,0.0);
  vec2 nd=nearestD(vec2(p)+0.5); int kkNear=int(nd.y+0.5); vec4 q0=texelFetch(uQ,p,0); int kk= s0<=0.003? kkNear : ownerK(q0,vec2(p)+0.5); bool ghost=kk<0; if(kk<0) kk=0; float dc=distance(vec2(p)+0.5,uC[0]);   // ghost: a wisp of its own (not you)
  float avg=0.0; float nn=0.0; for(int k=0;k<4;k++){ ivec2 q=p+E4[k]; if(fluidAt(q)){ avg+=texelFetch(uB,q,0).x; nn+=1.0; } } if(nn>0.0) avg/=nn;
  vec4 sp=texelFetch(uS,p,0);
  float before=self;
  { float calm=smoothstep(0.08,0.35,-sp.y)*(1.0-smoothstep(0.01,0.04,length(texelFetch(uFC,p,0).zw)));
    if(ghost) self+=uGrowOther*(1.0+2.5*calm)*avg*max(0.0,1.0-self);                 // a wisp of its own keeps itself together wherever it is
    else if(dc>uRfar){ if(uStray<0.5) self*=0.988; else self+=uGrow*0.5*(1.0+2.5*calm)*avg*max(0.0,1.0-self); }   // stragglers wither in seconds, unless parts may be left behind: then a pile keeps itself together at half your rate (within your cap), instead of evaporating at its edges
    else if(dc<uRnear) self+=uGrow*(1.0+2.5*calm)*avg*max(0.0,1.0-self); }            // close cells reinforce; cold still pockets condense you
  self*= (uStray>0.5 && !ghost && dc>uRfar)? 0.99995 : ghost? 0.9998 : 0.9995;   // a wisp of its own burns slower than you: it has no cold rooms of its own to count on   // metabolism: the connected body pays it back by regrowing near the core; a part left behind cannot, so it pays a twentieth and lingers for minutes (half-life about a minute and a half) instead of fading in seconds
  float hurtIn=0.0;   // the fraction of this cell lost to things that hurt: fire, the organism, blades. heat alone, carried or endured, is not hurt
  if(sp.y>0.35){ float d=min(0.3,(sp.y-0.35)*0.18); self*=1.0-d; hurtIn+=d; }
  { float eat=max(sp.w-0.08,0.0)*0.04; self-=eat; hurtIn+=eat/max(self+eat,0.05); }   // the organism feeds on you
  if(sp.y>0.35 && sp.w>0.05 && dc<uRfar) self+=sp.w*(sp.y-0.35)*0.35;   // organism burning near you becomes you
  for(int i=0;i<uNDrones;i++){ if(distance(vec2(p)+0.5,uDrones[i])<uDroneR){ self*=0.93; hurtIn+=0.07; } }
  float lost=max(0.0,before-self);
  vec2 dv=vec2(p)+0.5-uInjectB.xy; float dd=dot(dv,dv); if(dd<uInjectB.z*uInjectB.z){ self=max(self,uInjectB.w*(1.0-dd/(uInjectB.z*uInjectB.z)*0.5)); if(uPayInit>0.0) pay=self*uPayInit; }
  if(self<0.003){ lost+=self; self=0.0; }
  if(self<st*0.9 && st>0.0) pay*=self/st;                              // a cell that loses a real part of itself loses that part of its load; ordinary metabolism keeps it
  if(ore && pay>=0.0) pay=min(self,pay+0.2);                           // near ore: the cell fills up in a few substeps
  if(uAlcove.z>uAlcove.x && pay>0.0 && float(p.x)>=uAlcove.x && float(p.x)<=uAlcove.z && float(p.y)>=uAlcove.y && float(p.y)<=uAlcove.w) pay*=0.96;   // inside a dead alcove: deposited
  if(uPick.z>0.0 && distance(vec2(p)+0.5,uPick.xy)<uPick.z) pay=-self*uPick.w;   // a power pickup charges the cells that touch it
  if(pay<0.0) pay*=0.9985;                                            // a charge fades in about ten seconds
  pay=clamp(pay,-self,self); if(self<=0.0) pay=0.0;
  // hurt (uB.z): what this matter has suffered, carried with it, so it stays on the cells that were hurt and spreads only as they mix.
  // it heals slowly on its own, fast in a cold still pocket, and is diluted by new matter grown into the cell; hurt cells swim weaker (bodyVel)
  float ex=texelFetch(uB,p,0).z; vec2 v0b=texelFetch(uBV,p,0).xy; ivec2 from=ivec2(floor(vec2(p)+0.5-v0b)); float exFrom=texelFetch(uB,wrapP(from),0).z;
  { float calmH=smoothstep(0.08,0.35,-sp.y)*(1.0-smoothstep(0.01,0.04,length(texelFetch(uFC,p,0).zw))); float grown=max(0.0,self-before);
    ex=mix(ex,exFrom,0.5); ex+=hurtIn*1.5; ex-=ex*(0.0001+0.004*calmH); ex*=max(0.0,1.0-grown/max(self,0.02)); ex=clamp(ex,0.0,1.0); if(self<=0.0) ex=0.0; }
  // identity state: carried with the matter like exposure, then updated by the identity model
  vec4 q=mix(texelFetch(uQ,p,0),texelFetch(uQ,wrapP(from),0),0.5); vec2 dr= kk>=0&&kk<3? uDirs[kk] : vec2(0.0);
  q=identUpdate(q,self,v0b,dc,kkNear,sp,dr,p);
  if(s0<=0.003 && self>0.0){ // a new cell belongs to whoever grew it: the allegiance of the neighbours that fed it (not the nearest centre, which let one wisp's growth feed the other without limit)
    float bs=0.0, ss=0.0; vec3 w3=vec3(0.0); float wid=0.0; for(int k=0;k<4;k++){ ivec2 qq=p+E4[k]; if(!fluidAt(qq)) continue; float sn=texelFetch(uB,qq,0).x; vec4 qn=texelFetch(uQ,qq,0); if(sn>bs){ bs=sn; wid=qn.w; } w3+=qn.xyz*sn; ss+=sn; } q.w=wid; if(ss>0.0) q.xyz=w3/ss; }   // a new cell takes the number of the neighbour that fed it most, and the will its neighbours carry
  if(self<=0.0) q=vec4(0.0);
  o=vec4(clamp(self,0.0,2.0),lost,clamp(ex,0.0,1.0),pay); oq=q;
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
uniform sampler2D uS, uFC, uB, uSrc; out vec4 o;
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
    float life=max(s.w,nlife); if(life>0.45 && b.x>0.01 && texelFetch(uSrc,p,0).a<=0.0){ phi+=(life-0.45)*0.012; kind=mix(kind,1.0,0.05); } // tissue: the organism builds wall only out of the body it is eating, never over its own spore halo (it used to entomb every colony within a second, which is why a strip attacked once and then went quiet)
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
uniform sampler2D uB, uS;
layout(location=0) out vec4 o0; layout(location=1) out vec4 o1; layout(location=2) out vec4 o2; layout(location=3) out vec4 o3;
void main(){ ivec2 b=ivec2(gl_FragCoord.xy)*4; vec4 a0=vec4(0.0),a1=vec4(0.0),a2=vec4(0.0),a3=vec4(0.0);
  for(int y=0;y<4;y++) for(int x=0;x<4;x++){ ivec2 q=b+ivec2(x,y); if(q.x>=uRes.x||q.y>=uRes.y) continue; float s=texelFetch(uB,q,0).x; if(s<=0.0) continue;
    float px=float(q.x)+0.5, py=float(q.y)+0.5; vec2 pp=vec2(px,py);
    vec4 qq=texelFetch(uQ,q,0);
    if(idOf(qq)>0){ a2.z+=s; a2.w+=s*px; a3.x+=s*py; continue; }   // wisps of their own: their mass together and where it is on average (for tests and the hud; they have no centre)
    float w=s*identWeight(0,0,qq,pp);   // your connected body
    a0.xyz+=vec3(w,w*px,w*py); a1.xyz+=vec3(w*px*px,w*py*py,w*px*py); a0.w+=s-w;   // and, in w, your loose matter: parts left behind
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
void main(){ int i=int(gl_FragCoord.x); vec2 pt=uPts[i]; ivec2 p=wrapP(ivec2(floor(pt))); vec4 s=texelFetch(uS,p,0); vec4 b=texelFetch(uB,p,0); o=vec4(s.x,b.w,s.w,b.x); }`;   // fuel, payload, organism, self

// ---------------- render ----------------
SH.render = SH.head + `
uniform sampler2D uS, uFC, uDye, uB, uLight, uBloom;
uniform vec2 uCam; uniform float uZoom; uniform vec2 uScreen; uniform int uDebug;
uniform vec4 uPlayer;        // x y radius facing
uniform vec4 uEnt[48]; uniform int uNEnt;   // x y kind radius
uniform float uPHurt, uPHp; uniform vec4 uTint; uniform vec2 uSplitAxisR; uniform float uSplitSideR;
out vec4 o;
vec3 hsv(float h,float s,float v){ vec3 k=vec3(1.0,2.0/3.0,1.0/3.0); vec3 p=abs(fract(vec3(h)+k)*6.0-3.0); return v*mix(vec3(1.0),clamp(p-1.0,0.0,1.0),s); }
float wallShade(ivec2 p){ // bevel from neighbours
  float s=0.0; for(int k=0;k<4;k++){ ivec2 q=p+ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0); if(!solidAt(q)) s+=(k==3)?0.35:(k==2)?-0.15:0.12; } return s; }
void main(){
  vec2 wc=uCam+vec2(gl_FragCoord.x,uScreen.y-gl_FragCoord.y)/uZoom;
  ivec2 p=ivec2(floor(wc)); vec2 uv=wc/vec2(uRes);
  vec4 m=maskAt(p); int t=mtype(m);
  // the fields are sampled bilinearly for display, so cells never show as squares; walls keep their cell texture
  vec4 s=texture(uS,uv); vec4 c=texture(uFC,uv); vec4 d=texture(uDye,uv);
  vec3 col;
  vec4 wf=texelFetch(uWf,wrapP(p),0); vec4 wfl=texture(uWf,uv);
  // wall coverage at this screen pixel: bilinear over the four nearest cells' solidity, so edges follow a smooth contour
  float cov; { vec2 q=wc-0.5; ivec2 q0=ivec2(floor(q)); vec2 f=fract(q); float a=solidAt(q0)?1.0:0.0, b=solidAt(q0+ivec2(1,0))?1.0:0.0, cc=solidAt(q0+ivec2(0,1))?1.0:0.0, dd=solidAt(q0+ivec2(1,1))?1.0:0.0; cov=mix(mix(a,b,f.x),mix(cc,dd,f.x),f.y); }
  bool solid=cov>=0.5; if(solid && !solidAt(p)){ p=ivec2(floor(wc-0.5+vec2(cov>=0.5?0.5:0.0))); if(!solidAt(p)){ ivec2 q0=ivec2(floor(wc-0.5)); p=solidAt(q0)?q0:solidAt(q0+ivec2(1,0))?q0+ivec2(1,0):solidAt(q0+ivec2(0,1))?q0+ivec2(0,1):q0+ivec2(1,1); } wf=texelFetch(uWf,wrapP(p),0); }
  float light=texture(uLight,(wc)/vec2(uRes)).r; float lit=0.045+min(1.6,light*1.6);
  if(uDebug==4){ o=vec4(vec3(min(1.0,light)),1.0); return; }
  if(uDebug==5){   // clear view: one cell one square, no light, no bloom, no blending: density as brightness, whose as colour (yours pale blue, the other wisp green, a past life dark blue), the border in red where allegiance crosses a half
    if(solidAt(p)){ o=vec4(vec3(0.22),1.0); return; }
    vec4 b=texelFetch(uB,wrapP(p),0); vec4 q=texelFetch(uQ,wrapP(p),0); float sf=b.x; vec3 bg=vec3(0.04,0.045,0.06)+vec3(0.25,0.08,0.0)*min(1.0,max(s.y,0.0)*2.0);
    if(sf<=0.002){ o=vec4(bg,1.0); return; }
    float k=min(1.0,pow(sf/0.9,0.7)); int idv=idOf(q); float w= idv==0?1.0:0.0; vec3 cc= idv==0? vec3(0.55,0.8,1.0) : idHue(idv);
    bool edge=false; for(int kk=0;kk<4;kk++){ ivec2 n=p+ivec2(kk==0?1:kk==1?-1:0,kk==2?1:kk==3?-1:0); if(texelFetch(uB,wrapP(n),0).x>0.002 && idOf(texelFetch(uQ,wrapP(n),0))!=idv) edge=true; }
    if(edge) cc=vec3(1.0,0.3,0.3);
    o=vec4(mix(bg,cc,0.25+0.75*k),1.0); return; }
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
    else if(t==M_ORE) col=mix(col,vec3(0.95,0.72,0.3),0.55+0.15*sin(uTime*2.5+float(p.x*7+p.y*3)));
    else if(t==M_DEAD) col=mix(col,vec3(0.16,0.2,0.28),0.75)+vec3(0.3,0.22,0.06)*(0.35+0.35*sin(uTime*1.6+float(p.x)*0.1));
    bool src=(t==M_BURNER||t==M_COOLER||t==M_FUEL||t==M_SPORE||t==M_ORE);
    col*=src? max(lit,t==M_ORE?0.22:0.08) : lit;   // sources sit in the same shadow as everything else; gold keeps a faint glint
    if(s.y>0.0 && t!=M_BURNER) col+=vec3(1.0,0.4,0.1)*clamp(s.y*0.3,0.0,0.5)*min(1.0,lit+0.1); // hot walls glow, in the light of the fire
    o=vec4(col,1.0); return;
  }
  // gas volume
  vec3 bg=vec3(0.035,0.04,0.055);
  if(t==M_VENT) bg=vec3(0.1,0.25,0.3); if(t==M_DRAIN) bg=vec3(0.25,0.1,0.1); if(t==M_ORB) bg=vec3(0.35,0.9,0.85)*(0.7+0.3*sin(uTime*5.0)); if(t==M_EXIT) bg=vec3(1.0,0.85,0.25)*(0.7+0.3*sin(uTime*4.0)); if(t==M_CHECK) bg=vec3(0.2,0.6,0.3)*(0.7+0.3*sin(uTime*3.0)); if(t==M_GRATE) bg=vec3(0.12,0.13,0.15);
  col=bg;
  if(wfl.x>0.0){ col=mix(col,vec3(0.3,0.3,0.33)*(0.5+0.5*(1.0-wfl.y)),wfl.x*0.8); }
  float sp=length(c.zw);
  float streak=(d.r+d.g+d.b)/3.0-0.5;                       // signed noise, stretched along the flow
  col+=vec3(0.30,0.40,0.55)*(0.10+min(1.0,sp*6.0)*0.55)*(0.5+streak);  // streaklines, brighter where the gas moves
  col+=vec3(0.15,0.55,0.35)*s.x*0.45;                     // fuel haze
  col=mix(col,vec3(0.02),clamp(s.z*0.5,0.0,0.7));          // smoke
  col*=lit;                                               // lit by the self and by fire
  float h=max(s.y,0.0);
  col+=vec3(1.0,0.5,0.15)*h*0.8+vec3(1.0,0.9,0.7)*h*h*0.5; // heat glow
  if(s.y<0.0) col+=vec3(0.18,0.42,0.8)*min(1.0,-s.y*1.6)*min(1.0,lit+0.05);     // cold: a blue breath, seen only where there is light
  float L=s.w; col=mix(col,vec3(0.75,0.25,0.9)*(0.6+0.4*sin(uTime*2.0+L*12.0))*min(1.0,lit+0.1),clamp(L*1.6,0.0,0.85)); // organism
  float pr=c.y; col+=vec3(0.3,0.25,0.2)*clamp((pr-1.15)*1.5,0.0,1.0);  // pressure fronts
  col+=vec3(0.35,0.5,0.85)*wfl.z*0.9*(0.85+0.15*sin(uTime*1.5+float(p.x+p.y)*0.2))*min(1.0,lit+0.1);   // residue: where selves were lost
  col+=texture(uBloom,gl_FragCoord.xy/uScreen).rgb*0.55;
  col=1.0-exp(-col*1.4);
  col=mix(col,vec3(0.16,0.17,0.19)*max(lit,0.3),smoothstep(0.28,0.5,cov));   // soft wall edge
  // entities
  for(int i=0;i<uNEnt;i++){ vec4 e=uEnt[i]; float dd=length(wc-e.xy); float el=min(1.0,lit+0.08); if(dd<e.w){ vec3 ec = e.z<1.0? vec3(1.0,0.85,0.2) : e.z<2.0? vec3(1.0,0.2,0.2) : vec3(0.4,1.0,0.9); col=mix(col,ec*el,0.9); } else if(dd<e.w*2.5){ col+=(e.z<1.0?vec3(0.5,0.4,0.1):e.z<2.0?vec3(0.4,0.05,0.05):vec3(0.1,0.3,0.3))*(1.0-dd/(e.w*2.5))*el; } }
  float self=texture(uB,uv).x;
  if(self>0.0){ float k=min(1.0,pow(self/0.9,0.7)); vec3 bc=mix(vec3(0.5,0.78,1.0),vec3(1.0,1.0,1.0),k*k);
    { float d0=distance(wc,uC[0]); float dk=1e9; int gk=0; for(int j=1;j<3;j++){ if(j<uCN){ float dj=distance(wc,uC[j]); if(dj<dk){ dk=dj; gk=j; } } }
      if(idOf(texture(uQ,uv))>0){ bc=mix(bc,idHue(idOf(texture(uQ,uv))),0.5); } }   // a wisp of its own wears a pale hue of its own
    if(uWill>0.5){ vec4 qr=texture(uQ,uv); if(idOf(qr)==0) k*=mix(0.5,1.0,smoothstep(0.0,0.3,qr.z)); }   // matter your will does not reach is dimmer: a part left behind
    if(uTint.a>0.0) bc=mix(bc,uTint.rgb,uTint.a);
    bc=identTint(texture(uQ,uv),bc,self);
    { float pay=texture(uB,uv).w; float pf=clamp(abs(pay)/max(0.05,self),0.0,1.0); if(pay>0.0) bc=mix(bc,vec3(1.0,0.78,0.3),0.75*pf); else if(pay<0.0) bc=mix(bc,vec3(0.55,1.0,0.95),0.75*pf); }   // what the cells carry: ore is gold, a charge is bright
    if(uSplitSideR>0.0){ float ex=texture(uB,uv).z; bc=mix(bc, ex>0.5? vec3(1.0,0.6,0.3):vec3(0.4,0.7,1.0), uSplitSideR*0.6); } { float hc=texture(uB,uv).z; bc=mix(bc,vec3(1.0,0.35,0.3),min(0.8,hc*0.9)); } col=mix(col,bc,min(1.0,k*1.2)); col+=vec3(0.12,0.22,0.4)*k; }
  o=vec4(col,1.0);
}`;
