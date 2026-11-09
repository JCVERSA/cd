import{n as e}from"./chunk-WkwZ5CU-.js";import{h as t,m as n}from"./chunk-B2DNQCqq.js";var r=e(t(),1),i=n(),a=50,o=20,s=1.5,c=16,l=12,u=.01,d={satin:{roughness:.42,metalness:0,coat:.35,coatRoughness:.22,scatter:1,frost:0},matte:{roughness:.92,metalness:0,coat:0,coatRoughness:.5,scatter:.5,frost:0},gloss:{roughness:.2,metalness:0,coat:1,coatRoughness:.08,scatter:1,frost:0},frosted:{roughness:.55,metalness:0,coat:.6,coatRoughness:.18,scatter:1.5,frost:1},metal:{roughness:.3,metalness:1,coat:0,coatRoughness:.2,scatter:0,frost:0}},f=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aSphere;
layout(location = 2) in vec4 aColor;
layout(location = 3) in vec4 aShade;
uniform mat4 uProj;
uniform float uCameraZ;
uniform float uPixel;
out vec3 vPoint;
flat out vec3 vCenter;
flat out float vRadius;
flat out vec4 vColor;
flat out vec4 vShade;
void main() {
  vec3 c = vec3(aSphere.xy, aSphere.z - uCameraZ);
  float r = aSphere.w;
  float d = length(c);
  vec3 toCamera = -c / d;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCamera));
  vec3 up = cross(toCamera, right);
  float reach = r * d / sqrt(max(d * d - r * r, 1e-4)) + uPixel * d * 2.0;
  vec3 p = c + (right * aCorner.x + up * aCorner.y) * reach;
  vPoint = p;
  vCenter = c;
  vRadius = r;
  vColor = aColor;
  vShade = aShade;
  gl_Position = uProj * vec4(p, 1.0);
}`,p=`#version 300 es
precision highp float;
in vec3 vPoint;
flat in vec3 vCenter;
flat in float vRadius;
flat in vec4 vColor;
flat in vec4 vShade;
uniform mat4 uProj;
uniform vec3 uLightPos;
uniform vec3 uLight;
uniform float uExposure;
uniform float uShadow;
uniform vec4 uSurface;
uniform vec2 uExtra;
out vec4 outColor;

const float PI = 3.14159265;

float lobe(vec3 d, vec3 axis, float sharp) {
  return pow(max(dot(d, axis), 0.0), sharp) * (sharp + 1.0) * 0.16;
}

vec3 studio(vec3 d, float rough) {
  float r = clamp(rough, 0.0, 1.0);
  float sharp = mix(60.0, 1.2, sqrt(r));
  vec3 col = mix(vec3(0.085, 0.085, 0.09), vec3(0.38, 0.38, 0.39), smoothstep(-0.7, 0.9, d.y));
  col += vec3(1.0, 0.99, 0.97) * 2.6 * lobe(d, normalize(vec3(-0.42, 0.78, 0.47)), sharp);
  col += vec3(0.97, 0.98, 1.0) * 1.1 * lobe(d, normalize(vec3(0.78, 0.22, 0.58)), sharp * 0.7);
  col += vec3(1.0) * 1.3 * lobe(d, normalize(vec3(0.15, 0.55, -0.82)), sharp * 0.8);
  return col;
}

vec2 envBRDF(float NoV, float rough) {
  vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1;
  float a = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a + r.zw;
}

float ggx(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float smith(float NoV, float NoL, float a) {
  float k = a * 0.5;
  return 0.25 / max((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k), 1e-4);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 rd = normalize(vPoint);
  float b = dot(vCenter, rd);
  float h = length(vCenter - rd * b);
  float r = vRadius;
  float aa = max(fwidth(h), 1e-5);
  float cover = clamp((r - h) / aa + 0.5, 0.0, 1.0);
  if (cover <= 0.002) discard;
  float hc = min(h, r * 0.9995);
  float t = b - sqrt(r * r - hc * hc);
  vec3 pos = rd * t;
  vec3 n = normalize(pos - vCenter);
  vec4 clip = uProj * vec4(pos, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

  vec3 v = -rd;
  vec3 albedo = vColor.rgb;
  bool lamp = vColor.a > 0.5;
  vec3 dn = fwidth(n);
  float rough = sqrt(min(uSurface.x * uSurface.x + dot(dn, dn) * 0.6, 1.0));
  float metal = uSurface.y;
  float coat = uSurface.z;
  float coatRough = sqrt(min(uSurface.w * uSurface.w + dot(dn, dn) * 0.6, 1.0));
  float NoV = clamp(dot(n, v), 1e-4, 1.0);
  vec3 R = reflect(-v, n);

  float occlusion = vShade.w * smoothstep(-0.15, 0.9, dot(n, vShade.xyz));
  float ao = 1.0 - uShadow * occlusion;
  float specAo = 1.0 - uShadow * occlusion * 0.7;

  vec3 L = uLightPos - pos;
  float dist2 = dot(L, L);
  L *= inversesqrt(dist2);
  vec3 radiance = lamp ? vec3(0.0) : uLight / (dist2 + 1.0);
  float NoL = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + v);
  float NoH = clamp(dot(n, H), 0.0, 1.0);
  float VoH = clamp(dot(v, H), 0.0, 1.0);

  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec2 ab = envBRDF(NoV, rough);
  vec3 Fr = max(vec3(1.0 - rough), F0) - F0;
  vec3 kS = F0 + Fr * pow(1.0 - NoV, 5.0);
  vec3 diffuseColor = albedo * (1.0 - metal);
  vec3 irradiance = studio(n, 1.0) * 1.15;
  vec3 envSpec = studio(R, rough) * (F0 * ab.x + ab.y);
  vec3 col = diffuseColor * irradiance * (1.0 - kS) * ao + envSpec * specAo;
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
  float a = max(rough * rough, 0.06);
  vec3 spec = ggx(NoH, a) * smith(NoV, NoL, a) * F;
  float wrap = clamp((dot(n, L) + 0.3) / 1.3, 0.0, 1.0);
  col += (diffuseColor * (1.0 - F) / PI * wrap + spec * NoL) * radiance;
  vec3 sh = normalize(L + n * 0.1);
  float scatter = pow(clamp(dot(v, -sh), 0.0, 1.0), 2.0) * 10.0 + 0.04;
  col += scatter * albedo * radiance * 0.03 * uExtra.x;
  float alpha = 1.0;
  if (uExtra.y > 0.5) {
    float rim = pow(1.0 - NoV, 2.5);
    col += albedo * (studio(-R, 1.0) * 0.35 + 0.06) * (1.0 - rim);
    col += radiance * albedo * pow(max(dot(-v, L), 0.0), 3.0) * 0.08;
    alpha = mix(0.5, 0.96, rim);
  }
  if (coat > 0.0) {
    float Fc = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    float ca = max(coatRough * coatRough, 0.03);
    vec3 coatEnv = studio(R, coatRough) * Fc;
    float coatSpec = ggx(NoH, ca) * smith(NoV, NoL, ca) * (0.04 + 0.96 * pow(1.0 - VoH, 5.0)) * NoL;
    col = col * (1.0 - Fc * coat) + (coatEnv * specAo + radiance * coatSpec) * coat;
    alpha = mix(alpha, 1.0, Fc * coat);
  }
  if (lamp) col += uLight * 0.0025 * (0.4 + 0.6 * albedo);
  col = aces(col * uExposure);
  col = pow(col, vec3(1.0 / 2.2));
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  float a2 = alpha * cover;
  outColor = vec4(col * a2, a2);
}`,m=(e,t,n)=>Math.min(n,Math.max(t,e)),h=()=>typeof window>`u`?!1:typeof document<`u`&&document.querySelector(`[data-reduced-motion="true"]`)?!0:window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches??!1,g=(e,t,n)=>{let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null},_=e=>{let t=g(e,e.VERTEX_SHADER,f),n=g(e,e.FRAGMENT_SHADER,p),r=e.createProgram();if(!t||!n||!r)return null;if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),e.deleteShader(t),e.deleteShader(n),!e.getProgramParameter(r,e.LINK_STATUS))return e.deleteProgram(r),null;let i={},a=e.getProgramParameter(r,e.ACTIVE_UNIFORMS);for(let t=0;t<a;t+=1){let n=e.getActiveUniform(r,t);n&&(i[n.name]=e.getUniformLocation(r,n.name))}return{program:r,uniforms:i}},ee=e=>{let t;if(typeof e==`number`)t=[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255];else{let n=String(e||`#ffffff`).replace(`#`,``).trim();(n.length===3||n.length===4)&&(n=n.slice(0,3).split(``).map(e=>e+e).join(``));let r=parseInt(n.slice(0,6),16);t=Number.isNaN(r)?[1,1,1]:[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}return[t[0]**2.2,t[1]**2.2,t[2]**2.2]},v=({count:e=200,colors:t=[`#ffffff`],material:n=`satin`,minSize:f=.5,maxSize:p=1,gravity:g=.5,friction:v=.9975,wallBounce:y=.95,bounce:te=.85,depth:b=2,drift:x=0,followCursor:S=!0,cursorSize:C=1,grab:w=!0,clickEffect:T=`burst`,lightColor:E=`#ffffff`,lightIntensity:D=1,exposure:O=1,shadows:k=.6,intro:A=!0,dpr:j,paused:M=!1,className:N=``,style:P})=>{let ne=(0,r.useRef)(null),re=(0,r.useRef)(null),ie=(0,r.useRef)(null),F={count:Math.round(m(e,1,4e3)),colors:Array.isArray(t)&&t.length?t:[`#ffffff`],material:d[n]?n:`satin`,minSize:Math.max(.05,Math.min(f,p)),maxSize:Math.max(.05,Math.max(f,p)),gravity:g,friction:m(v,.5,1),wallBounce:m(y,0,1),bounce:m(te,0,1),depth:Math.max(0,b),drift:Math.max(0,x),followCursor:S,cursorSize:Math.max(0,C),grab:w,clickEffect:T,lightColor:E,lightIntensity:D>20?D/200:Math.max(0,D),exposure:Math.max(0,O),shadows:m(k,0,1),intro:A,dpr:j,paused:M},I=(0,r.useRef)(F);return I.current=F,(0,r.useEffect)(()=>{let e=ne.current,t=re.current,n=t?.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!0,stencil:!1,powerPreference:`high-performance`});if(!e||!t||!n)return;let r=_(n);if(!r)return;let i=r.uniforms,f={width:1,height:1,ratio:1,halfW:9,halfH:9,fit:1,tan:Math.tan(a*Math.PI/360)},p=new Float32Array(16),g=n.createVertexArray();n.bindVertexArray(g);let v=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,v),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),n.STATIC_DRAW),n.enableVertexAttribArray(0),n.vertexAttribPointer(0,2,n.FLOAT,!1,0,0);let y=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,y);for(let e=0;e<3;e+=1)n.enableVertexAttribArray(1+e),n.vertexAttribPointer(1+e,4,n.FLOAT,!1,48,e*16),n.vertexAttribDivisor(1+e,1);n.bindVertexArray(null);let te=0,b=0,x=new Float32Array,S=new Float32Array,C=new Float32Array,w=new Float32Array,T=new Float32Array,E=new Float32Array,D=new Float32Array,O=new Float32Array,k=new Float32Array,A=new Float32Array,j=new Float32Array,M=new Float32Array,N=new Uint16Array,P=new Uint8Array,F=new Int32Array,ae=new Int32Array,L=new Int32Array(1),R=new Float32Array(l),z=new Int32Array(2),oe=new Int32Array(2),se=[],ce=``,le=``,ue=e=>{let t=(t,n=1)=>{let r=new Float32Array(e*n);return r.set(t.subarray(0,Math.min(t.length,r.length))),r},r=t=>{let n=new Uint8Array(e);return n.set(t.subarray(0,Math.min(t.length,n.length))),n};x=t(x),S=t(S),C=t(C),w=t(w),T=t(T),E=t(E),D=t(D),O=t(O),k=t(k),A=t(A),j=t(j,4),M=t(M,3);let i=new Uint16Array(e);i.set(N.subarray(0,Math.min(N.length,e))),N=i,P=r(P),F=new Int32Array(e),ae=new Int32Array(e),L=new Int32Array(e+1),R=new Float32Array((e+1)*l),te=e,n.bindBuffer(n.ARRAY_BUFFER,y),n.bufferData(n.ARRAY_BUFFER,R.byteLength,n.DYNAMIC_DRAW)},B={x:0,y:0,inside:!1,down:!1,downX:0,downY:0,downAt:0,moved:!1},V={x:0,y:0,z:0,r:0,tx:0,ty:0,vx:0,vy:0},H={x:0,y:5,z:6,flash:0},U={index:-1,ox:0,oy:0,tx:0,ty:0,vx:0,vy:0},W=0,G=0,K=0,q=0,J=!0,de=0,fe=(e,t,n)=>{let r=D[e],i=Math.max(t.depth-r,0);if(P[e]=1,n&&t.gravity>.05)x[e]=(Math.random()*2-1)*Math.max(f.halfW-r,.01),S[e]=f.halfH+r+Math.random()*f.halfH*2.2,C[e]=(Math.random()*2-1)*i,w[e]=(Math.random()-.5)*2,T[e]=-(4+Math.random()*5),E[e]=0,P[e]=0;else if(n){let t=(Math.random()*2-1)*Math.max(f.halfW-r,.01),n=(Math.random()*2-1)*Math.max(f.halfH-r,.01),a=(Math.random()*2-1)*i;x[e]=(Math.random()*2-1)*.6,S[e]=(Math.random()*2-1)*.6,C[e]=(Math.random()*2-1)*Math.min(i,.3),w[e]=(t-x[e])*2.2,T[e]=(n-S[e])*2.2,E[e]=(a-C[e])*2.2,G=1}else x[e]=(Math.random()*2-1)*Math.max(f.halfW-r,.01),S[e]=(Math.random()*2-1)*Math.max(f.halfH-r,.01),C[e]=(Math.random()*2-1)*i,w[e]=0,T[e]=0,E[e]=0},pe=e=>{for(let t=0;t<b;t+=1)D[t]=(e.minSize+k[t]*(e.maxSize-e.minSize))*f.fit,O[t]=1/(D[t]*D[t]*D[t])},me=e=>{se=e.colors.map(ee),ce=e.colors.join(`|`)},he=(e,t)=>{let n=h(),r=`${e.minSize}:${e.maxSize}:${f.fit}`;if(e.count!==b){e.count>te&&ue(Math.max(e.count,Math.ceil(te*1.5)));let r=b;b=e.count;for(let i=r;i<b;i+=1)k[i]=Math.random(),N[i]=i,A[i]=Math.random()*Math.PI*2,D[i]=(e.minSize+k[i]*(e.maxSize-e.minSize))*f.fit,O[i]=1/(D[i]*D[i]*D[i]),fe(i,e,(!t||e.intro)&&!n);for(let e=0;e<=b;e+=1)L[e]=e}r!==le&&(le=r,pe(e)),e.colors.join(`|`)!==ce&&me(e)},Y=new Float32Array,X=0,Z={scale:1,x0:0,y0:0,z0:0,nx:1,ny:1,nz:1},ge=(e,t)=>{Z.scale=1/e,Z.x0=-f.halfW-e,Z.y0=-f.halfH-e,Z.z0=-Math.max(t.depth,t.maxSize)-e,Z.nx=Math.max(1,Math.ceil((f.halfW*2+e*2)*Z.scale)+1),Z.ny=Math.max(1,Math.ceil((f.halfH*2+e*2)*Z.scale)+1),Z.nz=Math.max(1,Math.ceil((Math.max(t.depth,t.maxSize)*2+e*2)*Z.scale)+1);let n=Z.nx*Z.ny*Z.nz;z.length<n+1&&(z=new Int32Array(n+1),oe=new Int32Array(n+1)),z.fill(0,0,n+1);for(let e=0;e<b;e+=1){let t=m(Math.floor((x[e]-Z.x0)*Z.scale),0,Z.nx-1),n=m(Math.floor((S[e]-Z.y0)*Z.scale),0,Z.ny-1),r=(m(Math.floor((C[e]-Z.z0)*Z.scale),0,Z.nz-1)*Z.ny+n)*Z.nx+t;F[e]=r,z[r+1]+=1}for(let e=1;e<=n;e+=1)z[e]+=z[e-1];oe.set(z.subarray(0,n+1));for(let e=0;e<b;e+=1)ae[oe[F[e]]++]=e},Q=(e,t,n,r,i,a,o)=>{if(t>=o||X*8>=Y.length)return;let s=w[e]*n+T[e]*r+E[e]*i,c=X*8;Y[c]=e,Y[c+1]=-2,Y[c+2]=n,Y[c+3]=r,Y[c+4]=i,Y[c+5]=t,Y[c+6]=s<-1.5?-a*s:0,Y[c+7]=0,X+=1},_e=(e,t,n)=>{let r=U.index,{nx:i,ny:a,nz:o}=Z;X=0;for(let s=0;s<b;s+=1){let c=F[s],l=c%i,u=Math.floor(c/i)%a,d=Math.floor(c/(i*a));for(let c=d>0?-1:0;c<=+(d<o-1);c+=1)for(let o=u>0?-1:0;o<=+(u<a-1);o+=1){let f=((d+c)*a+u+o)*i;for(let a=l>0?-1:0;a<=+(l<i-1);a+=1){let i=f+l+a;for(let a=z[i];a<z[i+1];a+=1){let i=ae[a];if(i<=s)continue;let o=x[i]-x[s],c=S[i]-S[s],l=C[i]-C[s],u=o*o+c*c+l*l,d=D[s]+D[i],f=Math.max(d+n,t?d*1.4:0);if(u>=f*f||u<1e-12)continue;let p=Math.sqrt(u),h=o/p,g=c/p,_=l/p;if(t){let e=m(1-(p-d)/(d*.4),0,1);j[s*4]+=h*e,j[s*4+1]+=g*e,j[s*4+2]+=_*e,j[s*4+3]+=e,j[i*4]-=h*e,j[i*4+1]-=g*e,j[i*4+2]-=_*e,j[i*4+3]+=e}if(p>=d+n||X*8>=Y.length||s===r&&i===r)continue;let ee=(w[i]-w[s])*h+(T[i]-T[s])*g+(E[i]-E[s])*_,v=X*8;Y[v]=s,Y[v+1]=i,Y[v+2]=h,Y[v+3]=g,Y[v+4]=_,Y[v+5]=p-d,Y[v+6]=ee<-1.5?-e.bounce*ee:0,Y[v+7]=0,X+=1}}}if(s!==r){let t=D[s],r=Math.max(e.depth-t,0);Q(s,x[s]+f.halfW-t,1,0,0,e.wallBounce,n),Q(s,f.halfW-t-x[s],-1,0,0,e.wallBounce,n),Q(s,S[s]+f.halfH-t,0,1,0,e.wallBounce,n),P[s]&&Q(s,f.halfH-t-S[s],0,-1,0,e.wallBounce,n),Q(s,C[s]+r,0,0,1,e.wallBounce,n),Q(s,r-C[s],0,0,-1,e.wallBounce,n)}if(V.r>.01&&s!==r&&X*8<Y.length){let t=x[s]-V.x,r=S[s]-V.y,i=C[s]-V.z,a=D[s]+V.r,o=t*t+r*r+i*i;if(o<(a+n)*(a+n)&&o>1e-12){let n=Math.sqrt(o),c=t/n,l=r/n,u=i/n,d=(w[s]-V.vx)*c+(T[s]-V.vy)*l+E[s]*u,f=X*8;Y[f]=s,Y[f+1]=-1,Y[f+2]=c,Y[f+3]=l,Y[f+4]=u,Y[f+5]=n-a,Y[f+6]=d<-1.5?-e.bounce*d:0,Y[f+7]=0,X+=1}}}},ve=e=>{let t=U.index,n=b>800?5:8;for(let r=0;r<n;r+=1)for(let n=0;n<X;n+=1){let r=n*8,i=Y[r],a=Y[r+1],o=Y[r+2],s=Y[r+3],c=Y[r+4],l=Y[r+5],u=l>0?-l/e:Y[r+6],d=Y[r+7];if(a<0){let e=a===-1?(w[i]-V.vx)*o+(T[i]-V.vy)*s+E[i]*c:w[i]*o+T[i]*s+E[i]*c,t=Math.max(d+u-e,0),n=t-d;Y[r+7]=t,w[i]+=n*o,T[i]+=n*s,E[i]+=n*c;continue}let f=i===t?0:O[i],p=a===t?0:O[a],m=f+p;if(m<=0)continue;let h=(w[a]-w[i])*o+(T[a]-T[i])*s+(E[a]-E[i])*c,g=Math.max(d+(u-h)/m,0),_=g-d;Y[r+7]=g,w[i]-=_*f*o,T[i]-=_*f*s,E[i]-=_*f*c,w[a]+=_*p*o,T[a]+=_*p*s,E[a]+=_*p*c}},ye=()=>{let e=U.index;for(let t=0;t<2;t+=1)for(let t=0;t<X;t+=1){let n=t*8,r=Y[n],i=Y[n+1];if(i===-2)continue;if(i<0){let e=x[r]-V.x,t=S[r]-V.y,n=C[r]-V.z,i=Math.sqrt(e*e+t*t+n*n),a=D[r]+V.r-i-u;if(a<=0||i<1e-6)continue;let o=a*.5/i;x[r]+=e*o,S[r]+=t*o,C[r]+=n*o;continue}let a=x[i]-x[r],o=S[i]-S[r],s=C[i]-C[r],c=Math.sqrt(a*a+o*o+s*s),l=D[r]+D[i]-c-u;if(l<=0||c<1e-6)continue;let d=r===e?0:O[r],f=i===e?0:O[i],p=d+f;if(p<=0)continue;let m=l*.3/(c*p);x[r]-=a*m*d,S[r]-=o*m*d,C[r]-=s*m*d,x[i]+=a*m*f,S[i]+=o*m*f,C[i]+=s*m*f}},be=e=>{let t=f.halfW,n=f.halfH,r=e.wallBounce;for(let i=0;i<b;i+=1){let a=D[i];x[i]<-t+a?(x[i]=-t+a,w[i]<0&&(w[i]=w[i]<-1.5?-w[i]*r:0)):x[i]>t-a&&(x[i]=t-a,w[i]>0&&(w[i]=w[i]>1.5?-w[i]*r:0)),S[i]<-n+a?(S[i]=-n+a,T[i]<0&&(T[i]=T[i]<-1.5?-T[i]*r:0),w[i]*=.995,E[i]*=.995):P[i]&&S[i]>n-a&&(S[i]=n-a,T[i]>0&&(T[i]=T[i]>1.5?-T[i]*r:0)),!P[i]&&S[i]<n-a&&(P[i]=1);let o=Math.max(e.depth-a,0);C[i]<-o?(C[i]=-o,E[i]<0&&(E[i]=E[i]<-1.5?-E[i]*r:0)):C[i]>o&&(C[i]=o,E[i]>0&&(E[i]=E[i]>1.5?-E[i]*r:0))}},xe=(e,t,n,r)=>{let i=e.gravity*45,a=e.friction**(t*60)*(G>0?Math.exp(-2.2*t):1),o=r?0:e.drift*2.2,s=e.maxSize*f.fit,l=s*.3;Y.length<b*96&&(Y=new Float32Array(b*96));for(let e=0;e<b;e+=1){if(e===U.index){let n=1-Math.exp(-t/.02);w[e]=(U.tx-x[e])*n/t,T[e]=(U.ty-S[e])*n/t,E[e]=0;continue}if(T[e]-=i*t,o){let n=A[e];w[e]+=Math.sin(W*.63+n)*o*t,T[e]+=Math.cos(W*.47+n*1.7)*o*t,E[e]+=Math.sin(W*.41+n*2.3)*o*t*.5}w[e]*=a,T[e]*=a,E[e]*=a;let n=w[e]*w[e]+T[e]*T[e]+E[e]*E[e];if(n>256){let t=c/Math.sqrt(n);w[e]*=t,T[e]*=t,E[e]*=t}}ge(s*(n?2.8:2.3),e),n&&j.fill(0,0,b*4),_e(e,n,l),ve(t);for(let e=0;e<b;e+=1)x[e]+=w[e]*t,S[e]+=T[e]*t,C[e]+=E[e]*t;if(ye(),be(e),n)for(let e=0;e<b;e+=1){let t=S[e]-D[e]+f.halfH,n=D[e]*.5;if(t>=n)continue;let r=1-Math.max(t,0)/n;j[e*4+1]-=r,j[e*4+3]+=r}if(U.index>=0){let e=U.index;U.vx+=(w[e]-U.vx)*(1-Math.exp(-t/.05)),U.vy+=(T[e]-U.vy)*(1-Math.exp(-t/.05))}},Se=(t,n)=>{let r=e.getBoundingClientRect(),i=(t-r.left)/Math.max(r.width,1)*2-1,a=1-(n-r.top)/Math.max(r.height,1)*2;return[i*f.tan*(f.width/f.height),a*f.tan,-1]},Ce=(e,t)=>{let n=(t-o)/e[2];return[e[0]*n,e[1]*n]},we=e=>{let t=Math.hypot(e[0],e[1],e[2]),n=e[0]/t,r=e[1]/t,i=e[2]/t,a=-1,s=1/0;for(let e=0;e<b;e+=1){let t=-x[e],c=-S[e],l=o-C[e],u=t*n+c*r+l*i,d=D[e]*1.15,f=t*t+c*c+l*l-d*d,p=u*u-f;if(p<0)continue;let m=-u-Math.sqrt(p);m>0&&m<s&&(s=m,a=e)}return a},Te=(e,t)=>{let n=I.current,r=f.halfH*.7;for(let n=0;n<b;n+=1){let i=x[n]-e,a=S[n]-t,o=C[n],s=Math.hypot(i,a,o);if(s>=r||s<1e-4)continue;let c=(1-s/r)**2*26*(1+.6/(D[n]+.4));w[n]+=i/s*c,T[n]+=a/s*c+c*.25,E[n]+=o/s*c*.5}H.x=e,H.y=t,H.z=Math.max(n.depth,1)+1.5,H.flash=1},Ee=I.current.dpr,De=()=>{let e=I.current,a=d[e.material],s=0,c=b+1;for(let e=1;e<c;e+=1){let t=L[e],n=t===b?V.z:C[t],r=e-1;for(;r>=0&&(L[r]===b?V.z:C[L[r]])>n;)L[r+1]=L[r],--r;L[r+1]=t}for(let t=0;t<c;t+=1){let n=L[t],r=s*l;if(n===b){if(V.r<.01||!e.followCursor)continue;let t=se[0]||[1,1,1];R[r]=V.x,R[r+1]=V.y,R[r+2]=V.z,R[r+3]=V.r,R[r+4]=t[0],R[r+5]=t[1],R[r+6]=t[2],R[r+7]=1,R[r+8]=0,R[r+9]=0,R[r+10]=0,R[r+11]=0}else{let e=se[N[n]%se.length];R[r]=x[n],R[r+1]=S[n],R[r+2]=C[n],R[r+3]=D[n],R[r+4]=e[0],R[r+5]=e[1],R[r+6]=e[2],R[r+7]=0;let t=j[n*4+3],i=Math.hypot(j[n*4],j[n*4+1],j[n*4+2])||1;R[r]=x[n],R[r+8]=j[n*4]/i,R[r+9]=j[n*4+1]/i,R[r+10]=j[n*4+2]/i,R[r+11]=Math.min(t*.55,1)}s+=1}if(n.viewport(0,0,t.width,t.height),n.clearColor(0,0,0,0),n.clearDepth(1),n.clear(n.COLOR_BUFFER_BIT|n.DEPTH_BUFFER_BIT),!s)return;n.enable(n.DEPTH_TEST),n.depthFunc(n.LEQUAL),n.enable(n.BLEND),n.blendFunc(n.ONE,n.ONE_MINUS_SRC_ALPHA),n.useProgram(r.program),n.uniformMatrix4fv(i.uProj,!1,p),n.uniform1f(i.uCameraZ,o),n.uniform1f(i.uPixel,2*f.tan/t.height);let u=ee(e.lightColor),m=e.lightIntensity*60*(1+H.flash*3);n.uniform3f(i.uLight,u[0]*m,u[1]*m,u[2]*m),n.uniform3f(i.uLightPos,H.x,H.y,H.z-o),n.uniform1f(i.uExposure,e.exposure),n.uniform1f(i.uShadow,e.shadows),n.uniform4f(i.uSurface,a.roughness,a.metalness,a.coat,a.coatRoughness),n.uniform2f(i.uExtra,a.scatter,a.frost),n.bindBuffer(n.ARRAY_BUFFER,y),n.bufferSubData(n.ARRAY_BUFFER,0,R,0,s*l),n.bindVertexArray(g),n.drawArraysInstanced(n.TRIANGLE_STRIP,0,4,s),n.bindVertexArray(null)};function $(){de=0,!K&&J&&!document.hidden&&(q=0,K=requestAnimationFrame(ke))}let Oe=()=>{let n=I.current;Ee=n.dpr,f.width=Math.max(1,e.clientWidth),f.height=Math.max(1,e.clientHeight),f.ratio=Math.min(n.dpr||window.devicePixelRatio||1,2),t.width=Math.max(1,Math.round(f.width*f.ratio)),t.height=Math.max(1,Math.round(f.height*f.ratio));let r=f.width/f.height,i=Math.tan(a*Math.PI/360);f.tan=r>s?i*s/r:i,f.halfH=f.tan*o,f.halfW=f.halfH*r,f.fit=m(Math.sqrt(f.halfW*f.halfH/(i*i*o*o*s)),.4,1);let c=1/f.tan;p.fill(0),p[0]=c/r,p[5]=c,p[10]=81/-79,p[11]=-1,p[14]=160/-79,b||he(n,!0),De(),$()};function ke(e){if(K=0,!J||document.hidden)return;let t=I.current,n=h();t.dpr!==Ee&&Oe();let r=q?m((e-q)/1e3,0,1/20):1/60;if(q=e,he(t,!1),t.paused){De();return}W+=r,G=Math.max(0,G-r);let i=t.followCursor&&B.inside&&U.index<0&&!n?t.cursorSize*f.fit:0;V.r+=(i-V.r)*(1-Math.exp(-r/.12));let a=1-Math.exp(-r/.06),o=V.x,s=V.y;V.x+=(V.tx-V.x)*a,V.y+=(V.ty-V.y)*a,V.vx=m((V.x-o)/Math.max(r,.001),-16,c),V.vy=m((V.y-s)/Math.max(r,.001),-16,c);let l=f.halfH*.75,u=t.depth+4,d=B.inside?[V.x,V.y,t.followCursor?V.z:1.5]:H.flash>.05?[H.x,H.y,H.z]:[0,l,u],p=1-Math.exp(-r/.08);if(H.x+=(d[0]-H.x)*p,H.y+=(d[1]-H.y)*p,H.z+=(d[2]-H.z)*p,H.flash*=Math.exp(-r/.3),r>1e-4){let e=Math.min(6,Math.max(1,Math.ceil(r/(1/180)))),i=r/e;for(let r=0;r<e;r+=1)xe(t,i,r===e-1,n)}De();let g=0;for(let e=0;e<b;e+=1){let t=e*3,n=Math.abs(x[e]-M[t])+Math.abs(S[e]-M[t+1])+Math.abs(C[e]-M[t+2]);n>g&&(g=n),M[t]=x[e],M[t+1]=S[e],M[t+2]=C[e]}de=g/Math.max(r,.001)>.6||B.inside||U.index>=0||H.flash>.01||G>0||V.r>.01||t.drift>0&&!n?0:de+r,de<.8&&(K=requestAnimationFrame(ke))}let Ae=t=>{let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top;return r>=0&&i>=0&&r<=n.width&&i<=n.height},je=e=>{let t=Se(e.clientX,e.clientY),[n,r]=Ce(t,V.z);if(V.tx=n,V.ty=r,U.index>=0){let[e,n]=Ce(t,C[U.index]);U.tx=e-U.ox,U.ty=n-U.oy}return t},Me=e=>{let t=B.inside;B.inside=Ae(e)||U.index>=0,B.inside&&(je(e),t||(V.x=V.tx,V.y=V.ty),B.down&&Math.hypot(e.clientX-B.downX,e.clientY-B.downY)>6&&(B.moved=!0)),(B.inside||t)&&$()},Ne=e=>e instanceof Element&&e.closest(`a, button, input, textarea, select, label, [role="button"], [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="dialog"], pre, code`),Pe=e=>{if(e.button!==0||!Ae(e)||Ne(e.target))return;let n=I.current;if(n.paused)return;B.down=!0,B.moved=!1,B.downX=e.clientX,B.downY=e.clientY,B.downAt=performance.now();let r=je(e);if(n.grab&&!h()){let n=we(r);if(n>=0){let[i,a]=Ce(r,C[n]);U.index=n,U.ox=i-x[n],U.oy=a-S[n],U.tx=x[n],U.ty=S[n],U.vx=0,U.vy=0,e.pointerType===`mouse`&&e.target===t&&e.preventDefault()}}$()},Fe=e=>{let t=I.current;if(U.index>=0){let e=U.index,t=Math.hypot(U.vx,U.vy),n=t>22?22/t:1;w[e]=U.vx*n,T[e]=U.vy*n,U.index=-1,P[e]=1}else if(e&&B.down&&!B.moved&&performance.now()-B.downAt<400&&t.clickEffect===`burst`&&!h()&&Ae(e)){let[t,n]=Ce(Se(e.clientX,e.clientY),0);Te(t,n)}B.down=!1,$()},Ie=e=>Fe(e),Le=()=>Fe(null),Re=()=>{B.inside=U.index>=0,$()},ze=()=>$(),Be=typeof ResizeObserver<`u`?new ResizeObserver(Oe):null;Be?.observe(e);let Ve=typeof IntersectionObserver<`u`?new IntersectionObserver(e=>{J=e.some(e=>e.isIntersecting),J&&$()}):null;return Ve?.observe(e),window.addEventListener(`pointermove`,Me,{passive:!0}),window.addEventListener(`pointerdown`,Pe),window.addEventListener(`pointerup`,Ie,{passive:!0}),window.addEventListener(`pointercancel`,Le,{passive:!0}),document.documentElement.addEventListener(`pointerleave`,Re),document.addEventListener(`visibilitychange`,ze),Oe(),ie.current=$,()=>{cancelAnimationFrame(K),ie.current=null,Be?.disconnect(),Ve?.disconnect(),window.removeEventListener(`pointermove`,Me),window.removeEventListener(`pointerdown`,Pe),window.removeEventListener(`pointerup`,Ie),window.removeEventListener(`pointercancel`,Le),document.documentElement.removeEventListener(`pointerleave`,Re),document.removeEventListener(`visibilitychange`,ze),n.deleteBuffer(v),n.deleteBuffer(y),n.deleteVertexArray(g),n.deleteProgram(r.program),n.getExtension(`WEBGL_lose_context`)?.loseContext()}},[]),(0,r.useEffect)(()=>{ie.current?.()}),(0,i.jsx)(`div`,{ref:ne,className:`ballpit-container${N?` ${N}`:``}`,style:P,children:(0,i.jsx)(`canvas`,{ref:re,className:`ballpit-canvas`,"aria-hidden":`true`})})};export{v as default};