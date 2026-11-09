import{n as e}from"./chunk-WkwZ5CU-.js";import{h as t,m as n}from"./chunk-B2DNQCqq.js";var r=e(t(),1),i=n(),a=`#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`,o=`#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uTarget;
uniform vec2 uRot;
uniform vec2 uPillarRot;
uniform vec2 uWave;
uniform float uShift;
uniform float uPillarWidth;
uniform float uPillarHeight;
uniform int uDetail;
uniform vec3 uTopColor;
uniform vec3 uBottomColor;
uniform float uGlowAmount;
uniform float uWidthNorm;
out vec4 outColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / uTarget;
  vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  uv.x -= uShift;
  uv = vec2(uPillarRot.x * uv.x - uPillarRot.y * uv.y, uPillarRot.y * uv.x + uPillarRot.x * uv.y);

  vec3 ro = vec3(0.0, 0.0, -10.0);
  vec3 rd = normalize(vec3(uv, 1.0));
  vec3 origin = vec3(uRot.x * ro.x - uRot.y * ro.z, ro.y, uRot.y * ro.x + uRot.x * ro.z);
  vec3 dir = vec3(uRot.x * rd.x - uRot.y * rd.z, rd.y, uRot.y * rd.x + uRot.x * rd.z);

  float glow = 0.0;
  float lift = 0.0;
  float t = 0.1;
  for (int i = 0; i < 80; i++) {
    vec3 p = origin + dir * t;
    vec3 q = p;
    q.y = p.y * uPillarHeight + uTime;

    float freq = 1.0;
    float amp = 1.0;
    for (int j = 0; j < 6; j++) {
      if (j >= uDetail) break;
      q.xz = vec2(uWave.y * q.x - uWave.x * q.z, uWave.x * q.x + uWave.y * q.z);
      q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }

    float d = length(cos(q.xz)) - 0.2;
    float bound = length(p.xz) - uPillarWidth;
    float h = max(4.0 - abs(d - bound), 0.0);
    d = max(d, bound) + h * h * 0.015625;
    d = abs(d) * 0.15 + 0.01;

    float weight = 1.0 / d;
    glow += weight;
    lift += clamp((15.0 - p.y) / 30.0, 0.0, 1.0) * weight;

    t += d;
    if (t > 50.0) break;
  }

  vec3 col = tanh((uBottomColor * glow + (uTopColor - uBottomColor) * lift) * uGlowAmount / uWidthNorm);
  float peak = max(col.r, max(col.g, col.b));
  outColor = vec4(col, smoothstep(0.62, 1.0, peak));
}`,s=`#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform vec2 uView;
uniform vec2 uAspect;
uniform vec2 uPillarRot;
uniform float uShift;
uniform float uIntensity;
uniform float uNoiseIntensity;
uniform float uLightMode;
uniform float uNeutral;
uniform float uBloom;
uniform float uFade;
uniform float uReveal;
uniform float uFlare;
uniform vec4 uPulses[3];
out vec4 outColor;

vec3 tap(vec2 uv) {
  return textureLod(uField, uv, 0.0).rgb;
}

vec3 bicubic(vec2 uv) {
  vec2 position = uv * uFieldSize;
  vec2 center = floor(position - 0.5) + 0.5;
  vec2 f = position - center;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 t0 = (center - 1.0) / uFieldSize;
  vec2 t3 = (center + 2.0) / uFieldSize;
  vec2 t12 = (center + w2 / w12) / uFieldSize;
  vec3 result = vec3(0.0);
  result += tap(vec2(t0.x, t0.y)) * w0.x * w0.y;
  result += tap(vec2(t12.x, t0.y)) * w12.x * w0.y;
  result += tap(vec2(t3.x, t0.y)) * w3.x * w0.y;
  result += tap(vec2(t0.x, t12.y)) * w0.x * w12.y;
  result += tap(vec2(t12.x, t12.y)) * w12.x * w12.y;
  result += tap(vec2(t3.x, t12.y)) * w3.x * w12.y;
  result += tap(vec2(t0.x, t3.y)) * w0.x * w3.y;
  result += tap(vec2(t12.x, t3.y)) * w12.x * w3.y;
  result += tap(vec2(t3.x, t3.y)) * w3.x * w3.y;
  return max(result, 0.0);
}

float smootherstep01(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uView;
  vec3 col = bicubic(uv);

  if (uBloom > 0.0) {
    vec4 l3 = textureLod(uField, uv, 3.0);
    vec4 l4 = textureLod(uField, uv, 4.0);
    vec4 l5 = textureLod(uField, uv, 5.0);
    vec4 l6 = textureLod(uField, uv, 6.0);
    float halo = l3.a * 0.3 + l4.a * 0.3 + l5.a * 0.25 + l6.a * 0.15;
    vec3 tint = l4.rgb + l5.rgb;
    tint /= max(max(tint.r, max(tint.g, tint.b)), 0.001);
    vec3 glow = clamp(tint * halo * uBloom * 1.1, 0.0, 1.0);
    col = 1.0 - (1.0 - clamp(col, 0.0, 1.0)) * (1.0 - glow);
  }

  vec2 p = (uv * 2.0 - 1.0) * uAspect;
  p.x -= uShift;
  float axis = uPillarRot.y * p.x + uPillarRot.x * p.y;

  float boost = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 pulse = uPulses[i];
    if (pulse.y <= 0.0) continue;
    float offset = (axis - pulse.x) / 0.24;
    boost += exp(-offset * offset) * pulse.y;
  }
  float head = (axis - uReveal + 0.35) / 0.3;
  boost += exp(-head * head) * uFlare;
  float lum = max(col.r, max(col.g, col.b));
  col += mix(col, vec3(lum), 0.45) * boost * 1.8;

  col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;
  vec3 result = clamp(col * uIntensity, 0.0, 1.0);

  float mask = smoothstep(uReveal, uReveal - 0.9, axis);
  float edge = uFade * 0.5;
  if (edge > 0.0) {
    mask *= smootherstep01(uv.x / edge) * smootherstep01((1.0 - uv.x) / edge);
    mask *= smootherstep01(uv.y / edge) * smootherstep01((1.0 - uv.y) / edge);
  }

  if (uLightMode > 0.5) {
    float energy = max(result.r, max(result.g, result.b));
    vec3 hue = result / max(energy, 0.001);
    float coverage = smoothstep(0.025, 0.95, energy);
    hue = pow(clamp(hue, 0.0, 1.0), vec3(1.25));
    vec3 tinted = mix(vec3(1.0), hue, coverage * 0.94 * mask);
    vec3 ink = vec3(1.0) - pow(result, vec3(1.6)) * 0.85 * mask;
    result = mix(tinted, ink, uNeutral);
  } else {
    result *= mask;
  }
  outColor = vec4(result, 1.0);
}`,c={low:.35,medium:.5,high:.6},l=2.1,u=1.4,d=.25,f=(e,t,n)=>Math.min(n,Math.max(t,e)),p=e=>1-(1-e)**3,m=e=>e*e*e*(e*(e*6-15)+10),h=()=>typeof window>`u`?!1:typeof document<`u`&&document.querySelector(`[data-reduced-motion="true"]`)?!0:window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches??!1,g=e=>{let t=e.trim();if(!t.startsWith(`#`))return null;if(t.length===4){let e=parseInt(t[1]+t[1],16),n=parseInt(t[2]+t[2],16),r=parseInt(t[3]+t[3],16);return Number.isNaN(e)||Number.isNaN(n)||Number.isNaN(r)?null:[e/255,n/255,r/255]}if(t.length===7){let e=parseInt(t.slice(1),16);return Number.isNaN(e)?null:[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}return null},_=(e,t,n)=>{let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null},v=(e,t)=>{let n=_(e,e.VERTEX_SHADER,a),r=_(e,e.FRAGMENT_SHADER,t),i=e.createProgram();if(!n||!r||!i)return null;if(e.attachShader(i,n),e.attachShader(i,r),e.bindAttribLocation(i,0,`aPosition`),e.linkProgram(i),e.deleteShader(n),e.deleteShader(r),!e.getProgramParameter(i,e.LINK_STATUS))return e.deleteProgram(i),null;let o={},s=e.getProgramParameter(i,e.ACTIVE_UNIFORMS);for(let t=0;t<s;t+=1){let n=e.getActiveUniform(i,t);n&&(o[n.name.replace(/\[0\]$/,``)]=e.getUniformLocation(i,n.name))}return{program:i,uniforms:o}},y=({topColor:e=`#5227FF`,bottomColor:t=`#FF9FFC`,intensity:n=1,rotationSpeed:a=.3,flow:_=1,interactive:y=!0,clickPulse:b=!0,glowAmount:x=.002,bloom:S=.5,pillarWidth:C=3,pillarHeight:w=.4,pillarRotation:T=25,twist:E=.4,detail:D=4,noiseIntensity:O=.5,fade:k=0,intro:A=!0,mixBlendMode:j=`screen`,quality:M=`high`,resolution:N,lightMode:P=!1,paused:F=!1,className:I=``,style:L})=>{let R=(0,r.useRef)(null),z=(0,r.useRef)(null),B=(0,r.useRef)(null),[V,ee]=(0,r.useState)(0),H={topColor:String(e),bottomColor:String(t),intensity:Math.max(0,n),rotationSpeed:a,flow:_,interactive:y,clickPulse:b,glowAmount:Math.max(0,x),bloom:Math.max(0,S),pillarWidth:Math.max(.05,C),pillarHeight:w,pillarRotation:T,twist:E,detail:Math.round(f(D,1,6)),noiseIntensity:Math.max(0,O),fade:f(k,0,1),intro:A,scale:f(N??c[M]??c.high,d,2),lightMode:P,paused:F},U=(0,r.useRef)(H);return U.current=H,(0,r.useEffect)(()=>{let e=R.current,t=z.current,n=t?.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,powerPreference:`high-performance`});if(!e||!t||!n)return;let r=!!n.getExtension(`EXT_color_buffer_float`),i=v(n,o),a=v(n,s);if(!i||!a)return;let c=e=>{e.preventDefault()},_=()=>ee(e=>e+1);t.addEventListener(`webglcontextlost`,c),t.addEventListener(`webglcontextrestored`,_);let y=n.createBuffer(),b=n.createVertexArray();n.bindVertexArray(b),n.bindBuffer(n.ARRAY_BUFFER,y),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0);let x=null,S=n.createFramebuffer(),C={width:0,height:0},w=(e,t)=>{if(C.width===e&&C.height===t)return;C.width=e,C.height=t,x&&n.deleteTexture(x),x=n.createTexture(),n.bindTexture(n.TEXTURE_2D,x);let i=Math.floor(Math.log2(Math.max(e,t)))+1;n.texStorage2D(n.TEXTURE_2D,i,r?n.RGBA16F:n.RGBA8,e,t),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR_MIPMAP_LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),n.bindFramebuffer(n.FRAMEBUFFER,S),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,x,0)},T=document.createElement(`canvas`).getContext(`2d`,{willReadFrequently:!0}),E=new Map,D=e=>{let t=E.get(e);if(t)return t;let n=g(e),r=n??[1,1,1];if(!n&&T){T.clearRect(0,0,1,1),T.fillStyle=`#ffffff`,T.fillStyle=e,T.fillRect(0,0,1,1);let[t,n,i]=T.getImageData(0,0,1,1).data;r=[t/255,n/255,i/255]}return E.set(e,r),r},O=h(),k={width:1,height:1,ratio:1},A={x:0,y:0,inside:!1},j=[],M=new Float32Array(12),N={clock:0,intro:U.current.intro&&!O?0:1,touch:0,spin:0,lean:0,shift:0,governor:1,slow:0,quick:0},P=0,F=0,I=!0,L=(e,t,n)=>{let r=k.width/k.height,i=(e/k.width*2-1)*r-N.shift,a=1-t/k.height*2;return Math.sin(n)*i+Math.cos(n)*a},V=()=>{let e=U.current,r=Math.max(d,e.scale*N.governor),o=Math.max(1,Math.round(k.width*r)),s=Math.max(1,Math.round(k.height*r));w(o,s);let c=m(N.intro),l=p(N.intro),h=(e.pillarRotation+N.lean)*Math.PI/180,g=N.clock*.3+N.spin,_=e.pillarWidth*(.3+.7*c);n.bindVertexArray(b);let v=i.uniforms;n.bindFramebuffer(n.FRAMEBUFFER,S),n.viewport(0,0,C.width,C.height),n.useProgram(i.program),n.uniform1f(v.uTime,N.clock*e.flow),n.uniform2f(v.uResolution,k.width,k.height),n.uniform2f(v.uTarget,C.width,C.height),n.uniform2f(v.uRot,Math.cos(g),Math.sin(g)),n.uniform2f(v.uPillarRot,Math.cos(h),Math.sin(h)),n.uniform2f(v.uWave,Math.sin(e.twist),Math.cos(e.twist)),n.uniform1f(v.uShift,N.shift),n.uniform1f(v.uPillarWidth,_),n.uniform1f(v.uPillarHeight,e.pillarHeight),n.uniform1i(v.uDetail,e.detail),n.uniform3fv(v.uTopColor,D(e.topColor)),n.uniform3fv(v.uBottomColor,D(e.bottomColor)),n.uniform1f(v.uGlowAmount,e.glowAmount),n.uniform1f(v.uWidthNorm,_/3),n.drawArrays(n.TRIANGLES,0,3),n.bindTexture(n.TEXTURE_2D,x),e.bloom>0&&n.generateMipmap(n.TEXTURE_2D),M.fill(0),j.forEach((e,t)=>{M.set([e.axis+e.age*1.7,Math.exp(-e.age/(u*.45)),0,0],t*4)});let y=a.uniforms;n.bindFramebuffer(n.FRAMEBUFFER,null),n.viewport(0,0,t.width,t.height),n.useProgram(a.program),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,x),n.uniform1i(y.uField,0),n.uniform2f(y.uFieldSize,C.width,C.height),n.uniform2f(y.uView,t.width,t.height),n.uniform2f(y.uAspect,k.width/k.height,1),n.uniform2f(y.uPillarRot,Math.cos(h),Math.sin(h)),n.uniform1f(y.uShift,N.shift),n.uniform1f(y.uIntensity,e.intensity*(.15+.85*l)*(1+.12*N.touch)),n.uniform1f(y.uNoiseIntensity,e.noiseIntensity),n.uniform1f(y.uLightMode,+!!e.lightMode);let T=e=>Math.max(...e)-Math.min(...e),E=Math.max(T(D(e.topColor)),T(D(e.bottomColor)));n.uniform1f(y.uNeutral,1-f((E-.08)/.12,0,1)),n.uniform1f(y.uBloom,e.bloom),n.uniform1f(y.uFade,e.fade);let O=k.width/k.height+1.2;n.uniform1f(y.uReveal,N.intro>=1?1e4:-O+l*(O*2+1.2)),n.uniform1f(y.uFlare,N.intro>=1?0:(1-l)*1.3*Math.min(1,N.intro*8)),n.uniform4fv(y.uPulses,M),n.drawArrays(n.TRIANGLES,0,3)},H=e=>{e>1/40?(N.slow+=1,N.quick=0):e<1/55&&(N.quick+=1,N.slow=0),N.slow>20?(N.governor=Math.max(.5,N.governor*.85),N.slow=0):N.quick>180&&N.governor<1&&(N.governor=Math.min(1,N.governor*1.1),N.quick=0)},W=e=>{if(P=0,!I||document.hidden)return;let t=U.current,n=h(),r=F?Math.min(.05,(e-F)/1e3):1/60;F&&H((e-F)/1e3),F=e;let i=!t.paused&&!n&&t.rotationSpeed!==0;i&&(N.clock+=r*.96*t.rotationSpeed),!t.intro||n?N.intro=1:N.intro<1&&(N.intro=Math.min(1,N.intro+r/l));let a=t.interactive&&A.inside&&!n,o=a?A.x/k.width-.5:0,s=1-Math.exp(-r*2.4);N.spin+=(o*1.4-N.spin)*s,N.lean+=(o*9-N.lean)*s,N.shift+=(o*.35*(k.width/k.height)-N.shift)*s,N.touch+=(+!!a-N.touch)*(1-Math.exp(-r*3));for(let e=j.length-1;e>=0;--e)j[e].age+=r,j[e].age>u*2.2&&j.splice(e,1);V();let c=N.intro<1||j.length>0||Math.abs(o*1.4-N.spin)>5e-4||Math.abs(+!!a-N.touch)>.002;i||c?P=requestAnimationFrame(W):F=0},G=()=>{!P&&I&&!document.hidden&&(P=requestAnimationFrame(W))},K=()=>{let n=Math.max(1,e.clientWidth),r=Math.max(1,e.clientHeight),i=Math.min(window.devicePixelRatio||1,2);k.width=n,k.height=r,k.ratio=i,t.width=Math.max(1,Math.round(n*i)),t.height=Math.max(1,Math.round(r*i)),P||V(),G()},q=t=>{let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top;return{x:r,y:i,inside:r>=0&&i>=0&&r<=n.width&&i<=n.height}},J=e=>{let t=q(e);A.x=t.x,A.y=t.y,A.inside=t.inside,G()},Y=e=>{let t=U.current;if(!t.clickPulse||h()||e.target instanceof Element&&e.target.closest(`a, button, input, textarea, select, label, [role="button"], [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="dialog"]`))return;let n=q(e);if(!n.inside)return;let r=(t.pillarRotation+N.lean)*Math.PI/180;j.push({axis:L(n.x,n.y,r),age:0}),j.length>3&&j.shift(),G()},X=()=>{A.inside=!1,G()},Z=()=>{F=0,G()},Q=typeof ResizeObserver<`u`?new ResizeObserver(K):null;Q?.observe(e);let $=typeof IntersectionObserver<`u`?new IntersectionObserver(e=>{I=e.some(e=>e.isIntersecting),I&&(F=0,G())}):null;return $?.observe(e),window.addEventListener(`pointermove`,J,{passive:!0}),window.addEventListener(`pointerdown`,Y,{passive:!0}),document.documentElement.addEventListener(`pointerleave`,X),document.addEventListener(`visibilitychange`,Z),K(),B.current=()=>{P||V(),G()},()=>{cancelAnimationFrame(P),B.current=null,t.removeEventListener(`webglcontextlost`,c),t.removeEventListener(`webglcontextrestored`,_),Q?.disconnect(),$?.disconnect(),window.removeEventListener(`pointermove`,J),window.removeEventListener(`pointerdown`,Y),document.documentElement.removeEventListener(`pointerleave`,X),document.removeEventListener(`visibilitychange`,Z),x&&n.deleteTexture(x),n.deleteFramebuffer(S),n.deleteProgram(i.program),n.deleteProgram(a.program),n.deleteBuffer(y),n.deleteVertexArray(b),n.isContextLost()||n.getExtension(`WEBGL_lose_context`)?.loseContext()}},[V]),(0,r.useEffect)(()=>{B.current?.()}),(0,i.jsx)(`div`,{ref:R,className:`light-pillar-container${I?` ${I}`:``}`,style:{mixBlendMode:j,...L},children:(0,i.jsx)(`canvas`,{ref:z,className:`light-pillar-canvas`,"aria-hidden":`true`})})};export{y as default};