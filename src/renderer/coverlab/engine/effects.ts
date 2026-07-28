// WebGL2 effect registry for Cover Lab.
//
// Each effect supplies a GLSL ES 3.00 fragment *body* (helpers + main). The engine
// wraps it with a shared header that declares:
//   in  vec2 v_uv;            // 0..1, top-left origin
//   out vec4 fragColor;
//   uniform sampler2D u_tex;  // previous pass (or composited source)
//   uniform sampler2D u_mask; // user-painted motion mask (white = affected); 1x1 white when unpainted
//   uniform vec2  u_resolution;
//   uniform float u_time;     // seconds (animated during GIF export)
//   uniform <type> u_<paramKey>;  // one per ParamSpec (color => vec3, else float)
// plus a small noise/colour-space prelude (see PRELUDE), incl. maskAt(uv).

import { EffectDef } from "./types"

export const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

export const PRELUDE = `
#define TAU 6.28318530718
// ── Seamless-loop helpers ────────────────────────────────────────────────────
// Animation is driven by a looping phase in [0,1): at phase 0 and phase 1 the
// motion is identical, so an exported GIF flows from its last frame back into
// its first with no jump. u_duration is the loop length in seconds.
float loopPhase(){ return fract(u_time/max(u_duration,1e-4)); }
float loopAngle(){ return loopPhase()*TAU; }
// A point orbiting a circle of the given radius — feed this into noise instead of
// "+ time" so the noise field returns exactly to its start each loop.
vec2 loopDrift(float radius){ float a=loopAngle(); return vec2(cos(a),sin(a))*radius; }
// Snap a "speed" to a whole number of cycles per loop so sin/cos motion lines up.
float loopCycles(float c){ return max(1.0, floor(abs(c)+0.5)); }
float loopSin(float speed, float phase){ return sin(loopAngle()*loopCycles(speed)+phase); }
float loopCos(float speed, float phase){ return cos(loopAngle()*loopCycles(speed)+phase); }
// Discrete frame index that repeats every loop (for stepped/glitch effects).
float loopStep(float steps){ return floor(loopPhase()*max(1.0,floor(steps+0.5))); }
float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),u.x), mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.0; a*=0.5; } return v; }
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y); float e=1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
  vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
  return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
float maskAt(vec2 p){ vec4 m=texture(u_mask, clamp(p,0.0,1.0)); return m.r*m.a; }
`

export const PASSTHROUGH_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
void main(){ fragColor = texture(u_tex, v_uv); }`

export const EFFECTS: EffectDef[] = [
  {
    id: "warp",
    name: "Liquid Morph",
    category: "Distort",
    animatable: true,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 0.3, step: 0.005, default: 0.08 },
      { key: "scale", label: "Scale", type: "range", min: 1, max: 8, step: 0.1, default: 3 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.6 },
    ],
    frag: `void main(){
  vec2 uv=v_uv; vec2 d=loopDrift(u_speed);
  vec2 q=vec2(fbm(uv*u_scale+d), fbm(uv*u_scale+vec2(5.2,1.3)+d));
  vec2 r=vec2(fbm(uv*u_scale+4.0*q+vec2(1.7,9.2)), fbm(uv*u_scale+4.0*q+vec2(8.3,2.8)));
  uv+=(r-0.5)*u_amount;
  fragColor=texture(u_tex, clamp(uv,0.0,1.0));
}`,
  },
  {
    id: "chromatic",
    name: "Chromatic Aberration",
    category: "Distort",
    animatable: false,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 0.15, step: 0.002, default: 0.03 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; float d=length(c); float a=u_amount*d;
  float r=texture(u_tex, v_uv+c*a).r;
  float g=texture(u_tex, v_uv).g;
  float b=texture(u_tex, v_uv-c*a).b;
  fragColor=vec4(r,g,b,1.0);
}`,
  },
  {
    id: "rgbshift",
    name: "RGB Shift",
    category: "Distort",
    animatable: true,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 0.06, step: 0.001, default: 0.012 },
      { key: "speed", label: "Pulse", type: "range", min: 0, max: 6, step: 0.1, default: 0 },
    ],
    frag: `void main(){
  float s=u_amount*(u_speed>0.0 ? (0.5+0.5*loopSin(u_speed,0.0)) : 1.0);
  float r=texture(u_tex, v_uv+vec2(s,0.0)).r;
  float g=texture(u_tex, v_uv).g;
  float b=texture(u_tex, v_uv-vec2(s,0.0)).b;
  fragColor=vec4(r,g,b,1.0);
}`,
  },
  {
    id: "glitch",
    name: "Glitch",
    category: "Distort",
    animatable: true,
    params: [
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "blocks", label: "Blocks", type: "range", min: 4, max: 120, step: 1, default: 40 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 1.5 },
    ],
    frag: `void main(){
  float t=loopStep(u_speed*10.0*u_duration);
  vec2 uv=v_uv; float blocks=floor(u_blocks);
  float row=floor(uv.y*blocks);
  float n=hash21(vec2(row,t));
  float shift=step(1.0-u_intensity,n)*(hash21(vec2(row,t+1.0))-0.5)*u_intensity;
  uv.x+=shift;
  float ca=0.02*u_intensity;
  vec3 col;
  col.r=texture(u_tex, uv+vec2(ca,0.0)).r;
  col.g=texture(u_tex, uv).g;
  col.b=texture(u_tex, uv-vec2(ca,0.0)).b;
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "pixelsort",
    name: "Pixel Drift",
    category: "Distort",
    animatable: false,
    params: [
      { key: "threshold", label: "Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: "amount", label: "Drift", type: "range", min: 0, max: 0.4, step: 0.005, default: 0.12 },
      { key: "vertical", label: "Vertical", type: "bool", default: false },
    ],
    frag: `void main(){
  vec2 uv=v_uv; float l=luma(texture(u_tex,uv).rgb);
  float drift=step(u_threshold,l)*u_amount;
  vec2 dir=u_vertical>0.5 ? vec2(0.0,1.0) : vec2(1.0,0.0);
  fragColor=vec4(texture(u_tex, clamp(uv-dir*drift,0.0,1.0)).rgb,1.0);
}`,
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    category: "Distort",
    animatable: true,
    params: [
      { key: "segments", label: "Segments", type: "range", min: 2, max: 16, step: 1, default: 6 },
      { key: "spin", label: "Spin", type: "range", min: 0, max: 3, step: 0.05, default: 0 },
    ],
    frag: `void main(){
  vec2 p=v_uv-0.5; float r=length(p);
  float a=atan(p.y,p.x)+(u_spin>0.0?loopAngle()*loopCycles(u_spin):0.0);
  float seg=6.28318/u_segments;
  a=mod(a,seg); a=abs(a-seg*0.5);
  vec2 uv=vec2(cos(a),sin(a))*r+0.5;
  fragColor=texture(u_tex, clamp(uv,0.0,1.0));
}`,
  },
  {
    id: "pixelate",
    name: "Pixelate",
    category: "Distort",
    animatable: false,
    params: [
      { key: "size", label: "Block Size", type: "range", min: 2, max: 200, step: 1, default: 24 },
    ],
    frag: `void main(){
  vec2 px=vec2(u_size)/u_resolution;
  vec2 uv=(floor(v_uv/px)+0.5)*px;
  fragColor=texture(u_tex, uv);
}`,
  },
  {
    id: "scanlines",
    name: "CRT Scanlines",
    category: "Retro",
    animatable: false,
    params: [
      { key: "count", label: "Lines", type: "range", min: 80, max: 1400, step: 10, default: 600 },
      { key: "strength", label: "Strength", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "curvature", label: "Curve", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.12 },
    ],
    frag: `void main(){
  vec2 uv=v_uv; vec2 cc=uv-0.5;
  uv+=cc*dot(cc,cc)*u_curvature;
  vec3 col=texture(u_tex, uv).rgb;
  float line=sin(uv.y*u_count*3.14159);
  col*=1.0-u_strength*0.5*(0.5+0.5*line);
  float m=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
  fragColor=vec4(col*m,1.0);
}`,
  },
  {
    id: "vhs",
    name: "VHS",
    category: "Retro",
    animatable: true,
    params: [
      { key: "distortion", label: "Warble", type: "range", min: 0, max: 0.06, step: 0.001, default: 0.012 },
      { key: "noise", label: "Noise", type: "range", min: 0, max: 1, step: 0.01, default: 0.25 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 1.5 },
    ],
    frag: `void main(){
  vec2 uv=v_uv;
  uv.x+=sin(uv.y*120.0+loopAngle()*loopCycles(u_speed*4.0))*u_distortion;
  vec3 col;
  col.r=texture(u_tex, uv+vec2(0.005,0.0)).r;
  col.g=texture(u_tex, uv).g;
  col.b=texture(u_tex, uv-vec2(0.005,0.0)).b;
  float n=hash21(uv*u_resolution.y+loopStep(u_duration*24.0)*7.0+1.0);
  col+=(n-0.5)*u_noise*0.6;
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "halftone",
    name: "Halftone",
    category: "Retro",
    animatable: false,
    params: [
      { key: "scale", label: "Dot Size", type: "range", min: 4, max: 60, step: 1, default: 14 },
      { key: "angle", label: "Angle", type: "range", min: 0, max: 3.14159, step: 0.01, default: 0.4 },
    ],
    frag: `void main(){
  float l=luma(texture(u_tex,v_uv).rgb);
  float s=sin(u_angle), co=cos(u_angle);
  vec2 uv=v_uv*u_resolution;
  vec2 rot=vec2(uv.x*co-uv.y*s, uv.x*s+uv.y*co);
  vec2 g=mod(rot,u_scale)/u_scale-0.5;
  float d=length(g);
  float dotv=step(d, sqrt(max(0.0,1.0-l))*0.72);
  fragColor=vec4(vec3(dotv),1.0);
}`,
  },
  {
    id: "grain",
    name: "Film Grain",
    category: "Texture",
    animatable: true,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 1, step: 0.01, default: 0.18 },
      { key: "size", label: "Size", type: "range", min: 0.5, max: 4, step: 0.1, default: 1 },
    ],
    frag: `void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  vec2 p=floor(v_uv*u_resolution/max(0.5,u_size));
  float n=hash21(p+loopStep(u_duration*24.0)*5.0+1.0);
  col+=(n-0.5)*u_amount;
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Light",
    animatable: false,
    params: [
      { key: "threshold", label: "Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
      { key: "radius", label: "Radius", type: "range", min: 0, max: 6, step: 0.1, default: 2.5 },
    ],
    frag: `void main(){
  vec3 base=texture(u_tex,v_uv).rgb;
  vec3 sum=vec3(0.0);
  vec2 px=u_radius/u_resolution;
  for(int x=-2;x<=2;x++){ for(int y=-2;y<=2;y++){
    vec3 s=texture(u_tex, v_uv+vec2(float(x),float(y))*px).rgb;
    sum+=max(s-u_threshold,0.0);
  }}
  sum/=25.0;
  fragColor=vec4(base+sum*u_intensity,1.0);
}`,
  },
  {
    id: "fog",
    name: "Dystopian Fog",
    category: "Light",
    animatable: true,
    params: [
      { key: "density", label: "Density", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: "#9aa6b2" },
      { key: "height", label: "Height Falloff", type: "range", min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: "speed", label: "Drift", type: "range", min: 0, max: 2, step: 0.02, default: 0.4 },
    ],
    frag: `void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  float f=fbm(v_uv*3.0+loopDrift(u_speed*0.5));
  float grad=mix(1.0, smoothstep(0.0,1.0,v_uv.y), u_height);
  float amt=clamp(f*u_density*grad,0.0,1.0);
  fragColor=vec4(mix(col,u_color,amt),1.0);
}`,
  },
  {
    id: "vignette",
    name: "Vignette",
    category: "Light",
    animatable: false,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 1.5, step: 0.01, default: 0.7 },
      { key: "radius", label: "Radius", type: "range", min: 0.1, max: 1, step: 0.01, default: 0.75 },
      { key: "softness", label: "Softness", type: "range", min: 0.02, max: 1, step: 0.01, default: 0.45 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb;
  float d=distance(v_uv, vec2(0.5));
  float v=smoothstep(u_radius, u_radius-u_softness, d);
  c*=mix(1.0, v, clamp(u_amount,0.0,1.5));
  fragColor=vec4(c,1.0);
}`,
  },
  {
    id: "duotone",
    name: "Duotone",
    category: "Color",
    animatable: false,
    params: [
      { key: "dark", label: "Shadows", type: "color", default: "#0a0a2a" },
      { key: "light", label: "Highlights", type: "color", default: "#ff2e6c" },
      { key: "contrast", label: "Contrast", type: "range", min: 0.5, max: 3, step: 0.05, default: 1.2 },
    ],
    frag: `void main(){
  float l=luma(texture(u_tex,v_uv).rgb);
  l=clamp((l-0.5)*u_contrast+0.5,0.0,1.0);
  fragColor=vec4(mix(u_dark,u_light,l),1.0);
}`,
  },
  {
    id: "gradientmap",
    name: "Gradient Map",
    category: "Color",
    animatable: false,
    params: [
      { key: "low", label: "Low", type: "color", default: "#1a0033" },
      { key: "mid", label: "Mid", type: "color", default: "#ff0066" },
      { key: "high", label: "High", type: "color", default: "#ffee88" },
      { key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 1 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb; float l=luma(c);
  vec3 g = l<0.5 ? mix(u_low,u_mid,l*2.0) : mix(u_mid,u_high,(l-0.5)*2.0);
  fragColor=vec4(mix(c,g,u_mix),1.0);
}`,
  },
  {
    id: "posterize",
    name: "Posterize",
    category: "Color",
    animatable: false,
    params: [
      { key: "levels", label: "Levels", type: "range", min: 2, max: 16, step: 1, default: 5 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb;
  float n=floor(u_levels);
  c=floor(c*n)/max(1.0,n-1.0);
  fragColor=vec4(clamp(c,0.0,1.0),1.0);
}`,
  },
  {
    id: "threshold",
    name: "Threshold",
    category: "Color",
    animatable: false,
    params: [
      { key: "level", label: "Level", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 1 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb; float l=luma(c);
  float t=step(u_level,l);
  fragColor=vec4(mix(c, vec3(t), u_mix),1.0);
}`,
  },
  {
    id: "colorgrade",
    name: "Color Grade",
    category: "Color",
    animatable: false,
    params: [
      { key: "hue", label: "Hue", type: "range", min: -0.5, max: 0.5, step: 0.005, default: 0 },
      { key: "saturation", label: "Saturation", type: "range", min: 0, max: 2, step: 0.02, default: 1 },
      { key: "brightness", label: "Brightness", type: "range", min: 0, max: 2, step: 0.02, default: 1 },
      { key: "contrast", label: "Contrast", type: "range", min: 0, max: 2, step: 0.02, default: 1 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb;
  vec3 hsv=rgb2hsv(c);
  hsv.x=fract(hsv.x+u_hue);
  hsv.y=clamp(hsv.y*u_saturation,0.0,1.0);
  c=hsv2rgb(hsv);
  c*=u_brightness;
  c=(c-0.5)*u_contrast+0.5;
  fragColor=vec4(clamp(c,0.0,1.0),1.0);
}`,
  },

  // ── Distort (extended) ───────────────────────────────────────────────────
  {
    id: "mirror",
    name: "Mirror",
    category: "Distort",
    animatable: false,
    params: [
      {
        key: "axis",
        label: "Axis",
        type: "select",
        options: [
          { label: "Left → Right", value: 0 },
          { label: "Right → Left", value: 1 },
          { label: "Top → Bottom", value: 2 },
          { label: "4-Way", value: 3 },
        ],
        default: 0,
      },
    ],
    frag: `void main(){
  vec2 uv=v_uv; int a=int(u_axis+0.5);
  if(a==0){ uv.x = uv.x<0.5? uv.x : 1.0-uv.x; }
  else if(a==1){ uv.x = uv.x>0.5? uv.x : 1.0-uv.x; }
  else if(a==2){ uv.y = uv.y<0.5? uv.y : 1.0-uv.y; }
  else { uv.x = uv.x<0.5?uv.x:1.0-uv.x; uv.y = uv.y<0.5?uv.y:1.0-uv.y; }
  fragColor=texture(u_tex,uv);
}`,
  },
  {
    id: "twirl",
    name: "Twirl",
    category: "Distort",
    animatable: true,
    params: [
      { key: "angle", label: "Angle", type: "range", min: -6.28, max: 6.28, step: 0.05, default: 2.5 },
      { key: "radius", label: "Radius", type: "range", min: 0.1, max: 1, step: 0.01, default: 0.6 },
      { key: "spin", label: "Spin", type: "range", min: -3, max: 3, step: 0.05, default: 0 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; float d=length(c);
  float pct=max(0.0,(u_radius-d)/u_radius);
  float a=(u_angle + sign(u_spin)*loopAngle()*loopCycles(u_spin))*pct*pct;
  float s=sin(a),co=cos(a);
  vec2 uv=vec2(c.x*co-c.y*s, c.x*s+c.y*co)+0.5;
  fragColor=texture(u_tex,clamp(uv,0.0,1.0));
}`,
  },
  {
    id: "bulge",
    name: "Bulge / Pinch",
    category: "Distort",
    animatable: false,
    params: [
      { key: "strength", label: "Strength", type: "range", min: -0.9, max: 2, step: 0.02, default: 0.6 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; float r=length(c);
  vec2 dir = r>0.0001? c/r : vec2(0.0);
  float rn=pow(clamp(r*2.0,0.0,1.0),1.0+u_strength)*0.5;
  fragColor=texture(u_tex,clamp(dir*rn+0.5,0.0,1.0));
}`,
  },
  {
    id: "ripple",
    name: "Ripple",
    category: "Distort",
    animatable: true,
    params: [
      { key: "amplitude", label: "Amplitude", type: "range", min: 0, max: 0.1, step: 0.001, default: 0.02 },
      { key: "frequency", label: "Frequency", type: "range", min: 0, max: 80, step: 1, default: 30 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 6, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; float d=length(c);
  float off=sin(d*u_frequency - loopAngle()*loopCycles(u_speed))*u_amplitude;
  vec2 dir = d>0.0? c/d : vec2(0.0);
  fragColor=texture(u_tex,clamp(v_uv+dir*off,0.0,1.0));
}`,
  },
  {
    id: "wave",
    name: "Wave",
    category: "Distort",
    animatable: true,
    params: [
      { key: "amplitude", label: "Amplitude", type: "range", min: 0, max: 0.1, step: 0.001, default: 0.02 },
      { key: "frequency", label: "Frequency", type: "range", min: 0, max: 60, step: 1, default: 18 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 6, step: 0.1, default: 1.5 },
    ],
    frag: `void main(){
  vec2 uv=v_uv; float ph=loopAngle()*loopCycles(u_speed);
  uv.x+=sin(uv.y*u_frequency+ph)*u_amplitude;
  uv.y+=cos(uv.x*u_frequency+ph)*u_amplitude;
  fragColor=texture(u_tex,clamp(uv,0.0,1.0));
}`,
  },
  {
    id: "polar",
    name: "Polar Coords",
    category: "Distort",
    animatable: false,
    params: [],
    frag: `void main(){
  vec2 c=v_uv-0.5;
  float a=atan(c.y,c.x); float r=length(c)*2.0;
  fragColor=texture(u_tex, fract(vec2(a/6.28318+0.5, r)));
}`,
  },
  {
    id: "spin",
    name: "Spin",
    category: "Distort",
    animatable: true,
    params: [
      { key: "speed", label: "Speed", type: "range", min: -3, max: 3, step: 0.05, default: 0.6 },
      { key: "scale", label: "Zoom", type: "range", min: 0.5, max: 2, step: 0.01, default: 1 },
    ],
    frag: `void main(){
  vec2 c=(v_uv-0.5)/u_scale; float a=sign(u_speed)*loopAngle()*loopCycles(u_speed);
  float s=sin(a),co=cos(a);
  vec2 uv=vec2(c.x*co-c.y*s, c.x*s+c.y*co)+0.5;
  fragColor=texture(u_tex,clamp(uv,0.0,1.0));
}`,
  },
  {
    id: "shake",
    name: "Shake",
    category: "Distort",
    animatable: true,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 0.1, step: 0.001, default: 0.02 },
      { key: "speed", label: "Speed", type: "range", min: 1, max: 40, step: 1, default: 20 },
    ],
    frag: `void main(){
  float t=loopStep(u_speed*u_duration);
  vec2 o=vec2(hash21(vec2(t,1.0))-0.5, hash21(vec2(t,2.0))-0.5)*u_amount;
  fragColor=texture(u_tex, clamp(v_uv+o,0.0,1.0));
}`,
  },
  {
    id: "livemotion",
    name: "Live Motion",
    category: "Distort",
    animatable: true,
    usesMask: true,
    params: [
      {
        key: "mode",
        label: "Motion",
        type: "select",
        options: [
          { label: "Stream (water, smoke)", value: 0 },
          { label: "Sway (petals, wind)", value: 1 },
          { label: "Vortex (swirl)", value: 2 },
          { label: "Pulse (breathe)", value: 3 },
          { label: "Boil (stop-motion)", value: 4 },
          { label: "Ripple (waves)", value: 5 },
        ],
        default: 0,
      },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
      { key: "amount", label: "Distance", type: "range", min: 0, max: 0.4, step: 0.005, default: 0.1 },
      { key: "direction", label: "Direction", type: "range", min: 0, max: 360, step: 1, default: 0 },
      { key: "follow", label: "Follow Image", type: "range", min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: "turb", label: "Turbulence", type: "range", min: 0, max: 1, step: 0.01, default: 0.35 },
      { key: "detail", label: "Detail", type: "range", min: 0.5, max: 12, step: 0.1, default: 3 },
      { key: "anchor", label: "Anchor Edges", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
      { key: "show", label: "Show Flow", type: "bool", default: false },
    ],
    // Content-aware flow animation (the technique behind Pixaloop-style "living
    // photo" apps): a flow field is derived from the image's own multi-scale
    // structure — motion bends to run along contours, like water following a
    // stream bed — plus curl-noise turbulence. Stream mode advects pixels along
    // the field with two phase-offset samples crossfaded into a seamless loop;
    // Sway mode oscillates regions along the field with noise-phased gusts.
    // Vortex swirls around the centre, Pulse breathes in/out radially, Boil is a
    // stepped stop-motion jitter, and Ripple sends concentric waves outward — all
    // still bent by the same flow field (via Follow Image) and gated by the mask.
    frag: `float flowLum(vec2 p){ return luma(texture(u_tex, clamp(p,0.0,1.0)).rgb); }
vec2 flowGrad(vec2 p, vec2 e){
  return vec2(
    flowLum(p+vec2(e.x,0.0))-flowLum(p-vec2(e.x,0.0)),
    flowLum(p+vec2(0.0,e.y))-flowLum(p-vec2(0.0,e.y)));
}
float flowN(vec2 p){ return vnoise(p)*0.65+vnoise(p*2.7+11.3)*0.35; }
// xy = unit flow direction at p, z = local structure strength (0..1).
vec3 flowField(vec2 p, float t){
  vec2 px=1.0/u_resolution;
  vec2 g=flowGrad(p,px*2.0)+flowGrad(p,px*6.0)*0.8+flowGrad(p,px*16.0)*0.6;
  float edge=clamp(length(g)*2.4,0.0,1.0);
  float a=radians(u_direction);
  vec2 wind=vec2(cos(a),-sin(a));
  vec2 tang=normalize(vec2(-g.y,g.x)+vec2(1e-5));
  if(dot(tang,wind)<0.0) tang=-tang;
  vec2 dir=normalize(mix(wind,tang,clamp(edge*u_follow*1.7,0.0,1.0)));
  vec2 q=p*max(u_detail,0.5)+loopDrift(0.35);
  float e2=0.14;
  vec2 curl=vec2(
    flowN(q+vec2(0.0,e2))-flowN(q-vec2(0.0,e2)),
    flowN(q-vec2(e2,0.0))-flowN(q+vec2(e2,0.0)))/(2.0*e2);
  dir=normalize(dir+curl*u_turb*0.8);
  return vec3(dir,edge);
}
// Walk backward along the (curved) field so motion bends around structures.
vec2 flowAdvect(vec2 p, float dist, float t){
  vec2 q=p;
  for(int i=0;i<3;i++){
    vec3 f=flowField(q,t);
    q-=f.xy*(dist/3.0)*mix(1.0,1.0-f.z,u_anchor);
  }
  return q;
}
void main(){
  // Driven by the looping phase so the motion returns exactly to its start.
  float cyc=loopCycles(u_speed);
  float t=loopPhase();
  int mode=int(u_mode+0.5);
  float m=maskAt(v_uv);
  vec3 col=texture(u_tex,clamp(v_uv,0.0,1.0)).rgb;
  if(mode==0){
    float ph1=fract(t*cyc);
    float ph2=fract(t*cyc+0.5);
    vec2 uv1=flowAdvect(v_uv,(ph1-0.5)*2.0*u_amount*m,t);
    vec2 uv2=flowAdvect(v_uv,(ph2-0.5)*2.0*u_amount*m,t);
    float w=abs(ph1*2.0-1.0);
    col=mix(texture(u_tex,clamp(uv1,0.0,1.0)).rgb, texture(u_tex,clamp(uv2,0.0,1.0)).rgb, w);
  } else if(mode==1){
    float ph=flowN(v_uv*2.4)*6.28318;
    float gust=0.55+0.45*sin(loopAngle()*cyc+dot(v_uv,vec2(1.7,1.1))*1.6);
    float s=sin(loopAngle()*cyc+ph)*gust;
    vec2 q=v_uv;
    for(int i=0;i<2;i++){
      vec3 f=flowField(q,t);
      q-=f.xy*u_amount*s*0.5*m*mix(1.0,1.0-f.z,u_anchor);
    }
    col=texture(u_tex,clamp(q,0.0,1.0)).rgb;
  } else if(mode==2){
    // Vortex — swirl around the centre, more at the rim, rocking over the loop.
    vec2 c=v_uv-0.5;
    float ang=u_amount*6.2831*loopSin(u_speed,0.0)*(0.4+length(c))*m;
    float s=sin(ang), co=cos(ang);
    vec2 r=vec2(c.x*co-c.y*s, c.x*s+c.y*co)+0.5;
    vec3 f=flowField(v_uv,t);
    r=mix(r, r+f.xy*u_amount*0.3*loopSin(u_speed,1.5708)*m, u_follow);
    col=texture(u_tex,clamp(r,0.0,1.0)).rgb;
  } else if(mode==3){
    // Pulse — breathe pixels out from / into the centre, bent along the field.
    vec2 dir=v_uv-0.5;
    float pulse=loopSin(u_speed,0.0);
    vec2 disp=normalize(dir+1e-5)*u_amount*pulse*m;
    vec3 f=flowField(v_uv,t);
    disp=mix(disp, f.xy*u_amount*pulse*m, u_follow);
    col=texture(u_tex,clamp(v_uv-disp,0.0,1.0)).rgb;
  } else if(mode==4){
    // Boil — stepped stop-motion jitter in blocky regions (line-boil look).
    float steps=max(2.0,floor(3.0+u_speed*5.0));
    float fr=loopStep(steps);
    vec2 j=hash22(floor(v_uv*max(u_detail,1.0)*10.0)+fr*7.31)-0.5;
    vec3 f=flowField(v_uv,t);
    vec2 disp=mix(j*2.0, f.xy, u_follow)*u_amount*m;
    col=texture(u_tex,clamp(v_uv+disp,0.0,1.0)).rgb;
  } else if(mode==5){
    // Ripple — concentric waves emanating from the centre.
    vec2 c=v_uv-0.5;
    float wave=sin(length(c)*(8.0+u_detail*4.0)-loopAngle()*cyc);
    vec2 dir=normalize(c+1e-5);
    vec2 disp=dir*wave*u_amount*0.4*m;
    vec3 f=flowField(v_uv,t);
    disp=mix(disp, f.xy*wave*u_amount*0.4*m, u_follow*0.6);
    col=texture(u_tex,clamp(v_uv+disp,0.0,1.0)).rgb;
  }
  if(u_show>0.5){
    vec3 f=flowField(v_uv,t);
    col=mix(col, vec3(f.xy*0.5+0.5, f.z)*max(m,0.08), 0.85);
  }
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "blobtracker",
    name: "Blob Tracker",
    category: "Distort",
    animatable: true,
    usesMask: true,
    params: [
      { key: "count", label: "Trackers", type: "range", min: 1, max: 6, step: 1, default: 3 },
      { key: "tracking", label: "Tracking", type: "range", min: 0, max: 1.5, step: 0.01, default: 0.8 },
      {
        key: "target",
        label: "Target",
        type: "select",
        options: [
          { label: "Bright Areas", value: 0 },
          { label: "Dark Areas", value: 1 },
        ],
        default: 0,
      },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.7 },
      { key: "radius", label: "Radius", type: "range", min: 0.05, max: 0.6, step: 0.01, default: 0.25 },
      { key: "strength", label: "Strength", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
      {
        key: "mode",
        label: "Motion",
        type: "select",
        options: [
          { label: "Pull", value: 0 },
          { label: "Push", value: 1 },
          { label: "Swirl", value: 2 },
          { label: "Lens", value: 3 },
        ],
        default: 0,
      },
      { key: "show", label: "Show Trackers", type: "bool", default: false },
    ],
    // Each tracker wanders on a smooth noise path, then mean-shifts toward
    // bright (or dark) content in u_tex — so the motion follows the image.
    // The painted motion mask both weights where trackers settle and gates
    // the displacement they produce.
    frag: `float blobWeight(vec2 p){
  float l=luma(texture(u_tex, clamp(p,0.0,1.0)).rgb);
  l=mix(l, 1.0-l, clamp(u_target,0.0,1.0));
  return l*l*l*(0.05+0.95*maskAt(p));
}
vec2 blobPos(float i, float t){
  vec2 seed=hash22(vec2(i*7.31+1.7, i*3.77+9.2));
  // Orbit a circle so the wander path returns to its start each loop.
  float a=loopAngle()*loopCycles(u_speed);
  vec2 orb=vec2(cos(a),sin(a))*0.55;
  vec2 p=vec2(
    0.5+0.36*(vnoise(vec2(orb.x+i*17.3, i*4.7+seed.x*8.0))*2.0-1.0),
    0.5+0.36*(vnoise(vec2(i*9.13+seed.y*8.0, orb.y+i*6.1))*2.0-1.0));
  for(int s=0;s<3;s++){
    vec2 shift=vec2(0.0); float wsum=1e-4;
    float rad=0.09-0.022*float(s);
    for(int k=0;k<6;k++){
      float a=6.28318*(float(k)+0.5)/6.0+float(s)*0.55;
      vec2 o=vec2(cos(a),sin(a))*rad;
      float w=blobWeight(p+o);
      shift+=o*w; wsum+=w;
    }
    p=clamp(p+shift/wsum*u_tracking, 0.04, 0.96);
  }
  return p;
}
void main(){
  float t=loopPhase();
  float n=clamp(floor(u_count+0.5),1.0,6.0);
  int mode=int(u_mode+0.5);
  vec2 asp=vec2(u_resolution.x/max(1.0,u_resolution.y),1.0);
  vec2 disp=vec2(0.0); float ring=0.0;
  for(int i=0;i<6;i++){
    if(float(i)>=n) break;
    vec2 bp=blobPos(float(i), t);
    vec2 d=(v_uv-bp)*asp;
    float dist=length(d);
    float fall=smoothstep(u_radius,0.0,dist); fall*=fall;
    if(mode==0){ disp+=(bp-v_uv)*fall*u_strength; }
    else if(mode==1){ disp-=(bp-v_uv)*fall*u_strength; }
    else if(mode==2){
      float ang=u_strength*4.0*fall;
      float s_=sin(ang), c_=cos(ang);
      disp+=(vec2(d.x*c_-d.y*s_, d.x*s_+d.y*c_)-d)/asp;
    } else {
      float k=(1.0-fall)*fall;
      disp+=d/asp*k*u_strength*1.5;
    }
    if(u_show>0.5){
      ring+=smoothstep(0.006,0.0,abs(dist-u_radius*0.35));
      ring+=smoothstep(0.005,0.0,dist-0.006);
    }
  }
  vec3 col=texture(u_tex, clamp(v_uv+disp*maskAt(v_uv),0.0,1.0)).rgb;
  col=mix(col, vec3(1.0,0.35,0.65), clamp(ring,0.0,1.0)*0.85);
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "jelly",
    name: "Jelly",
    category: "Distort",
    animatable: true,
    usesMask: true,
    params: [
      { key: "speed", label: "Speed", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
      { key: "morph", label: "Morph", type: "range", min: 0, max: 0.3, step: 0.005, default: 0.12 },
      { key: "wobble", label: "Wobble", type: "range", min: 0, max: 0.2, step: 0.005, default: 0.05 },
      { key: "scale", label: "Blob Scale", type: "range", min: 1, max: 10, step: 0.1, default: 3 },
      { key: "spin", label: "Spin", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
      { key: "roundness", label: "Roundness", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "blur", label: "Blur", type: "range", min: 0, max: 1, step: 0.01, default: 0.3 },
      { key: "bubbles", label: "Bubble Lines", type: "range", min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: "thickness", label: "Line Thickness", type: "range", min: 0.5, max: 4, step: 0.1, default: 1.2 },
      { key: "shine", label: "Shine", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: "colormix", label: "Colour Blend", type: "range", min: 0, max: 1, step: 0.01, default: 0.6 },
      { key: "col1", label: "Blob 1", type: "color", default: "#00e5ff" },
      { key: "col2", label: "Blob 2", type: "color", default: "#ff2bd6" },
      { key: "col3", label: "Blob 3", type: "color", default: "#7c5cff" },
      { key: "col4", label: "Blob 4", type: "color", default: "#7cff5a" },
    ],
    // Liquid "jelly" warp: a slow large-scale curl-noise field MORPHS the whole
    // image while a faster, finer field adds a WOBBLE on top — like looking through
    // wobbling water. The field morphs continuously (no back-and-forth); Spin adds
    // an optional circular drift on top (0 = pure in-place morph). Four drifting
    // colour blobs blend as a moving
    // gradient (metaballs) and tint the image, the bubble contour lines and the
    // specular shine; Roundness sets how soft/round those blobs are. The image can
    // be partially blurred so it reads soft, slimy and refractive. Loops seamlessly.
    frag: `// Seamless continuously-morphing noise: each octave samples on its own orbiting
// path (offset phase), so the field keeps evolving in place — no back-and-forth,
// no coherent sliding — and returns exactly to its start each loop.
float loopFbm(vec2 p, float ph){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){
    vec2 o=vec2(cos(ph+float(i)*1.7), sin(ph+float(i)*1.7))*0.5;
    v+=a*vnoise(p+o);
    p*=2.0; a*=0.5;
  }
  return v;
}
float hgt(vec2 p, float ph){ return loopFbm(p, ph); }
vec2 grd(vec2 p, float ph){
  float e=0.08;
  return vec2(hgt(p+vec2(e,0.0),ph)-hgt(p-vec2(e,0.0),ph),
              hgt(p+vec2(0.0,e),ph)-hgt(p-vec2(0.0,e),ph))/(2.0*e);
}
// Clean circular orbit, returning to its start each loop — used for the colour
// blobs, and (scaled by Spin) to add an optional coherent drift on top.
vec2 drift(float ang, float r){ return vec2(cos(ang),sin(ang))*r; }
vec2 blobPos(int i){
  float fi=float(i);
  vec2 seed=hash22(vec2(fi*3.1+1.0, fi*7.7+2.0));
  float ang=loopAngle()*loopCycles(u_speed)+fi*1.9;
  return clamp(0.25+seed*0.5 + drift(ang, 0.16+0.12*seed.x), 0.0, 1.0);
}
vec3 blurTex(vec2 uv, float amt){
  vec3 c=texture(u_tex,clamp(uv,0.0,1.0)).rgb;
  if(amt<=0.001) return c;
  float r=amt*0.012;
  vec3 s=c*0.296;
  s+=texture(u_tex,clamp(uv+vec2(r,0.0),0.0,1.0)).rgb*0.176;
  s+=texture(u_tex,clamp(uv-vec2(r,0.0),0.0,1.0)).rgb*0.176;
  s+=texture(u_tex,clamp(uv+vec2(0.0,r),0.0,1.0)).rgb*0.176;
  s+=texture(u_tex,clamp(uv-vec2(0.0,r),0.0,1.0)).rgb*0.176;
  return s;
}
void main(){
  float m=maskAt(v_uv);
  float cyc=loopCycles(u_speed);
  float ang=loopAngle()*cyc;
  // The field morphs continuously via the looping noise above (never reverses).
  // Spin optionally adds a coherent circular drift on top (0 = pure in-place morph).
  vec2 d=drift(ang, 0.4)*u_spin;
  vec2 q1=v_uv*u_scale + d;
  vec2 q2=v_uv*u_scale*2.7 + d*0.5;
  vec2 g1=grd(q1, ang);      vec2 morph=vec2(g1.y,-g1.x);   // curl = swirly, incompressible
  vec2 g2=grd(q2, ang*2.0);  vec2 wob=vec2(g2.y,-g2.x);
  vec2 disp=(morph*u_morph + wob*u_wobble)*m;
  vec2 buv=v_uv+disp;
  vec3 img=blurTex(buv, u_blur*m);
  // Moving multi-colour gradient from 4 drifting blobs (metaball weighting).
  vec3 cols[4]=vec3[4](u_col1,u_col2,u_col3,u_col4);
  float rad=mix(0.12,0.45,u_roundness);
  vec3 acc=vec3(0.0); float wsum=1e-4;
  for(int i=0;i<4;i++){
    float bw=exp(-pow(distance(buv,blobPos(i)),2.0)/(rad*rad));
    acc+=cols[i]*bw; wsum+=bw;
  }
  vec3 blobCol=acc/wsum;
  // Height field → bubble contour lines + surface shine.
  float h=hgt(q1, ang)+0.5*hgt(q2, ang*2.0);
  float dens=u_scale*1.5;
  float rings=fract(h*dens);
  float dd=min(rings,1.0-rings);
  float w=fwidth(h*dens)*u_thickness+1e-4;
  float line=1.0-smoothstep(0.0,w,dd);
  vec3 nrm=normalize(vec3(-(g1+g2*0.5),1.0));
  float spec=pow(clamp(dot(nrm,normalize(vec3(0.4,0.6,0.8))),0.0,1.0),24.0);
  // Iridescent tint, colour-blended bubble lines, glossy shine.
  vec3 col=mix(img, mix(img*blobCol*1.6, blobCol, 0.35), u_colormix*m);
  col=mix(col, blobCol+vec3(0.12), line*u_bubbles*m);
  col+=(blobCol*0.5+0.5)*spec*u_shine*m;
  fragColor=vec4(clamp(col,0.0,1.0),1.0);
}`,
  },
  {
    id: "zoomblur",
    name: "Zoom Blur",
    category: "Blur",
    animatable: false,
    params: [
      { key: "strength", label: "Strength", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; vec3 sum=vec3(0.0);
  for(int i=0;i<12;i++){ float t=float(i)/11.0; float sc=1.0 - u_strength*t*0.3;
    sum+=texture(u_tex, c*sc+0.5).rgb; }
  fragColor=vec4(sum/12.0,1.0);
}`,
  },
  {
    id: "blur",
    name: "Box Blur",
    category: "Blur",
    animatable: false,
    params: [
      { key: "radius", label: "Radius", type: "range", min: 0, max: 8, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  vec2 px=u_radius/u_resolution; vec3 s=vec3(0.0);
  for(int x=-2;x<=2;x++){ for(int y=-2;y<=2;y++){ s+=texture(u_tex,v_uv+vec2(float(x),float(y))*px).rgb; }}
  fragColor=vec4(s/25.0,1.0);
}`,
  },
  {
    id: "sharpen",
    name: "Sharpen",
    category: "Blur",
    animatable: false,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
    ],
    frag: `void main(){
  vec2 px=1.0/u_resolution; vec3 c=texture(u_tex,v_uv).rgb;
  vec3 n=texture(u_tex,v_uv+vec2(px.x,0.0)).rgb+texture(u_tex,v_uv-vec2(px.x,0.0)).rgb
        +texture(u_tex,v_uv+vec2(0.0,px.y)).rgb+texture(u_tex,v_uv-vec2(0.0,px.y)).rgb;
  fragColor=vec4(clamp(c+(c*4.0-n)*u_amount*0.25,0.0,1.0),1.0);
}`,
  },

  // ── Stylize ──────────────────────────────────────────────────────────────
  {
    id: "emboss",
    name: "Emboss",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "strength", label: "Strength", type: "range", min: 0, max: 5, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  vec2 px=1.0/u_resolution;
  vec3 a=texture(u_tex,v_uv-px).rgb; vec3 b=texture(u_tex,v_uv+px).rgb;
  float e=0.5+(luma(b)-luma(a))*u_strength;
  fragColor=vec4(vec3(e),1.0);
}`,
  },
  {
    id: "edges",
    name: "Edge Detect",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "thickness", label: "Thickness", type: "range", min: 0.5, max: 4, step: 0.1, default: 1 },
      { key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 1 },
    ],
    frag: `void main(){
  vec2 px=u_thickness/u_resolution;
  float tl=luma(texture(u_tex,v_uv+vec2(-px.x,px.y)).rgb);
  float l =luma(texture(u_tex,v_uv+vec2(-px.x,0.0)).rgb);
  float bl=luma(texture(u_tex,v_uv+vec2(-px.x,-px.y)).rgb);
  float t =luma(texture(u_tex,v_uv+vec2(0.0,px.y)).rgb);
  float b =luma(texture(u_tex,v_uv+vec2(0.0,-px.y)).rgb);
  float tr=luma(texture(u_tex,v_uv+vec2(px.x,px.y)).rgb);
  float r =luma(texture(u_tex,v_uv+vec2(px.x,0.0)).rgb);
  float br=luma(texture(u_tex,v_uv+vec2(px.x,-px.y)).rgb);
  float gx=-tl-2.0*l-bl+tr+2.0*r+br;
  float gy=tl+2.0*t+tr-bl-2.0*b-br;
  float g=length(vec2(gx,gy));
  fragColor=vec4(mix(texture(u_tex,v_uv).rgb, vec3(g), u_mix),1.0);
}`,
  },
  {
    id: "crosshatch",
    name: "Crosshatch",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "density", label: "Density", type: "range", min: 4, max: 40, step: 1, default: 12 },
    ],
    frag: `void main(){
  float l=luma(texture(u_tex,v_uv).rgb);
  vec2 p=v_uv*u_resolution; float c=1.0;
  if(l<0.8 && mod(p.x+p.y, u_density)<1.5) c=0.0;
  if(l<0.6 && mod(p.x-p.y, u_density)<1.5) c=0.0;
  if(l<0.4 && mod(p.x+p.y, u_density*0.5)<1.5) c=0.0;
  if(l<0.2 && mod(p.x-p.y, u_density*0.5)<1.5) c=0.0;
  fragColor=vec4(vec3(c),1.0);
}`,
  },
  {
    id: "dither",
    name: "Ordered Dither",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "levels", label: "Levels", type: "range", min: 2, max: 8, step: 1, default: 3 },
    ],
    frag: `void main(){
  float bayer[16]=float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);
  ivec2 p=ivec2(mod(v_uv*u_resolution, 4.0));
  float th=(bayer[p.y*4+p.x]+0.5)/16.0;
  vec3 c=texture(u_tex,v_uv).rgb;
  float n=max(2.0,floor(u_levels));
  fragColor=vec4(floor(c*(n-1.0)+th)/(n-1.0),1.0);
}`,
  },
  {
    id: "dither8",
    name: "Bayer 8×8",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "size", label: "Pixel Size", type: "range", min: 1, max: 16, step: 1, default: 2 },
      { key: "levels", label: "Levels", type: "range", min: 2, max: 8, step: 1, default: 4 },
      { key: "mono", label: "Monochrome", type: "bool", default: false },
    ],
    // A finer 8×8 ordered (Bayer) dither — crisp, even, classic "pixel-art print".
    frag: `void main(){
  float b[64]=float[64](
   0.,32., 8.,40., 2.,34.,10.,42.,
  48.,16.,56.,24.,50.,18.,58.,26.,
  12.,44., 4.,36.,14.,46., 6.,38.,
  60.,28.,52.,20.,62.,30.,54.,22.,
   3.,35.,11.,43., 1.,33., 9.,41.,
  51.,19.,59.,27.,49.,17.,57.,25.,
  15.,47., 7.,39.,13.,45., 5.,37.,
  63.,31.,55.,23.,61.,29.,53.,21.);
  float px=max(1.0,floor(u_size));
  vec2 cell=floor(v_uv*u_resolution/px);
  vec2 suv=(cell*px+px*0.5)/u_resolution;
  vec3 c=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  if(u_mono>0.5) c=vec3(luma(c));
  ivec2 p=ivec2(mod(cell,8.0));
  float th=(b[p.y*8+p.x]+0.5)/64.0;
  float n=max(2.0,floor(u_levels));
  fragColor=vec4(floor(c*(n-1.0)+th)/(n-1.0),1.0);
}`,
  },
  {
    id: "onebit",
    name: "1-Bit",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "scale", label: "Pixel Size", type: "range", min: 1, max: 16, step: 1, default: 3 },
      { key: "contrast", label: "Contrast", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: "ink", label: "Ink", type: "color", default: "#0b0f1a" },
      { key: "paper", label: "Paper", type: "color", default: "#e8e6dc" },
    ],
    // Two-tone Bayer threshold — the Playdate / Obra Dinn / 1-bit zine look.
    frag: `void main(){
  float b[64]=float[64](
   0.,32., 8.,40., 2.,34.,10.,42.,
  48.,16.,56.,24.,50.,18.,58.,26.,
  12.,44., 4.,36.,14.,46., 6.,38.,
  60.,28.,52.,20.,62.,30.,54.,22.,
   3.,35.,11.,43., 1.,33., 9.,41.,
  51.,19.,59.,27.,49.,17.,57.,25.,
  15.,47., 7.,39.,13.,45., 5.,37.,
  63.,31.,55.,23.,61.,29.,53.,21.);
  float px=max(1.0,floor(u_scale));
  vec2 cell=floor(v_uv*u_resolution/px);
  vec2 suv=(cell*px+px*0.5)/u_resolution;
  float l=luma(texture(u_tex,clamp(suv,0.0,1.0)).rgb);
  l=clamp((l-0.5)*(1.0+u_contrast*4.0)+0.5,0.0,1.0);
  ivec2 p=ivec2(mod(cell,8.0));
  float th=(b[p.y*8+p.x]+0.5)/64.0;
  float bit=step(th,l);
  fragColor=vec4(mix(u_ink,u_paper,bit),1.0);
}`,
  },
  {
    id: "bluenoise",
    name: "Blue-Noise Dither",
    category: "Stylize",
    animatable: true,
    params: [
      { key: "size", label: "Pixel Size", type: "range", min: 1, max: 12, step: 1, default: 2 },
      { key: "levels", label: "Levels", type: "range", min: 2, max: 8, step: 1, default: 3 },
      { key: "anim", label: "Shimmer", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
      { key: "mono", label: "Monochrome", type: "bool", default: false },
    ],
    // Organic stochastic dither via interleaved-gradient noise — soft filmic grain
    // instead of a rigid grid. Shimmer steps the noise per frame (and loops) for a
    // living-static look.
    frag: `float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
void main(){
  float px=max(1.0,floor(u_size));
  vec2 cell=floor(v_uv*u_resolution/px);
  vec2 suv=(cell*px+px*0.5)/u_resolution;
  vec3 c=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  if(u_mono>0.5) c=vec3(luma(c));
  float sh=loopStep(floor(u_anim*16.0)+1.0);
  float th=ign(cell+vec2(sh*13.0, sh*7.0));
  float n=max(2.0,floor(u_levels));
  fragColor=vec4(floor(c*(n-1.0)+th)/(n-1.0),1.0);
}`,
  },
  {
    id: "ascii",
    name: "ASCII",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "size", label: "Cell Size", type: "range", min: 4, max: 24, step: 1, default: 8 },
      { key: "color", label: "Colour", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
      { key: "ink", label: "Ink", type: "color", default: "#c8ff32" },
      { key: "paper", label: "Paper", type: "color", default: "#05060a" },
    ],
    // Luminance → glyph terminal/ASCII art. A 5×5 bitmap font is packed per
    // character (movAX13h's classic bit-test technique). Colour blends each glyph
    // toward its cell's source colour for a vaporwave-ASCII look.
    frag: `precision highp int;
float chr(int n, vec2 p){
  p=floor(p*vec2(4.0,-4.0)+2.5);
  if(clamp(p.x,0.0,4.0)==p.x && clamp(p.y,0.0,4.0)==p.y){
    int a=int(round(p.x)+5.0*round(p.y));
    if(((n>>a)&1)==1) return 1.0;
  }
  return 0.0;
}
void main(){
  float cs=max(4.0,floor(u_size));
  vec2 pix=v_uv*u_resolution;
  vec2 cell=floor(pix/cs);
  vec2 suv=(cell+0.5)*cs/u_resolution;
  vec3 col=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  float g=luma(col);
  int n=4096;
  if(g>0.2) n=65600;
  if(g>0.3) n=163153;
  if(g>0.4) n=15255086;
  if(g>0.5) n=13121101;
  if(g>0.6) n=15252014;
  if(g>0.7) n=13195790;
  if(g>0.8) n=11512810;
  vec2 p=fract(pix/cs)-0.5;
  float ch=chr(n,p);
  vec3 glyph=mix(u_ink,col,u_color);
  fragColor=vec4(mix(u_paper,glyph,ch),1.0);
}`,
  },
  {
    id: "riso",
    name: "Risograph",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "scale", label: "Dot Size", type: "range", min: 2, max: 16, step: 0.5, default: 5 },
      { key: "angle", label: "Screen Angle", type: "range", min: 0, max: 90, step: 1, default: 15 },
      { key: "grain", label: "Grain", type: "range", min: 0, max: 1, step: 0.01, default: 0.25 },
      { key: "ink1", label: "Ink 1", type: "color", default: "#ff3da6" },
      { key: "ink2", label: "Ink 2", type: "color", default: "#3a6bff" },
      { key: "paper", label: "Paper", type: "color", default: "#f3efe3" },
    ],
    // Two-ink halftone print (Risograph / zine aesthetic): each ink is screened on
    // its own rotated dot grid with a touch of misregistration and paper grain.
    // Inks multiply over the paper, so overlaps darken like real overprint.
    frag: `float dotScreen(vec2 uv, float ang, float scale, float cov){
  float c=cos(ang), s=sin(ang);
  mat2 R=mat2(c,-s,s,c);
  vec2 g=R*(uv*u_resolution)/scale;
  vec2 f=fract(g)-0.5;
  float r=sqrt(clamp(cov,0.0,1.0))*0.72;
  return 1.0 - smoothstep(r-0.06, r+0.06, length(f));
}
void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  float a1=radians(u_angle);
  float a2=radians(u_angle+37.0);
  float c1=clamp(1.0-col.g,0.0,1.0);
  float c2=clamp(1.0-col.r,0.0,1.0);
  vec2 mis=1.5/u_resolution;
  float i1=dotScreen(v_uv+mis, a1, u_scale, c1);
  float i2=dotScreen(v_uv-mis, a2, u_scale, c2);
  vec3 c=u_paper;
  c*=mix(vec3(1.0), u_ink1, i1);
  c*=mix(vec3(1.0), u_ink2, i2);
  float gr=(hash21(v_uv*u_resolution)-0.5)*u_grain*0.18;
  fragColor=vec4(clamp(c+gr,0.0,1.0),1.0);
}`,
  },
  {
    id: "palettedither",
    name: "Palette Dither",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "size", label: "Pixel Size", type: "range", min: 1, max: 16, step: 1, default: 3 },
      { key: "spread", label: "Spread", type: "range", min: 0, max: 0.6, step: 0.01, default: 0.18 },
      { key: "c1", label: "Colour 1", type: "color", default: "#1a1c2c" },
      { key: "c2", label: "Colour 2", type: "color", default: "#5d275d" },
      { key: "c3", label: "Colour 3", type: "color", default: "#ef7d57" },
      { key: "c4", label: "Colour 4", type: "color", default: "#ffcd75" },
    ],
    // Locks the image to a 4-colour palette with ordered dithering between the
    // nearest entries — the Lospec / PICO-8 pixel-art look. Defaults are a moody
    // sunset ramp; swap in any palette.
    frag: `void main(){
  float b[64]=float[64](
   0.,32., 8.,40., 2.,34.,10.,42.,
  48.,16.,56.,24.,50.,18.,58.,26.,
  12.,44., 4.,36.,14.,46., 6.,38.,
  60.,28.,52.,20.,62.,30.,54.,22.,
   3.,35.,11.,43., 1.,33., 9.,41.,
  51.,19.,59.,27.,49.,17.,57.,25.,
  15.,47., 7.,39.,13.,45., 5.,37.,
  63.,31.,55.,23.,61.,29.,53.,21.);
  float px=max(1.0,floor(u_size));
  vec2 cell=floor(v_uv*u_resolution/px);
  vec2 suv=(cell*px+px*0.5)/u_resolution;
  vec3 c=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  ivec2 p=ivec2(mod(cell,8.0));
  float th=(b[p.y*8+p.x]+0.5)/64.0-0.5;
  vec3 t=clamp(c+th*u_spread,0.0,1.0);
  vec3 pal[4]=vec3[4](u_c1,u_c2,u_c3,u_c4);
  float bd=1e9; vec3 best=pal[0];
  for(int i=0;i<4;i++){ float d=distance(t,pal[i]); if(d<bd){bd=d;best=pal[i];} }
  fragColor=vec4(best,1.0);
}`,
  },
  {
    id: "kuwahara",
    name: "Oil Paint",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "radius", label: "Brush", type: "range", min: 1, max: 6, step: 1, default: 3 },
    ],
    // Kuwahara filter: for each pixel, look at four overlapping quadrants and keep
    // the mean colour of whichever is flattest (lowest variance). Smears flat areas
    // into painterly strokes while preserving edges — the modern "oil painting" look.
    frag: `void main(){
  int r=int(floor(u_radius)+0.5);
  vec2 px=1.0/u_resolution;
  vec3 s[4]; vec3 sq[4]; float cnt[4];
  for(int i=0;i<4;i++){ s[i]=vec3(0.0); sq[i]=vec3(0.0); cnt[i]=0.0; }
  for(int y=-6;y<=6;y++){
    for(int x=-6;x<=6;x++){
      if(abs(x)>r||abs(y)>r) continue;
      vec3 c=texture(u_tex, clamp(v_uv+vec2(float(x),float(y))*px,0.0,1.0)).rgb;
      vec3 cc=c*c;
      if(x<=0&&y<=0){ s[0]+=c; sq[0]+=cc; cnt[0]+=1.0; }
      if(x>=0&&y<=0){ s[1]+=c; sq[1]+=cc; cnt[1]+=1.0; }
      if(x<=0&&y>=0){ s[2]+=c; sq[2]+=cc; cnt[2]+=1.0; }
      if(x>=0&&y>=0){ s[3]+=c; sq[3]+=cc; cnt[3]+=1.0; }
    }
  }
  vec3 best=vec3(0.0); float bv=1e9;
  for(int i=0;i<4;i++){
    vec3 m=s[i]/max(cnt[i],1.0);
    float v=dot(sq[i]/max(cnt[i],1.0)-m*m, vec3(1.0));
    if(v<bv){ bv=v; best=m; }
  }
  fragColor=vec4(best,1.0);
}`,
  },
  {
    id: "ledpanel",
    name: "LED Panel",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "cells", label: "Density", type: "range", min: 8, max: 140, step: 1, default: 56 },
      { key: "gap", label: "Gap", type: "range", min: 0, max: 0.7, step: 0.01, default: 0.25 },
      { key: "glow", label: "Glow", type: "range", min: 0, max: 1, step: 0.01, default: 0.35 },
    ],
    // The image as a grid of round LEDs on a black panel (stadium / arcade marquee),
    // each lit by its cell's colour, with a soft glow halo around bright ones.
    frag: `void main(){
  float a=u_resolution.x/max(1.0,u_resolution.y);
  vec2 nc=vec2(floor(u_cells), max(1.0,floor(u_cells/a)));
  vec2 g=v_uv*nc;
  vec2 cell=floor(g);
  vec2 f=fract(g)-0.5;
  vec2 suv=(cell+0.5)/nc;
  vec3 col=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  float d=length(f);
  float rad=0.5*(1.0-clamp(u_gap,0.0,0.95));
  float led=1.0-smoothstep(rad-0.05, rad+0.05, d);
  vec3 c=col*led + col*u_glow*exp(-d*6.0);
  fragColor=vec4(c,1.0);
}`,
  },
  {
    id: "topo",
    name: "Topographic",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "bands", label: "Lines", type: "range", min: 3, max: 24, step: 1, default: 10 },
      { key: "thickness", label: "Thickness", type: "range", min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { key: "fill", label: "Fill", type: "range", min: 0, max: 1, step: 0.01, default: 0.7 },
      { key: "low", label: "Low", type: "color", default: "#06283d" },
      { key: "high", label: "High", type: "color", default: "#47e0c8" },
      { key: "ink", label: "Lines Colour", type: "color", default: "#dffcff" },
    ],
    // Quantises brightness into elevation bands and draws crisp contour lines along
    // the boundaries — a topographic / data-map look. Fill blends the original
    // image toward a two-colour elevation ramp.
    frag: `void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  float l=luma(col);
  float bands=max(2.0,floor(u_bands));
  float scaled=l*bands;
  float fr=fract(scaled);
  float d=min(fr,1.0-fr);
  float w=fwidth(scaled)*u_thickness;
  float line=1.0-smoothstep(0.0, max(w,1e-4), d);
  float lvl=floor(scaled)/max(1.0,bands-1.0);
  vec3 banded=mix(u_low,u_high,clamp(lvl,0.0,1.0));
  vec3 base=mix(col, banded, u_fill);
  fragColor=vec4(mix(base, u_ink, line),1.0);
}`,
  },
  {
    id: "comic",
    name: "Comic",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "levels", label: "Colour Steps", type: "range", min: 2, max: 8, step: 1, default: 4 },
      { key: "edge", label: "Ink Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.28 },
      { key: "inkamt", label: "Ink", type: "range", min: 0, max: 1, step: 0.01, default: 1 },
      { key: "ink", label: "Ink Colour", type: "color", default: "#0a0a12" },
    ],
    // Cel / comic shading: posterise the colour into flat bands, then lay inked
    // Sobel outlines over the edges — manga / toon look.
    frag: `void main(){
  vec2 px=1.0/u_resolution;
  vec3 c=texture(u_tex,v_uv).rgb;
  float n=max(2.0,floor(u_levels));
  vec3 q=floor(c*(n-1.0)+0.5)/(n-1.0);
  float tl=luma(texture(u_tex,v_uv+px*vec2(-1.0,-1.0)).rgb);
  float t =luma(texture(u_tex,v_uv+px*vec2( 0.0,-1.0)).rgb);
  float tr=luma(texture(u_tex,v_uv+px*vec2( 1.0,-1.0)).rgb);
  float lf=luma(texture(u_tex,v_uv+px*vec2(-1.0, 0.0)).rgb);
  float rt=luma(texture(u_tex,v_uv+px*vec2( 1.0, 0.0)).rgb);
  float bl=luma(texture(u_tex,v_uv+px*vec2(-1.0, 1.0)).rgb);
  float bt=luma(texture(u_tex,v_uv+px*vec2( 0.0, 1.0)).rgb);
  float br=luma(texture(u_tex,v_uv+px*vec2( 1.0, 1.0)).rgb);
  float gx=-tl-2.0*lf-bl+tr+2.0*rt+br;
  float gy=-tl-2.0*t-tr+bl+2.0*bt+br;
  float e=length(vec2(gx,gy));
  float ink=smoothstep(u_edge, u_edge+0.15, e);
  fragColor=vec4(mix(q, u_ink, ink*u_inkamt),1.0);
}`,
  },
  {
    id: "hexmosaic",
    name: "Hex Mosaic",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "size", label: "Density", type: "range", min: 3, max: 60, step: 1, default: 22 },
      { key: "gap", label: "Honeycomb", type: "range", min: 0, max: 0.45, step: 0.01, default: 0 },
    ],
    // Hexagonal pixelation — samples each hex cell's centre colour. Honeycomb adds
    // dark gaps between cells for a tiled, stained-glass feel.
    frag: `vec2 hexCenter(vec2 p){
  vec2 r=vec2(1.0, 1.7320508);
  vec2 hh=r*0.5;
  vec2 a=mod(p,r)-hh;
  vec2 b=mod(p-hh,r)-hh;
  return dot(a,a)<dot(b,b) ? p-a : p-b;
}
float hexDist(vec2 p){ p=abs(p); return max(p.x*0.8660254+p.y*0.5, p.y); }
void main(){
  float aspect=u_resolution.x/max(1.0,u_resolution.y);
  vec2 scale=vec2(floor(u_size)*aspect, floor(u_size));
  vec2 p=v_uv*scale;
  vec2 ctr=hexCenter(p);
  vec2 suv=ctr/scale;
  vec3 col=texture(u_tex,clamp(suv,0.0,1.0)).rgb;
  float edge=smoothstep(0.5-u_gap-0.02, 0.5-u_gap, hexDist(p-ctr));
  col*=1.0-edge*step(0.001,u_gap);
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "crystallize",
    name: "Crystallize",
    category: "Stylize",
    animatable: false,
    params: [
      { key: "scale", label: "Cells", type: "range", min: 4, max: 60, step: 1, default: 18 },
    ],
    frag: `void main(){
  vec2 uv=v_uv*u_scale; vec2 g=floor(uv); vec2 f=fract(uv);
  float md=8.0; vec2 mp=vec2(0.0);
  for(int y=-1;y<=1;y++){ for(int x=-1;x<=1;x++){
    vec2 o=vec2(float(x),float(y)); vec2 h=hash22(g+o); vec2 r=o+h-f; float d=dot(r,r);
    if(d<md){ md=d; mp=g+o+h; } }}
  fragColor=texture(u_tex, clamp(mp/u_scale,0.0,1.0));
}`,
  },
  {
    id: "badtv",
    name: "Bad TV",
    category: "Stylize",
    animatable: true,
    params: [
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  vec2 uv=v_uv;
  float jitter=(hash21(vec2(floor(uv.y*80.0), loopStep(u_speed*15.0*u_duration)))-0.5)*u_intensity*0.1;
  uv.x+=jitter;
  vec3 col;
  col.r=texture(u_tex,uv+vec2(0.01*u_intensity,0.0)).r;
  col.g=texture(u_tex,uv).g;
  col.b=texture(u_tex,uv-vec2(0.01*u_intensity,0.0)).b;
  float n=hash21(uv*u_resolution.y + loopStep(u_duration*24.0)*9.0+1.0);
  col+=(n-0.5)*u_intensity*0.3;
  col*=0.9+0.1*sin(uv.y*u_resolution.y*0.5);
  fragColor=vec4(col,1.0);
}`,
  },

  // ── Color (extended) ──────────────────────────────────────────────────────
  {
    id: "invert",
    name: "Invert",
    category: "Color",
    animatable: false,
    params: [{ key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 1 }],
    frag: `void main(){ vec3 c=texture(u_tex,v_uv).rgb; fragColor=vec4(mix(c,1.0-c,u_mix),1.0); }`,
  },
  {
    id: "sepia",
    name: "Sepia",
    category: "Color",
    animatable: false,
    params: [{ key: "amount", label: "Amount", type: "range", min: 0, max: 1, step: 0.01, default: 1 }],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb; float l=luma(c);
  vec3 s=clamp(vec3(l)*vec3(1.2,1.0,0.8),0.0,1.0);
  fragColor=vec4(mix(c,s,u_amount),1.0);
}`,
  },
  {
    id: "solarize",
    name: "Solarize",
    category: "Color",
    animatable: false,
    params: [{ key: "threshold", label: "Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 }],
    frag: `void main(){ vec3 c=texture(u_tex,v_uv).rgb; fragColor=vec4(mix(c,1.0-c,step(u_threshold,c)),1.0); }`,
  },
  {
    id: "temperature",
    name: "Temperature",
    category: "Color",
    animatable: false,
    params: [{ key: "temp", label: "Warm / Cool", type: "range", min: -1, max: 1, step: 0.01, default: 0 }],
    frag: `void main(){ vec3 c=texture(u_tex,v_uv).rgb; c.r+=u_temp*0.2; c.b-=u_temp*0.2; fragColor=vec4(clamp(c,0.0,1.0),1.0); }`,
  },
  {
    id: "vibrance",
    name: "Vibrance",
    category: "Color",
    animatable: false,
    params: [{ key: "amount", label: "Amount", type: "range", min: -1, max: 1, step: 0.01, default: 0.4 }],
    frag: `void main(){
  vec3 hsv=rgb2hsv(texture(u_tex,v_uv).rgb);
  hsv.y=clamp(hsv.y + u_amount*(1.0-hsv.y),0.0,1.0);
  fragColor=vec4(hsv2rgb(hsv),1.0);
}`,
  },
  {
    id: "gamma",
    name: "Gamma",
    category: "Color",
    animatable: false,
    params: [{ key: "gamma", label: "Gamma", type: "range", min: 0.2, max: 3, step: 0.01, default: 1 }],
    frag: `void main(){ vec3 c=texture(u_tex,v_uv).rgb; fragColor=vec4(pow(c, vec3(1.0/max(0.01,u_gamma))),1.0); }`,
  },
  {
    id: "levels",
    name: "Levels",
    category: "Color",
    animatable: false,
    params: [
      { key: "black", label: "Black Point", type: "range", min: 0, max: 0.9, step: 0.01, default: 0 },
      { key: "white", label: "White Point", type: "range", min: 0.1, max: 1, step: 0.01, default: 1 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb; float hi=max(u_black+0.01,u_white);
  fragColor=vec4(clamp((c-u_black)/(hi-u_black),0.0,1.0),1.0);
}`,
  },
  {
    id: "thermal",
    name: "Thermal",
    category: "Color",
    animatable: false,
    params: [{ key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 1 }],
    frag: `void main(){
  vec3 src=texture(u_tex,v_uv).rgb; float l=luma(src);
  vec3 a=vec3(0.0,0.0,0.35), b=vec3(0.0,0.0,1.0), d=vec3(0.0,1.0,1.0), e=vec3(1.0,1.0,0.0), f=vec3(1.0,0.0,0.0), g=vec3(1.0,1.0,1.0);
  vec3 col;
  if(l<0.2) col=mix(a,b,l/0.2);
  else if(l<0.4) col=mix(b,d,(l-0.2)/0.2);
  else if(l<0.6) col=mix(d,e,(l-0.4)/0.2);
  else if(l<0.8) col=mix(e,f,(l-0.6)/0.2);
  else col=mix(f,g,(l-0.8)/0.2);
  fragColor=vec4(mix(src,col,u_mix),1.0);
}`,
  },

  // ── Light (extended) ──────────────────────────────────────────────────────
  {
    id: "godrays",
    name: "God Rays",
    category: "Light",
    animatable: false,
    params: [
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 1.5, step: 0.02, default: 0.6 },
      { key: "decay", label: "Decay", type: "range", min: 0.8, max: 0.99, step: 0.005, default: 0.95 },
    ],
    frag: `void main(){
  vec2 c=v_uv-0.5; vec3 sum=texture(u_tex,v_uv).rgb; float il=1.0; vec2 uv=v_uv;
  for(int i=0;i<16;i++){ uv-=c*0.02; il*=u_decay;
    vec3 s=texture(u_tex,clamp(uv,0.0,1.0)).rgb; sum+=max(s-0.5,0.0)*il*u_intensity; }
  fragColor=vec4(sum,1.0);
}`,
  },
  {
    id: "lightleak",
    name: "Light Leak",
    category: "Light",
    animatable: true,
    params: [
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 1.5, step: 0.02, default: 0.6 },
      { key: "color", label: "Color", type: "color", default: "#ff7a2f" },
      { key: "speed", label: "Drift", type: "range", min: 0, max: 3, step: 0.05, default: 0.5 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb; vec2 p=v_uv;
  float leak=smoothstep(0.6,1.0, sin(p.x*2.0+loopAngle()*loopCycles(u_speed))*0.5+0.5)*smoothstep(0.0,0.6,p.x);
  leak+=fbm(p*2.0+loopDrift(u_speed))*0.3;
  fragColor=vec4(clamp(c + u_color*leak*u_intensity,0.0,1.0),1.0);
}`,
  },
  {
    id: "starfield",
    name: "Starfield",
    category: "Light",
    animatable: true,
    params: [
      { key: "density", label: "Density", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
      { key: "speed", label: "Twinkle", type: "range", min: 0, max: 3, step: 0.05, default: 1 },
    ],
    frag: `void main(){
  vec3 c=texture(u_tex,v_uv).rgb;
  vec2 g=floor(v_uv*u_resolution/3.0); float n=hash21(g);
  float star=step(1.0-u_density*0.05,n)*(0.5+0.5*sin(loopAngle()*loopCycles(u_speed*3.0)+n*100.0));
  fragColor=vec4(clamp(c+vec3(star),0.0,1.0),1.0);
}`,
  },

  // ── Retro (v2 CRT) ─────────────────────────────────────────────────────────
  {
    id: "crtmonitor",
    name: "CRT Monitor",
    category: "Retro",
    animatable: false,
    // A photoreal CRT: barrel-curved screen, aperture-grille RGB phosphors,
    // scanlines, glass sheen and vignette, set inside a moulded 3D plastic bezel
    // that's lit and shaded from a virtual light so it reads as a real monitor.
    params: [
      { key: "count", label: "Scanlines", type: "range", min: 120, max: 1400, step: 10, default: 700 },
      { key: "strength", label: "Scan Depth", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "curvature", label: "Curvature", type: "range", min: 0, max: 0.5, step: 0.01, default: 0.18 },
      { key: "frame", label: "Bezel", type: "range", min: 0, max: 0.35, step: 0.005, default: 0.1 },
      { key: "phosphor", label: "Phosphor", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "glow", label: "Glow", type: "range", min: 0, max: 1.5, step: 0.02, default: 0.35 },
    ],
    frag: `float sdRR(vec2 p, vec2 b, float r){ vec2 d=abs(p)-b+r; return length(max(d,0.0))+min(max(d.x,d.y),0.0)-r; }
vec2 gradRR(vec2 p, vec2 b, float r){ vec2 e=vec2(0.0015,0.0);
  return normalize(vec2(sdRR(p+e.xy,b,r)-sdRR(p-e.xy,b,r), sdRR(p+e.yx,b,r)-sdRR(p-e.yx,b,r))+1e-6); }
void main(){
  vec2 uv=v_uv;
  float b=clamp(u_frame,0.0,0.4);
  vec2 hs=vec2(0.5-b);          // screen half-extents
  float rs=b*0.6;               // screen corner radius
  vec2 p=uv-0.5;
  float d=sdRR(p, hs, rs);      // <0 inside screen, grows into the bezel
  // Screen UV with barrel (pincushion) curvature.
  vec2 suv=(uv-b)/max(1.0-2.0*b,1e-3);
  vec2 cc=suv-0.5;
  suv+=cc*dot(cc,cc)*u_curvature;

  vec3 screen;
  {
    vec3 s=(suv.x>0.0&&suv.x<1.0&&suv.y>0.0&&suv.y<1.0)?texture(u_tex,suv).rgb:vec3(0.0);
    float scan=0.5+0.5*sin(suv.y*u_count*3.14159);
    s*=1.0-u_strength*0.55*(1.0-scan);
    float idx=mod(floor(suv.x*u_count*0.5),3.0);
    vec3 grille=idx<1.0?vec3(1.0,0.35,0.35):idx<2.0?vec3(0.35,1.0,0.35):vec3(0.35,0.35,1.0);
    s*=mix(vec3(1.0),grille,u_phosphor);
    s*=1.0+u_phosphor*0.6;            // recover brightness lost to the mask
    s+=s*u_glow*0.4;                  // phosphor bloom
    s*=smoothstep(0.95,0.25,length(cc));   // vignette
    s+=smoothstep(0.6,0.0,length(suv-vec2(0.28,0.22)))*0.06; // glass sheen
    screen=s;
  }

  vec3 bezel;
  {
    float t=clamp(d/max(b,1e-3),0.0,1.0);   // 0 at screen edge -> 1 at outer edge
    float dh=cos(t*3.14159)*3.14159;        // slope of a sin() moulding ridge
    vec2 g=gradRR(p,hs,rs);
    vec3 N=normalize(vec3(-g*dh*0.12, 1.0));
    vec3 L=normalize(vec3(-0.55,-0.55,0.62));
    float diff=clamp(dot(N,L),0.0,1.0);
    float spec=pow(diff,28.0);
    vec3 plastic=vec3(0.045,0.05,0.06);
    bezel=plastic*(0.3+1.1*diff)+spec*0.6;
    bezel*=mix(0.35,1.0,smoothstep(0.0,0.10,d));  // inner groove / contact shadow
  }

  float edge=smoothstep(0.0,0.0035,d);
  vec3 col=mix(screen, bezel, edge);
  float dOut=sdRR(p, vec2(0.5-0.004), b*0.5+0.01);  // round the whole device
  col=mix(col, vec3(0.0), smoothstep(0.0,0.004,dOut));
  fragColor=vec4(col,1.0);
}`,
  },

  // ── Cyberpunk ──────────────────────────────────────────────────────────────
  {
    id: "neonedge",
    name: "Neon Edge",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "thickness", label: "Thickness", type: "range", min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { key: "glow", label: "Glow", type: "range", min: 0, max: 3, step: 0.05, default: 1.4 },
      { key: "base", label: "Keep Image", type: "range", min: 0, max: 1, step: 0.01, default: 0.15 },
      { key: "speed", label: "Flow", type: "range", min: 0, max: 4, step: 0.05, default: 1 },
    ],
    frag: `void main(){
  vec2 px=u_thickness/u_resolution;
  float tl=luma(texture(u_tex,v_uv+vec2(-px.x,px.y)).rgb);
  float l =luma(texture(u_tex,v_uv+vec2(-px.x,0.0)).rgb);
  float bl=luma(texture(u_tex,v_uv+vec2(-px.x,-px.y)).rgb);
  float tp=luma(texture(u_tex,v_uv+vec2(0.0,px.y)).rgb);
  float bt=luma(texture(u_tex,v_uv+vec2(0.0,-px.y)).rgb);
  float tr=luma(texture(u_tex,v_uv+vec2(px.x,px.y)).rgb);
  float r =luma(texture(u_tex,v_uv+vec2(px.x,0.0)).rgb);
  float br=luma(texture(u_tex,v_uv+vec2(px.x,-px.y)).rgb);
  float gx=-tl-2.0*l-bl+tr+2.0*r+br;
  float gy=tl+2.0*tp+tr-bl-2.0*bt-br;
  float g=pow(clamp(length(vec2(gx,gy)),0.0,1.0),0.8);
  float hue=fract(v_uv.x*0.5+v_uv.y*0.3+0.12*loopSin(u_speed,0.0));
  vec3 neon=hsv2rgb(vec3(hue,1.0,1.0));
  float pulse=0.7+0.3*loopSin(u_speed,v_uv.y*6.28318);
  vec3 base=texture(u_tex,v_uv).rgb*u_base;
  fragColor=vec4(base+neon*g*u_glow*pulse,1.0);
}`,
  },
  {
    id: "hologram",
    name: "Hologram",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "tint", label: "Tint", type: "color", default: "#00fff7" },
      { key: "scan", label: "Scan Lines", type: "range", min: 100, max: 1200, step: 10, default: 600 },
      { key: "flicker", label: "Flicker", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "glitch", label: "Glitch", type: "range", min: 0, max: 1, step: 0.01, default: 0.3 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  vec2 uv=v_uv;
  float band=floor(uv.y*18.0);
  float slip=(hash21(vec2(band, loopStep(u_speed*8.0*u_duration)))-0.5);
  slip*=step(1.0-u_glitch*0.5, hash21(vec2(band,7.0)));
  uv.x+=slip*0.05*u_glitch;
  vec3 col;
  col.r=texture(u_tex,uv+vec2(0.004,0.0)).r;
  col.g=texture(u_tex,uv).g;
  col.b=texture(u_tex,uv-vec2(0.004,0.0)).b;
  float l=luma(col);
  vec3 holo=u_tint*(0.4+l);
  float scan=0.5+0.5*sin((uv.y*u_scan - loopAngle()*loopCycles(u_speed))*3.14159);
  holo*=0.6+0.4*scan;
  holo*=1.0-u_flicker*0.3*hash11(loopStep(u_duration*30.0)+1.0);
  holo+=u_tint*pow(l,3.0)*0.6;
  fragColor=vec4(holo,1.0);
}`,
  },
  {
    id: "synthgrid",
    name: "Synthwave Grid",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "color1", label: "Near", type: "color", default: "#ff2e9a" },
      { key: "color2", label: "Far", type: "color", default: "#00e5ff" },
      { key: "horizon", label: "Horizon", type: "range", min: 0.3, max: 0.85, step: 0.01, default: 0.55 },
      { key: "intensity", label: "Intensity", type: "range", min: 0, max: 1, step: 0.01, default: 0.85 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 4, step: 0.05, default: 1 },
    ],
    frag: `float lineGlow(float x){ return exp(-pow(abs(fract(x)-0.5)*2.0,2.0)*8.0); }
void main(){
  vec3 col=texture(u_tex,v_uv).rgb;
  // y measured downward from the top of the screen so the floor sits at the bottom.
  float y=1.0-v_uv.y;
  float x=v_uv.x;
  float hz=u_horizon;
  if(y>hz){
    float depth=(y-hz)/(1.0-hz);
    float persp=1.0/(depth+0.06);
    float scroll=loopPhase()*loopCycles(u_speed);
    float fz=persp*0.6 - scroll*2.0;
    float xx=(x-0.5)*persp*2.0;
    float grid=max(lineGlow(fz), lineGlow(xx));
    grid*=smoothstep(0.0,0.12,depth);
    vec3 g=mix(u_color2,u_color1,depth);
    col=mix(col, col*0.25+g*grid*2.2, u_intensity);
  } else {
    vec2 sc=(vec2(x,y)-vec2(0.5,hz-0.16)); sc.x*=u_resolution.x/max(1.0,u_resolution.y);
    float sd=length(sc);
    float sun=smoothstep(0.16,0.15,sd);
    float stripes=step(0.0, sin(y*110.0));
    sun*=mix(1.0, stripes, smoothstep(hz-0.16,hz,y));
    vec3 sunc=mix(u_color1,u_color2, clamp((y-(hz-0.32))/0.32,0.0,1.0));
    col=mix(col, sunc, sun*u_intensity);
  }
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "datamosh",
    name: "Datamosh",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "amount", label: "Amount", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: "blocks", label: "Blocks", type: "range", min: 8, max: 80, step: 1, default: 32 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 2 },
    ],
    frag: `void main(){
  float t=loopStep(u_speed*6.0*u_duration);
  vec2 bs=vec2(floor(u_blocks));
  vec2 cell=floor(v_uv*bs);
  float n=hash21(cell+t*1.7);
  vec2 off=vec2(0.0);
  if(n>1.0-u_amount*0.6) off=(hash22(cell+t)-0.5)*u_amount*0.3;
  vec2 uv=v_uv+off;
  float ca=u_amount*0.02*step(1.0-u_amount,n);
  vec3 col;
  col.r=texture(u_tex,uv+vec2(ca,0.0)).r;
  col.g=texture(u_tex,uv).g;
  col.b=texture(u_tex,uv-vec2(ca,0.0)).b;
  col=mix(col, texture(u_tex,clamp(uv+vec2(off.x*2.0,0.0),0.0,1.0)).rgb, 0.3*step(1.0-u_amount*0.6,n));
  fragColor=vec4(col,1.0);
}`,
  },
  {
    id: "matrixrain",
    name: "Matrix Rain",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "color", label: "Color", type: "color", default: "#00ff66" },
      { key: "density", label: "Columns", type: "range", min: 20, max: 120, step: 1, default: 60 },
      { key: "speed", label: "Speed", type: "range", min: 0, max: 5, step: 0.1, default: 2 },
      { key: "mix", label: "Mix", type: "range", min: 0, max: 1, step: 0.01, default: 0.7 },
    ],
    frag: `void main(){
  vec3 base=texture(u_tex,v_uv).rgb;
  float cols=floor(u_density);
  float cx=floor(v_uv.x*cols);
  float seed=hash11(cx+1.0);
  float spd=0.4+seed*1.4;
  float sy=1.0-v_uv.y;            // screen-down, so the columns fall
  float head=fract(seed*10.0 + loopPhase()*loopCycles(u_speed)*spd);
  float rows=cols*1.8;
  vec2 g=vec2(cx, floor(v_uv.y*rows));
  float glyph=step(0.45, hash21(g+floor(loopPhase()*loopCycles(max(1.0,u_duration*8.0)))));
  float dist=fract(head - sy);   // 0 at the head, growing up the trail
  float trail=smoothstep(0.6,0.0,dist);
  vec3 rain=u_color*glyph*trail;
  rain+=vec3(0.85,1.0,0.9)*glyph*smoothstep(0.04,0.0,dist);   // bright head
  fragColor=vec4(mix(base, base*0.18+rain, u_mix),1.0);
}`,
  },
  {
    id: "circuit",
    name: "Circuit Surge",
    category: "Cyberpunk",
    animatable: true,
    params: [
      { key: "color", label: "Color", type: "color", default: "#00e5ff" },
      { key: "scale", label: "Density", type: "range", min: 2, max: 20, step: 0.5, default: 8 },
      { key: "glow", label: "Glow", type: "range", min: 0, max: 2, step: 0.02, default: 1 },
      { key: "speed", label: "Pulse", type: "range", min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
    frag: `void main(){
  vec3 base=texture(u_tex,v_uv).rgb;
  vec2 uv=v_uv*u_scale;
  vec2 g=fract(uv)-0.5;
  vec2 id=floor(uv);
  float r=hash21(id);
  float lx=smoothstep(0.06,0.0,abs(g.x));
  float ly=smoothstep(0.06,0.0,abs(g.y));
  float trace=r<0.5?lx:ly;
  float node=smoothstep(0.13,0.0,length(g))*step(0.7,hash21(id+3.0));
  float along=r<0.5?uv.x:uv.y;
  float pulse=0.5+0.5*sin(along*3.0 - loopAngle()*loopCycles(u_speed)+r*6.28318);
  float c=trace*pulse+node;
  fragColor=vec4(base*0.4 + u_color*c*u_glow,1.0);
}`,
  },
  {
    id: "neonbleed",
    name: "Neon Bleed",
    category: "Cyberpunk",
    animatable: false,
    params: [
      { key: "saturation", label: "Saturation", type: "range", min: 1, max: 3, step: 0.02, default: 1.8 },
      { key: "glow", label: "Glow", type: "range", min: 0, max: 3, step: 0.05, default: 1.2 },
      { key: "threshold", label: "Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
    frag: `vec3 punch(vec3 c){ vec3 h=rgb2hsv(c); h.y=clamp(h.y*u_saturation,0.0,1.0); return hsv2rgb(h); }
void main(){
  vec3 c=punch(texture(u_tex,v_uv).rgb);
  vec3 sum=vec3(0.0); vec2 px=2.5/u_resolution;
  for(int x=-3;x<=3;x++){ for(int y=-3;y<=3;y++){
    vec3 s=punch(texture(u_tex,v_uv+vec2(float(x),float(y))*px).rgb);
    sum+=max(s-u_threshold,0.0);
  }}
  sum/=49.0;
  fragColor=vec4(c+sum*u_glow,1.0);
}`,
  },
]

export const EFFECTS_BY_ID: Record<string, EffectDef> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e])
)

/** Default custom-GLSL body shown when adding a Custom Shader effect. */
export const CUSTOM_FRAG_DEFAULT = `// Custom shader — write GLSL ES 3.00, OR paste a Shadertoy shader directly:
// any code with a mainImage(out vec4 fragColor, in vec2 fragCoord) is auto-
// converted (iTime, iResolution, iChannel0, iMouse… are mapped for you).
// Available: v_uv, u_tex, u_resolution, u_time, u_duration, the prelude
// (fbm, hash21, rgb2hsv/hsv2rgb, luma, maskAt — the painted motion mask)
// and sliders u_p1..u_p4, color u_pc.
// For seamless GIF loops, drive animation with the loop helpers:
//   loopPhase() 0..1, loopAngle(), loopDrift(r) (orbit for noise),
//   loopSin(cycles,phase), loopCycles(n). Write the result to fragColor.
void main(){
  vec2 uv = v_uv;
  vec3 col = texture(u_tex, uv).rgb;
  // tint by a moving hue (u_p1 controls how many hue cycles per loop)
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + 0.15 * loopSin(1.0 + u_p1*4.0, uv.y * 6.28));
  col = hsv2rgb(hsv);
  fragColor = vec4(mix(col, u_pc, u_p2), 1.0);
}`

/** A user-authored GLSL pass. Its frag is replaced by the instance's customFrag. */
export const CUSTOM_EFFECT: EffectDef = {
  id: "custom",
  name: "Custom Shader",
  category: "Custom",
  animatable: true,
  params: [
    { key: "p1", label: "Param 1", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "p2", label: "Param 2", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "p3", label: "Param 3", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "p4", label: "Param 4", type: "range", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "pc", label: "Color", type: "color", default: "#ff2e6c" },
  ],
  frag: CUSTOM_FRAG_DEFAULT,
}

/** Look up any effect (registry or the custom pass) by id. */
export function getEffectDef(effectId: string): EffectDef | undefined {
  return effectId === "custom" ? CUSTOM_EFFECT : EFFECTS_BY_ID[effectId]
}

/** Whether an effect reads the painted motion mask (so it gets a per-instance mask control). */
export function effectUsesMask(effectId: string): boolean {
  return getEffectDef(effectId)?.usesMask ?? false
}

/**
 * Build the complete fragment-shader source for an effect: version + precision +
 * standard uniforms + the per-effect param uniforms + prelude + the effect body.
 * Bodies written in Shadertoy form (a `mainImage()` function) are auto-adapted
 * so they compile against our engine — see {@link adaptShaderBody}.
 */
export function buildFragmentSource(
  paramUniforms: string,
  body: string
): string {
  return `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_duration;
${paramUniforms}
${PRELUDE}
${adaptShaderBody(body)}`
}

// Shadertoy shaders are written against a different contract than our engine:
// they expose `void mainImage(out vec4 fragColor, in vec2 fragCoord)` and rely on
// uniforms named iTime / iResolution / iChannel0 / iMouse … . Pasting one straight
// in fails to compile. These two strings translate Shadertoy's names onto ours and
// add a `main()` that calls mainImage(), so a copied shader "just works".
const SHADERTOY_SHIM = `// ── Shadertoy compatibility (auto) ───────────────────────────────────────────
#define iChannel0 u_tex
#define iChannel1 u_tex
#define iChannel2 u_tex
#define iChannel3 u_tex
#define iTime u_time
#define iGlobalTime u_time
#define iResolution vec3(u_resolution, 1.0)
#define iMouse vec4(0.0)
#define iDate vec4(2024.0, 1.0, 1.0, 0.0)
#define iFrame int(u_time*60.0)
#define iTimeDelta (1.0/60.0)
#define iFrameRate 60.0
#define iSampleRate 44100.0
#define texture2D texture
#define textureCube texture
`

const SHADERTOY_MAIN = `
void main(){
  vec3 iChannelResolution[4];
  iChannelResolution[0]=vec3(u_resolution,1.0);
  iChannelResolution[1]=vec3(u_resolution,1.0);
  iChannelResolution[2]=vec3(u_resolution,1.0);
  iChannelResolution[3]=vec3(u_resolution,1.0);
  vec4 stColor=vec4(0.0,0.0,0.0,1.0);
  mainImage(stColor, v_uv*u_resolution);
  fragColor=vec4(stColor.rgb,1.0);
}`

/**
 * Adapt a fragment body so it can be compiled by the engine. Engine-native bodies
 * (those with a `void main()` and no `mainImage`) are returned untouched; bodies in
 * Shadertoy form (a `mainImage()` with no `main()`) are wrapped with the
 * compatibility shim and an entry-point `main()`. Lines Shadertoy users commonly
 * paste that clash with our header — `#version`, `precision`, `#ifdef GL_ES`, an
 * `out vec4` declaration, or redeclared `i*` uniforms — are stripped first.
 */
export function adaptShaderBody(body: string): string {
  const hasMainImage = /\bmainImage\s*\(/.test(body)
  const hasMain = /\bvoid\s+main\s*\(/.test(body)
  if (hasMain || !hasMainImage) return body
  const cleaned = body
    .replace(/^\s*#version[^\n]*\n/gm, "")
    .replace(/^\s*precision\s+[^\n]*\n/gm, "")
    .replace(/^\s*#ifdef\s+GL_ES[^\n]*\n/gm, "")
    .replace(/^\s*#endif[^\n]*\n/gm, "")
    .replace(/^\s*out\s+vec4\s+\w+\s*;\s*$/gm, "")
    .replace(
      /^\s*uniform\s+\w+\s+i(Resolution|Time|TimeDelta|GlobalTime|Frame|FrameRate|Mouse|Date|SampleRate|ChannelResolution|Channel\d)\b[^\n]*\n/gm,
      ""
    )
  return `${SHADERTOY_SHIM}\n${cleaned}\n${SHADERTOY_MAIN}`
}

/** GLSL uniform declarations for an effect's params. */
export function paramUniformDecls(def: EffectDef): string {
  return def.params
    .map((p) => (p.type === "color" ? `uniform vec3 u_${p.key};` : `uniform float u_${p.key};`))
    .join("\n")
}
