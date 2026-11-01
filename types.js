// types.js — cell type table shared by the GPU shaders, world generator and entities.
'use strict';
const T = {
  EMPTY:0, STONE:1, DIRT:2, SAND:3, WATER:4, LAVA:5, OIL:6, FIRE:7, SMOKE:8, STEAM:9,
  WOOD:10, LEAF:11, GRASS:12, ICE:13, SNOW:14, ACID:15, GUNPOWDER:16, MUD:17, GLASS:18,
  OBSIDIAN:19, MOSS:20, VINE:21, SEED:22, COAL:23, SLIME:24, CLOUD:25, HONEY:26, SPRING:27,
  GEYSER:28, CRYSTAL:29, BOUNCE:30, GOLD:31, FLAG:32, PLAYER:33, ASH:34, EMBER:35, FUNGUS:36,
  SPORE:37, SPIKE:38, TORCH:39, BEDROCK:40, PLAYERHEAD:41, SPARK:42, CACTUS:43, BONE:44,
  BLOB:45, WISP:46, CRAWLER:47, BEANSTALK:48, RUBBLE:49, DUST:50, BLAST:51, CLOD:52,
  COUNT:53
};
const NAMES=[]; for(const k in T) NAMES[T[k]]=k.toLowerCase();
// flag bits (match shaders)
const F_SOLID=1, F_LIQUID=2, F_POWDER=4, F_GAS=8, F_FLAM=16, F_HOT=32, F_ENT=64, F_CLIMB=128;
const PROPS=new Uint8Array(256*4);   // r density, g flags, b ignition temp/8, a burn life
const PAL=new Uint8Array(256*4);     // r g b, a = colour variation
function def(t,flags,dens,col,ignite,burn){ PROPS[t*4]=dens; PROPS[t*4+1]=flags; PROPS[t*4+2]=ignite?Math.min(255,Math.round(ignite/8)):0; PROPS[t*4+3]=burn||0; PAL[t*4]=col[0]; PAL[t*4+1]=col[1]; PAL[t*4+2]=col[2]; PAL[t*4+3]=col[3]; }
def(T.EMPTY,     0,                 0,   [0,0,0,0]);
def(T.STONE,     F_SOLID,           255, [110,112,118,14]);
def(T.BEDROCK,   F_SOLID,           255, [40,38,44,8]);
def(T.DIRT,      F_SOLID,           255, [120,82,50,14]);
def(T.CLOD,      F_POWDER|F_SOLID,  65,  [112,76,46,14]);
def(T.SAND,      F_POWDER|F_SOLID,  60,  [226,196,122,16]);
def(T.MUD,       F_POWDER|F_SOLID,  66,  [88,62,40,10]);
def(T.SNOW,      F_POWDER|F_SOLID,  40,  [238,242,250,8]);
def(T.ASH,       F_POWDER|F_SOLID,  42,  [96,92,90,12]);
def(T.RUBBLE,    F_POWDER|F_SOLID,  70,  [120,118,124,16]);
def(T.GOLD,      F_POWDER|F_SOLID,  90,  [255,215,60,30]);
def(T.GUNPOWDER, F_POWDER|F_SOLID|F_FLAM, 58, [52,50,56,10], 150, 8);
def(T.SEED,      F_POWDER|F_SOLID|F_FLAM, 55, [150,120,60,10], 240, 6);
def(T.WATER,     F_LIQUID,          30,  [38,110,210,18]);
def(T.OIL,       F_LIQUID|F_FLAM,   20,  [70,50,40,8], 220, 22);
def(T.ACID,      F_LIQUID,          32,  [150,240,70,20]);
def(T.LAVA,      F_LIQUID|F_HOT,    50,  [240,110,30,30]);
def(T.HONEY,     F_LIQUID,          35,  [230,160,40,12]);
def(T.SLIME,     F_LIQUID,          36,  [90,220,120,20]);
def(T.FIRE,      F_GAS|F_HOT,       1,   [255,140,20,40]);
def(T.SMOKE,     F_GAS,             1,   [70,70,76,14]);
def(T.STEAM,     F_GAS,             1,   [200,210,222,14]);
def(T.SPORE,     F_GAS|F_FLAM,      1,   [170,120,230,30], 200, 3);
def(T.SPARK,     F_GAS|F_HOT,       1,   [255,230,120,30]);
def(T.DUST,      F_GAS,             1,   [160,140,110,20]);
def(T.WOOD,      F_SOLID|F_FLAM,    255, [130,90,52,14], 300, 70);
def(T.LEAF,      F_SOLID|F_FLAM|F_CLIMB, 255, [60,150,60,30], 200, 14);
def(T.GRASS,     F_SOLID|F_FLAM,    255, [90,180,70,24], 180, 10);
def(T.CACTUS,    F_SOLID|F_FLAM,    255, [70,140,60,16], 280, 30);
def(T.ICE,       F_SOLID,           255, [170,215,245,14]);
def(T.GLASS,     F_SOLID,           255, [190,220,230,8]);
def(T.OBSIDIAN,  F_SOLID,           255, [40,30,55,10]);
def(T.MOSS,      F_SOLID|F_FLAM,    255, [70,130,60,16], 220, 12);
def(T.VINE,      F_SOLID|F_FLAM|F_CLIMB, 255, [60,120,50,18], 200, 10);
def(T.BEANSTALK, F_SOLID|F_FLAM|F_CLIMB, 255, [90,200,70,26], 220, 12);
def(T.COAL,      F_SOLID|F_FLAM,    255, [36,34,38,10], 400, 120);
def(T.CLOUD,     F_SOLID,           255, [235,238,245,10]);
def(T.SPRING,    F_SOLID,           255, [80,140,200,10]);
def(T.GEYSER,    F_SOLID,           255, [150,120,100,12]);
def(T.CRYSTAL,   F_SOLID,           255, [180,120,255,30]);
def(T.BOUNCE,    F_SOLID,           255, [240,80,160,12]);
def(T.FLAG,      F_SOLID,           255, [255,60,60,20]);
def(T.EMBER,     F_SOLID|F_HOT,     255, [220,80,30,40]);
def(T.FUNGUS,    F_SOLID|F_FLAM,    255, [200,150,230,24], 200, 10);
def(T.SPIKE,     F_SOLID,           255, [200,200,210,20]);
def(T.TORCH,     F_SOLID|F_HOT,     255, [200,140,60,10]);
def(T.BONE,      F_SOLID,           255, [225,220,200,10]);
def(T.BLAST,     F_GAS|F_HOT,       1,   [255,240,200,20]);
def(T.PLAYER,    F_SOLID|F_ENT,     255, [250,230,200,6]);
def(T.PLAYERHEAD,F_SOLID|F_ENT,     255, [40,40,50,6]);
def(T.BLOB,      F_SOLID|F_ENT,     255, [60,170,80,20]);
def(T.WISP,      F_SOLID|F_ENT,     255, [255,170,60,40]);
def(T.CRAWLER,   F_SOLID|F_ENT,     255, [150,140,160,16]);
const GLSL_TYPES = Object.keys(T).filter(k=>k!=='COUNT').map(k=>`#define T_${k} ${T[k]}u`).join('\n');
if(typeof module!=='undefined') module.exports={T,NAMES,PROPS,PAL,GLSL_TYPES};
