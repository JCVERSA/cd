import{n as e}from"./chunk-WkwZ5CU-.js";import{h as t,m as n}from"./chunk-B2DNQCqq.js";var r=e(t(),1),i=n(),a=`button, a, input, textarea, select, label, [role="button"], [role="option"], [role="radio"], [role="switch"], [role="slider"], [role="dialog"]`,o=`#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,s=`
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uViewHeight;
uniform float uFocal;
uniform float uDistance;
uniform float uTilt;
`,c=`#version 300 es
precision highp float;
${s}
uniform float uMode;
uniform float uSweep;
uniform float uSwept;
uniform float uDirection;
uniform float uCycle;
uniform float uTrail;
uniform float uRings;
uniform float uSpokes;
uniform float uTicks;
uniform float uGrid;
uniform float uLine;
uniform float uClutter;
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uHeat;
uniform float uIntro;
uniform float uRange;
uniform float uPixel;
out vec4 outColor;

const float TAU = 6.28318531;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float stroke(float distance, float width) {
  float w = max(width, 1.0) * 0.5;
  return clamp(w + 0.5 - distance, 0.0, 1.0) * min(width, 1.0);
}

void main() {
  vec2 s = (gl_FragCoord.xy - uCenter) / uViewHeight;
  float ct = cos(uTilt);
  float st = sin(uTilt);
  vec3 forward = vec3(0.0, st, -ct);
  vec3 up = vec3(0.0, ct, st);
  vec3 dir = forward * uFocal + vec3(s.x, 0.0, 0.0) + up * s.y;
  vec3 eye = vec3(0.0, -uDistance * st, uDistance * ct);
  float hit = -eye.z / min(dir.z, -0.00001);
  vec2 p = eye.xy + dir.xy * hit;
  float r = length(p);
  vec2 dpdx = dFdx(p);
  vec2 dpdy = dFdy(p);
  if (dir.z > -0.0001 || r > 1.3) {
    outColor = vec4(0.0);
    return;
  }
  vec2 radial = p / max(r, 0.00001);
  vec2 tangent = vec2(radial.y, -radial.x);
  float pxR = max(length(vec2(dot(radial, dpdx), dot(radial, dpdy))), 0.000001);
  float pxT = max(length(vec2(dot(tangent, dpdx), dot(tangent, dpdy))), 0.000001);
  float bearing = atan(p.x, p.y);
  float turn = fract(bearing / TAU + 1.0);
  float inside = 1.0 - smoothstep(1.0 - pxR, 1.0 + pxR, r);

  float ringCoord = r * uRings;
  float ringIndex = clamp(floor(ringCoord + 0.5), 1.0, max(uRings - 1.0, 1.0));
  float rings = stroke(abs(ringCoord - ringIndex) / uRings / pxR, uLine) * step(ringIndex, uRings - 0.5);
  float arc = clamp(uIntro * (uRings + 3.0) - ringIndex, 0.0, 1.0) * 1.02;
  rings *= 1.0 - smoothstep(arc - 0.01, arc, turn);
  float outerArc = clamp(uIntro * (uRings + 3.0) - uRings, 0.0, 1.0) * 1.02;
  float outer = stroke(abs(r - 1.0) / pxR, uLine * 1.15) * (1.0 - smoothstep(outerArc - 0.01, outerArc, turn));

  float tickCoord = turn * 180.0;
  float tickIndex = floor(tickCoord + 0.5);
  float major = 1.0 - step(0.5, mod(tickIndex, 15.0));
  float middle = 1.0 - step(0.5, mod(tickIndex, 5.0));
  float tickLength = mix(mix(0.016, 0.03, middle), 0.05, major);
  float tickRadial = clamp((r - 1.0) / pxR + 0.5, 0.0, 1.0) * clamp((1.0 + tickLength - r) / pxR + 0.5, 0.0, 1.0);
  float spacing = TAU / 180.0 * r / pxT;
  float ticks = stroke(abs(tickCoord - tickIndex) / 180.0 * TAU * r / pxT, uLine) * tickRadial;
  ticks *= mix(mix(0.42 * smoothstep(2.5, 5.0, spacing), 0.7, middle), 1.0, major) * uTicks;
  ticks *= smoothstep(0.55, 0.9, uIntro);

  float spokeTotal = max(uSpokes, 1.0);
  float spokeCoord = turn * spokeTotal;
  float spokeIndex = floor(spokeCoord + 0.5);
  float spokes = stroke(abs(spokeCoord - spokeIndex) / spokeTotal * TAU * r / pxT, uLine) * smoothstep(0.05, 0.16, r);
  spokes *= inside * step(0.5, uSpokes);
  float cardinalCoord = turn * 4.0;
  float cardinal = stroke(abs(cardinalCoord - floor(cardinalCoord + 0.5)) / 4.0 * TAU * r / pxT, uLine) * smoothstep(0.02, 0.08, r) * inside;
  float hub = stroke(abs(r - 0.022) / pxR, uLine);
  float spokesIn = smoothstep(0.35, 0.8, uIntro);
  float axisDistance = abs(cardinalCoord - floor(cardinalCoord + 0.5)) / 4.0 * TAU * r / pxT;
  float rangeCoord = r * uRings * 5.0;
  float rangeMark = stroke(abs(rangeCoord - floor(rangeCoord + 0.5)) / (uRings * 5.0) / pxR, uLine);
  rangeMark *= 1.0 - smoothstep(3.0 * uPixel - 0.5, 3.0 * uPixel + 0.5, axisDistance);
  rangeMark *= smoothstep(0.06, 0.12, r) * inside;
  float bezel = stroke(abs(r - 1.065) / pxR, uLine) * uTicks * smoothstep(0.6, 0.95, uIntro);

  float grid = rings * 0.12 + outer * 0.24 + ticks * 0.22 + bezel * 0.08;
  grid += (spokes * 0.05 + cardinal * 0.08 + hub * 0.22 + rangeMark * 0.16) * spokesIn;
  grid *= uGrid;

  float behind;
  float edge;
  float trail;
  float lastPass;
  if (uMode < 0.5) {
    float ahead = fract((bearing - uSweep) / TAU + 0.5) - 0.5;
    behind = fract(uDirection * (uSweep - bearing) / TAU) * TAU;
    edge = stroke(abs(ahead) * TAU * r / pxT, uLine * 1.4) * smoothstep(0.0, 0.04, r) * inside;
    trail = exp(-behind / uTrail) * (1.0 - smoothstep(uSwept - 0.15, uSwept, behind));
    lastPass = floor(uCycle - behind / TAU);
  } else {
    behind = uSweep - r;
    edge = stroke(abs(behind) / pxR, uLine * 1.4) * inside;
    trail = behind >= 0.0 ? exp(-behind / uTrail) : 0.0;
    lastPass = behind >= 0.0 ? uCycle : uCycle - 1.0;
  }
  float sweepIn = smoothstep(0.45, 1.0, uIntro);
  trail *= inside * sweepIn;
  edge *= sweepIn;
  float glowTrail = pow(trail, 0.45);

  float returns = 0.0;
  if (uClutter > 0.0 && trail > 0.004) {
    float radialBin = floor(r * 120.0);
    float count = max(8.0, floor(radialBin * 5.0));
    float angularBin = floor(turn * count);
    vec2 drift = vec2(lastPass * 0.173, lastPass * 0.291);
    float weather = noise(p * 3.2 + drift) * 0.65 + noise(p * 7.1 - drift) * 0.35;
    float cluster = smoothstep(0.5, 0.78, weather);
    float density = uClutter * (0.02 + 0.35 * cluster) * (1.0 - smoothstep(0.55, 1.0, r));
    vec2 binSeed = vec2(radialBin, angularBin) + lastPass * 17.13;
    float speck = step(1.0 - density, hash(binSeed));
    vec2 inBin = vec2(fract(r * 120.0), fract(turn * count)) - 0.5;
    float shape = 1.0 - smoothstep(0.18, 0.5, length(inBin));
    speck *= shape * (0.45 + 0.55 * hash(binSeed + 7.7));
    returns = (speck * 1.1 + cluster * 0.16 * uClutter) * trail;
  }

  float heat = uHeat.z * exp(-dot(p - uHeat.xy, p - uHeat.xy) / 0.035);
  float lit = clamp(glowTrail * 0.9 + heat * 0.55, 0.0, 1.0);
  vec3 lineColor = mix(vec3(1.0), uAccent, lit);
  vec3 light = lineColor * grid * (1.0 + glowTrail * 3.0 + heat * 2.4);
  float fill = trail * 0.11 * (0.35 + 0.65 * smoothstep(0.0, 0.6, r));
  light += uAccent * (fill + returns * 0.55);
  light += mix(uAccent, vec3(1.0), 0.3) * edge * 1.3;
  outColor = vec4(light * uRange, 1.0);
}`,l=`#version 300 es
in vec2 aCorner;
in vec4 aSprite;
in vec4 aStyle;
${s}
out vec2 vLocal;
out vec4 vStyle;
out float vKind;
void main() {
  float ct = cos(uTilt);
  float st = sin(uTilt);
  float c = cos(aStyle.w);
  float s = sin(aStyle.w);
  vec2 local = aCorner * 1.25;
  vec2 offset = vec2(c * local.x - s * local.y, s * local.x + c * local.y) * aSprite.z;
  vec3 world = vec3(aSprite.xy + offset, 0.0);
  vec3 eye = vec3(0.0, -uDistance * st, uDistance * ct);
  vec3 rel = world - eye;
  float xc = rel.x;
  float yc = dot(rel, vec3(0.0, ct, st));
  float zc = max(dot(rel, vec3(0.0, st, -ct)), 0.0001);
  vec2 center = uCenter / uResolution * 2.0 - 1.0;
  gl_Position = vec4(center * zc + 2.0 * uFocal * uViewHeight * vec2(xc, yc) / uResolution, 0.0, zc);
  vLocal = local;
  vStyle = aStyle;
  vKind = aSprite.w;
}`,u=`#version 300 es
precision highp float;
in vec2 vLocal;
in vec4 vStyle;
in float vKind;
uniform vec3 uAccent;
uniform float uRange;
out vec4 outColor;
void main() {
  float shape;
  vec3 tint;
  if (vKind < 0.5) {
    float d = length(vLocal * vec2(0.62, 1.0));
    float aa = max(fwidth(d), 0.0001);
    shape = clamp((1.0 - d) / aa + 0.5, 0.0, 1.0);
    shape *= 0.5 + 0.5 * exp(-d * d * 2.5);
    tint = mix(uAccent, vec3(1.0), vStyle.y * 0.45 * exp(-d * d * 5.0));
  } else {
    float d = length(vLocal);
    float aa = max(fwidth(d), 0.0001);
    shape = clamp(1.0 - abs(d - 1.0) / (aa * 0.75), 0.0, 1.0);
    tint = mix(uAccent, vec3(1.0), 0.2);
  }
  outColor = vec4(tint * shape * vStyle.x * uRange, 1.0);
}`,d=`#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec4 sum = texture(uSource, uv) * 4.0;
  sum += texture(uSource, uv - uTexel);
  sum += texture(uSource, uv + uTexel);
  sum += texture(uSource, uv + vec2(uTexel.x, -uTexel.y));
  sum += texture(uSource, uv - vec2(uTexel.x, -uTexel.y));
  outColor = sum / 8.0;
}`,f=`#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uBase;
uniform vec2 uTexel;
uniform vec2 uTarget;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uTarget;
  vec2 h = uTexel * 0.5;
  vec4 sum = texture(uSource, uv + vec2(-h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(h.x * 2.0, 0.0));
  sum += texture(uSource, uv + vec2(0.0, -h.y * 2.0));
  sum += texture(uSource, uv + vec2(0.0, h.y * 2.0));
  sum += texture(uSource, uv + vec2(-h.x, h.y)) * 2.0;
  sum += texture(uSource, uv + h) * 2.0;
  sum += texture(uSource, uv + vec2(h.x, -h.y)) * 2.0;
  sum += texture(uSource, uv - h) * 2.0;
  outColor = sum / 12.0 + texture(uBase, uv);
}`,p=`#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uExposure;
uniform float uGlow;
uniform float uGrain;
uniform float uFade;
uniform float uOpacity;
uniform float uTime;
uniform float uLightMode;
uniform vec4 uBackground;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float smootherstep(float edge, float x) {
  float t = clamp(x / max(edge, 0.0001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 hdr = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb * uExposure;
  vec3 bloom = texture(uBloom, uv).rgb * uExposure * uGlow * 0.5;
  float edge = uFade * 0.5;
  float mask = smootherstep(edge, uv.x) * smootherstep(edge, 1.0 - uv.x) * smootherstep(edge, uv.y) * smootherstep(edge, 1.0 - uv.y);
  mask *= uOpacity;
  float grain = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  vec4 color;
  if (uLightMode > 0.5) {
    float bloomPeak = max(bloom.r, max(bloom.g, bloom.b));
    float bloomLow = min(bloom.r, min(bloom.g, bloom.b));
    vec3 total = hdr + bloom * 0.3 * (bloomPeak - bloomLow) / max(bloomPeak, 0.0001);
    float peak = max(total.r, max(total.g, total.b));
    vec3 hue = total / max(peak, 0.0001);
    float tone = dot(hue, vec3(0.2126, 0.7152, 0.0722));
    float depth = mix(0.36, 0.09, smoothstep(0.06, 0.7, peak));
    vec3 ink = pow(clamp(hue * min(1.0, depth / max(tone, 0.001)), 0.0, 1.0), vec3(1.0 / 2.2));
    float alpha = clamp((1.0 - exp(-peak * 2.6)) * (1.0 + grain), 0.0, 1.0) * mask;
    color = vec4(ink * alpha, alpha);
  } else {
    vec3 mapped = 1.0 - exp(-(hdr + bloom));
    float level = max(mapped.r, max(mapped.g, mapped.b));
    mapped = clamp(mapped + grain * level, 0.0, 1.0) * mask;
    color = vec4(mapped, max(mapped.r, max(mapped.g, mapped.b)));
  }
  vec4 back = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  outColor = color + back * (1.0 - color.a);
}`,m=Math.PI*2,ee=16,te=4,ne=2,re=2.2,ie=2560,h=5,g=(e,t,n)=>Math.min(n,Math.max(t,e)),_=()=>typeof document<`u`&&document.documentElement.getAttribute(`data-reduced-motion`)===`true`||typeof window<`u`&&!!window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches,ae=e=>{let t=e.trim().toLowerCase();if(t===`transparent`)return[0,0,0,0];if(!t.startsWith(`#`))return null;let n=t.slice(1);if(n.length===3){let e=parseInt(n[0]+n[0],16)/255,t=parseInt(n[1]+n[1],16)/255,r=parseInt(n[2]+n[2],16)/255;return Number.isNaN(e+t+r)?null:[e,t,r,1]}if(n.length===6||n.length===8){let e=parseInt(n.slice(0,2),16)/255,t=parseInt(n.slice(2,4),16)/255,r=parseInt(n.slice(4,6),16)/255,i=n.length===8?parseInt(n.slice(6,8),16)/255:1;return Number.isNaN(e+t+r+i)?null:[e,t,r,i]}return null},oe=e=>{let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}},v=(e,t,n)=>{let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null},y=(e,t,n,r)=>{let i=v(e,e.VERTEX_SHADER,t),a=v(e,e.FRAGMENT_SHADER,n),o=e.createProgram();if(!i||!a||!o)return null;if(e.attachShader(o,i),e.attachShader(o,a),r.forEach((t,n)=>e.bindAttribLocation(o,n,t)),e.linkProgram(o),e.deleteShader(i),e.deleteShader(a),!e.getProgramParameter(o,e.LINK_STATUS))return e.deleteProgram(o),null;let s={},c=e.getProgramParameter(o,e.ACTIVE_UNIFORMS);for(let t=0;t<c;t++){let n=e.getActiveUniform(o,t);n&&(s[n.name]=e.getUniformLocation(o,n.name))}return{program:o,uniforms:s}},se=(e,t)=>{let n=e()*m,r=t?.94:.2+e()*.68,i=t?n+Math.PI+(e()-.5)*1.6:e()*m;return{x:Math.sin(n)*r,y:Math.cos(n)*r,heading:i,velocity:.012+e()*.03,turn:(e()-.5)*.18}};function b({color:e=`#ffc76b`,backgroundColor:t=`transparent`,mode:n=`sweep`,speed:s=1,trail:v=.35,scale:b=.9,ringCount:x=6,spokeCount:S=12,ticks:C=!0,targets:w=6,clutter:T=.35,glow:E=1,brightness:D=1,gridOpacity:O=1,lineWidth:k=1,tilt:A=0,centerX:j=.5,centerY:M=.5,mouseInteraction:N=!0,clickPing:P=!0,intro:F=!0,grain:ce=.03,fade:le=0,opacity:I=1,lightMode:L=!1,paused:R=!1,dpr:z,mixBlendMode:B=`normal`,className:V=``,style:H,...U}){let ue=(0,r.useRef)(null),de=(0,r.useRef)(null),W=(0,r.useRef)(null),G={color:String(e),backgroundColor:String(t),mode:n===`pulse`?`pulse`:`sweep`,speed:s,trail:g(v,.02,1),scale:Math.max(.05,b),ringCount:Math.round(g(x,1,24)),spokeCount:Math.round(g(S,0,72)),ticks:C,targets:Math.round(g(w,0,ee)),clutter:g(T,0,1),glow:Math.max(0,E),brightness:Math.max(0,D),gridOpacity:g(O,0,2),lineWidth:g(k,.25,4),tilt:g(A,0,80)*Math.PI/180,centerX:j,centerY:M,mouseInteraction:N,clickPing:P,intro:F,grain:Math.max(0,ce),fade:g(le,0,1),opacity:g(I,0,1),lightMode:L,paused:R,dpr:z},K=(0,r.useRef)(G);return K.current=G,(0,r.useEffect)(()=>{let e=ue.current,t=de.current,n=t?.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1});if(!e||!t||!n)return;let r=!!n.getExtension(`EXT_color_buffer_float`),i=r?1:.25,s=y(n,o,c,[`aPosition`]),v=y(n,l,u,[`aCorner`,`aSprite`,`aStyle`]),b=y(n,o,d,[`aPosition`]),x=y(n,o,f,[`aPosition`]),S=y(n,o,p,[`aPosition`]);if(!s||!v||!b||!x||!S){[s,v,b,x,S].forEach(e=>{e&&n.deleteProgram(e.program)});return}let C={scene:s,sprite:v,down:b,up:x,composite:S},w=n.createBuffer(),T=n.createVertexArray();n.bindVertexArray(T),n.bindBuffer(n.ARRAY_BUFFER,w),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0);let E=n.createBuffer(),D=n.createBuffer(),O=n.createVertexArray();n.bindVertexArray(O),n.bindBuffer(n.ARRAY_BUFFER,E),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0),n.bindBuffer(n.ARRAY_BUFFER,D);for(let e=1;e<=2;e++)n.enableVertexAttribArray(e),n.vertexAttribPointer(e,4,n.FLOAT,!1,32,(e-1)*16),n.vertexAttribDivisor(e,1);n.bindVertexArray(null);let k=()=>({texture:n.createTexture(),framebuffer:n.createFramebuffer(),width:0,height:0}),A=(e,t,i)=>{(e.width!==t||e.height!==i)&&(e.width=t,e.height=i,n.bindTexture(n.TEXTURE_2D,e.texture),r?n.texImage2D(n.TEXTURE_2D,0,n.RGBA16F,t,i,0,n.RGBA,n.HALF_FLOAT,null):n.texImage2D(n.TEXTURE_2D,0,n.RGBA,t,i,0,n.RGBA,n.UNSIGNED_BYTE,null),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.bindFramebuffer(n.FRAMEBUFFER,e.framebuffer),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,e.texture,0))},j=k(),M=Array.from({length:6},k),N=Array.from({length:h},k),P=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0}),F=new Map,ce=e=>{let t=F.get(e);if(t)return t;let n=ae(e);if(!n&&P){P.clearRect(0,0,1,1),P.fillStyle=`rgba(0, 0, 0, 0)`,P.fillStyle=e,P.fillRect(0,0,1,1);let[t,r,i,a]=P.getImageData(0,0,1,1).data;n=a?[t/a,r/a,i/a,a/255]:[0,0,0,0]}let r=n??[1,1,1,1];return F.set(e,r),r},le=e=>{let[t,n,r]=ce(e);return[t**2.2,n**2.2,r**2.2]},I=oe(7919),L=Array.from({length:ee},()=>({...se(I,!1),echoes:[]})),R={x:0,y:0,inside:!1,echoes:[]},z={x:0,y:0,inside:!1},B={width:1,height:1,ratio:1},V=_(),H={time:0,sweep:0,swept:V?m:0,cycle:0,intro:K.current.intro&&!V?0:1,heat:0,heatVelocity:0,heatX:0,heatY:0},U=new Float32Array(1280),G=0,q=0,J=!0,fe=e=>e.scale*Math.min(B.width,B.height)/B.height,pe=e=>({distance:4/fe(e),focal:ne,tilt:e.tilt}),me=(e,t,n)=>{let{distance:r,focal:i,tilt:a}=pe(e),o=(t-e.centerX*B.width)/B.height,s=(e.centerY*B.height-n)/B.height,c=Math.cos(a),l=Math.sin(a),u=o,d=i*l+s*c,f=-i*c+s*l;if(f>-1e-4)return null;let p=-r*l,m=-(r*c)/f;return[u*m,p+d*m]},he=e=>e.mode===`pulse`?3.2:6,Y=e=>{e.echoes.unshift({x:e.x,y:e.y,time:H.time}),e.echoes.length>te&&(e.echoes.length=te)},ge=(e,t)=>{let n=t*Math.abs(e.speed),r=e.mode===`pulse`,i=r?1.15:m,a=n/he(e)*i,o=e.speed<0&&!r?-1:1,s=H.sweep;H.swept+=a;let c=(e,t)=>{if(r){let n=Math.hypot(e,t),r=s,o=s+a;return n>r&&n<=o||o>i&&n<=o-i}let n=(o*(Math.atan2(e,t)-s)%m+m)%m;return n>0&&n<=a};for(let t=0;t<e.targets;t++){let e=L[t];e.heading+=e.turn*n,e.x+=Math.sin(e.heading)*e.velocity*n,e.y+=Math.cos(e.heading)*e.velocity*n,Math.hypot(e.x,e.y)>.96&&Object.assign(e,se(I,!0)),c(e.x,e.y)&&Y(e)}for(R.inside&&c(R.x,R.y)&&Y(R),H.sweep+=o*a;H.sweep>=i;)H.sweep-=i,H.cycle+=1;for(;H.sweep<0;)H.sweep+=i,H.cycle+=1},_e=e=>{let t=2/(fe(e)*B.height),n=he(e)/Math.max(Math.abs(e.speed),.05)*1.1,r=0,i=(e,t,n,i,a,o,s)=>{r*8+8>U.length||(U.set([e,t,n,i,a,o,0,s],r*8),r++)},a=(e,r)=>{e.echoes.forEach((e,a)=>{let o=Math.max(0,H.time-e.time),s=Math.exp(-o/n)*(a===0?1:.8);if(s<.01)return;let c=-Math.atan2(e.x,e.y);if(i(e.x,e.y,t*(a===0?3.4:2.4),0,s*r*2.2,a===0?1:.3,c),a===0&&o<1.4){let n=o/1.4,a=1-(1-n)**3;i(e.x,e.y,t*(4+26*a),1,(1-n)*(1-n)*r*1.4,0,0)}})};for(let t=0;t<e.targets;t++)a(L[t],1);return a(R,1.35),r},X=(e,t,r,i)=>{n.bindFramebuffer(n.FRAMEBUFFER,t?t.framebuffer:null),n.viewport(0,0,r,i),n.useProgram(e.program),n.drawArrays(n.TRIANGLES,0,3)},Z=(e,t,r,i)=>{n.activeTexture(n.TEXTURE0+r),n.bindTexture(n.TEXTURE_2D,i),n.uniform1i(e.uniforms[t],r)},ve=(e,r)=>{let i=e.uniforms,{distance:a,focal:o,tilt:s}=pe(r);n.uniform2f(i.uResolution,t.width,t.height),n.uniform2f(i.uCenter,r.centerX*t.width,(1-r.centerY)*t.height),n.uniform1f(i.uViewHeight,t.height),n.uniform1f(i.uFocal,o),n.uniform1f(i.uDistance,a),n.uniform1f(i.uTilt,s)},Q=()=>{let e=K.current,a=le(e.color),o=H.intro;A(j,t.width,t.height);let s=C.scene,c=s.uniforms;n.useProgram(s.program),ve(s,e),n.uniform1f(c.uMode,+(e.mode===`pulse`)),n.uniform1f(c.uSweep,H.sweep),n.uniform1f(c.uSwept,Math.min(H.swept,m+1)),n.uniform1f(c.uDirection,e.speed<0&&e.mode!==`pulse`?-1:1),n.uniform1f(c.uCycle,H.cycle),n.uniform1f(c.uTrail,e.mode===`pulse`?e.trail*.22:e.trail*m*.5),n.uniform1f(c.uRings,e.ringCount),n.uniform1f(c.uSpokes,e.spokeCount),n.uniform1f(c.uTicks,+!!e.ticks),n.uniform1f(c.uGrid,e.gridOpacity),n.uniform1f(c.uLine,e.lineWidth*B.ratio),n.uniform1f(c.uClutter,e.clutter*(e.lightMode?.6:1)),n.uniform1f(c.uTime,H.time),n.uniform3fv(c.uAccent,a),n.uniform3f(c.uHeat,H.heatX,H.heatY,H.heat),n.uniform1f(c.uIntro,o),n.uniform1f(c.uRange,i),n.uniform1f(c.uPixel,B.ratio),n.bindVertexArray(T),X(s,j,t.width,t.height);let l=_e(e);if(l>0){let t=C.sprite;n.useProgram(t.program),ve(t,e),n.uniform3fv(t.uniforms.uAccent,a),n.uniform1f(t.uniforms.uRange,i*Math.min(1,o*2)),n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE),n.bindVertexArray(O),n.bindBuffer(n.ARRAY_BUFFER,D),n.bufferData(n.ARRAY_BUFFER,U.subarray(0,l*8),n.DYNAMIC_DRAW),n.drawArraysInstanced(n.TRIANGLE_STRIP,0,4,l),n.disable(n.BLEND)}n.bindVertexArray(T);let u=j;for(let e=0;r&&e<=h;e++){let t=M[e],r=e===0?Math.round(B.width/2):u.width>>1,i=e===0?Math.round(B.height/2):u.height>>1;A(t,Math.max(1,r),Math.max(1,i)),n.useProgram(C.down.program),n.uniform2f(C.down.uniforms.uTexel,1/u.width,1/u.height),n.uniform2f(C.down.uniforms.uTarget,t.width,t.height),Z(C.down,`uSource`,0,u.texture),X(C.down,t,t.width,t.height),u=t}for(let e=4;r&&e>=0;e--){let t=e===4?M[h]:N[e+1],r=N[e];A(r,M[e].width,M[e].height),n.useProgram(C.up.program),n.uniform2f(C.up.uniforms.uTexel,1/t.width,1/t.height),n.uniform2f(C.up.uniforms.uTarget,r.width,r.height),Z(C.up,`uSource`,0,t.texture),Z(C.up,`uBase`,1,M[e].texture),X(C.up,r,r.width,r.height)}let d=C.composite,f=d.uniforms;n.useProgram(d.program),n.uniform2f(f.uResolution,t.width,t.height),n.uniform1f(f.uExposure,1.5*e.brightness/i),n.uniform1f(f.uGlow,r?e.glow:0),n.uniform1f(f.uGrain,e.grain),n.uniform1f(f.uFade,e.fade),n.uniform1f(f.uOpacity,e.opacity),n.uniform1f(f.uTime,H.time%1e3),n.uniform1f(f.uLightMode,+!!e.lightMode);let p=ce(e.backgroundColor);n.uniform4f(f.uBackground,p[0],p[1],p[2],p[3]),Z(d,`uScene`,0,j.texture),Z(d,`uBloom`,1,r?N[0].texture:j.texture),X(d,null,t.width,t.height)},ye=e=>{if(G=0,!J||document.hidden)return;let t=K.current,n=_(),r=q?Math.min(.05,(e-q)/1e3):1/60;q=e;let i=!t.paused&&!n;!t.intro||n?(H.intro=1,H.swept<m*.5&&(H.swept=m)):H.intro<1&&(H.intro=Math.min(1,H.intro+r/re));let a=t.mouseInteraction&&z.inside&&!n?me(t,z.x,z.y):null;R.inside=!!(a&&Math.hypot(a[0],a[1])<.98),a&&(R.x=a[0],R.y=a[1],H.heatX+=(a[0]-H.heatX)*(1-Math.exp(-r*10)),H.heatY+=(a[1]-H.heatY)*(1-Math.exp(-r*10)));let o=+!!R.inside;if(H.heatVelocity+=(120*(o-H.heat)-19*H.heatVelocity)*r,H.heat=g(H.heat+H.heatVelocity*r,0,1.2),i){H.time+=r;let e=.25+.75*g((H.intro-.35)/.65,0,1);ge(t,r*e)}Q();let s=R.echoes.some(e=>H.time-e.time<2.2),c=H.intro<1||H.heat>.001||Math.abs(H.heatVelocity)>.001||s;i||c?G=requestAnimationFrame(ye):q=0},$=()=>{!G&&J&&!document.hidden&&(G=requestAnimationFrame(ye))},be=()=>{let n=K.current,r=Math.max(1,e.clientWidth),i=Math.max(1,e.clientHeight),a=Math.min(n.dpr||window.devicePixelRatio||1,2),o=Math.max(r,i)*a,s=o>ie?a*ie/o:a;B.width=r,B.height=i,B.ratio=s,t.width=Math.max(1,Math.round(r*s)),t.height=Math.max(1,Math.round(i*s)),Q(),$()},xe=t=>{let n=e.getBoundingClientRect();z.x=t.clientX-n.left,z.y=t.clientY-n.top,z.inside=z.x>=0&&z.y>=0&&z.x<=n.width&&z.y<=n.height,$()},Se=t=>{let n=K.current;if(!n.clickPing||n.paused||_()||t.target?.closest?.(a))return;let r=e.getBoundingClientRect(),i=t.clientX-r.left,o=t.clientY-r.top;if(i<0||o<0||i>r.width||o>r.height)return;let s=me(n,i,o);!s||Math.hypot(s[0],s[1])>1.08||(R.x=s[0],R.y=s[1],H.heatX=s[0],H.heatY=s[1],H.heat=Math.max(H.heat,1.05),Y(R),$())},Ce=()=>{z.inside=!1,$()},we=()=>{q=0,$()},Te=typeof ResizeObserver<`u`?new ResizeObserver(be):null;Te?.observe(e);let Ee=typeof IntersectionObserver<`u`?new IntersectionObserver(e=>{J=e.some(e=>e.isIntersecting),J&&(q=0,$())}):null;Ee?.observe(e),window.addEventListener(`pointermove`,xe,{passive:!0}),window.addEventListener(`pointerdown`,Se,{passive:!0}),document.documentElement.addEventListener(`pointerleave`,Ce),document.addEventListener(`visibilitychange`,we),be();let De=K.current.dpr;return W.current=()=>{K.current.dpr===De?(G||Q(),$()):(De=K.current.dpr,be())},()=>{cancelAnimationFrame(G),W.current=null,Te?.disconnect(),Ee?.disconnect(),window.removeEventListener(`pointermove`,xe),window.removeEventListener(`pointerdown`,Se),document.documentElement.removeEventListener(`pointerleave`,Ce),document.removeEventListener(`visibilitychange`,we);for(let e of[j,...M,...N])n.deleteTexture(e.texture),n.deleteFramebuffer(e.framebuffer);for(let e of Object.values(C))n.deleteProgram(e.program);n.deleteBuffer(w),n.deleteBuffer(E),n.deleteBuffer(D),n.deleteVertexArray(T),n.deleteVertexArray(O),n.getExtension(`WEBGL_lose_context`)?.loseContext()}},[]),(0,r.useEffect)(()=>{W.current?.()}),(0,i.jsx)(`div`,{ref:ue,className:`radar-container${V?` ${V}`:``}`,style:{mixBlendMode:B,...H},...U,children:(0,i.jsx)(`canvas`,{ref:de,className:`radar-canvas`,"aria-hidden":`true`})})}export{b as default};