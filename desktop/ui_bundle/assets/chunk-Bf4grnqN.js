import{n as e}from"./chunk-WkwZ5CU-.js";import{h as t,m as n}from"./chunk-B2DNQCqq.js";import{a as r,c as i,i as a,l as o,n as s,o as c,r as l,s as u,t as d}from"./chunk-D9wI_9pz.js";var f=class extends Error{code;line;column;severity;metadata;relatedDiagnostics;fix;where;cause;constructor(e,t,n=1,r=1,i=`error`){super(t),this.name=`VGPUError`,this.code=e,this.line=n,this.column=r,this.severity=i}};function p(e,t,n={}){let r=new f(e,t,n.line??1,n.column??1,n.severity??`error`);return n.fix!==void 0&&(r.fix=n.fix),n.where!==void 0&&(r.where=n.where),n.cause!==void 0&&(r.cause=n.cause),n.metadata!==void 0&&(r.metadata=n.metadata),r}function m(e,t,n=1,r=1){return new f(e,t,n,r)}var ee=new Set([`fn`,`struct`,`const`,`alias`,`var`,`override`]);function h(e){let t=[],n=[],r=[],i=0,a=!1,o=0;for(;i<e.length;){let s=e[i];if(s.text===`{`){o++,i++;continue}if(s.text===`}`){o=Math.max(0,o-1),i++;continue}if(S(s)||o>0){i++;continue}if(s.text===`import`){if(a)throw m(`VGPU-WGSL-IMP-ORDER`,`Imports must precede declarations`,s.line,s.column);let[n,r]=g(e,i);t.push(n),i=r;continue}if(s.text===`export`&&e[i+1]?.text===`{`)throw m(`VGPU-WGSL-EXP-REEXPORT-CYCLE`,`Re-export cycles are not supported`,s.line,s.column);if(s.text===`@`&&e[i+2]?.text===`export`&&e[i+3]?.text===`@`)throw m(`VGPU-WGSL-EXP-NOTDECL`,`Repeated export attributes`,s.line,s.column);let c=s.text===`export`||s.text===`@`&&e[i+2]?.text===`export`,l=c?_(e,s.text===`export`?i+1:i+3):i,u=e[l];if(u&&ee.has(u.text)){let t=y(e,l);n.push({name:t,localName:t,kind:u.text}),c&&r.push({name:t,localName:t,kind:u.text}),a=!0,i=l+1}else i++}return{imports:t,exports:r,locals:n}}function g(e,t){let n=t+1,r=[];if(e[n]?.text===`{`){for(n++;e[n]&&e[n].text!==`}`;){if(S(e[n])){n++;continue}let t=x(e[n]),i=t;n++,e[n]?.text===`as`&&(i=x(e[n+1]),n+=2),r.push({imported:t,local:i}),e[n]?.text===`,`&&n++}n++,b(e[n],`from`),n++}else if(e[n]?.text===`*`)b(e[n+1],`as`),r.push({imported:`*`,local:x(e[n+2]),namespace:!0}),n+=3,b(e[n],`from`),n++;else if(e[n]?.kind===`string`)throw m(`VGPU-WGSL-IMP-SIDEEFFECT`,`Side-effect imports are not supported`,e[n].line,e[n].column);else throw m(`VGPU-WGSL-IMP-DEFAULT`,`Default imports are not supported`,e[n]?.line,e[n]?.column);let i=e[n];if(i?.kind!==`string`)throw m(`VGPU-WGSL-RES-NOTFOUND`,`Import path must be a string`,i?.line,i?.column);let a=i.text.slice(1,-1);return n++,e[n]?.text===`;`&&n++,[{from:a,bindings:r,start:e[t].start,end:e[n-1].end},n]}function _(e,t){for(t=v(e,t);e[t]?.text===`@`;)if(t=v(e,v(e,t+1)+1),e[t]?.text===`(`){let n=0;do e[t]?.text===`(`?n++:e[t]?.text===`)`&&n--,t++;while(e[t]&&n>0);t=v(e,t)}return t}function v(e,t){for(;e[t]&&S(e[t]);)t++;return t}function y(e,t){let n=t+1;if(e[t]?.text===`var`&&e[n]?.text===`<`)for(;e[n]&&e[n].text!==`>`;)n++;for(;n<e.length;n++)if(e[n].kind===`ident`)return e[n].text;throw m(`VGPU-WGSL-EXP-NOTDECL`,`Exported declaration has no name`,e[t]?.line,e[t]?.column)}function b(e,t){if(e?.text!==t)throw m(`VGPU-WGSL-IMP-DEFAULT`,`Expected ${t}`,e?.line,e?.column)}function x(e){if(e?.kind!==`ident`)throw m(`VGPU-WGSL-IMP-DEFAULT`,`Expected identifier`,e?.line,e?.column);return e.text}function S(e){return e.kind===`lineComment`||e.kind===`blockComment`}function C(e,t){return t===`uniform`||t===`storage`?`buffer`:e.kind===`sampler`?`sampler`:e.kind===`texture`?e.textureKind===`texture_external`?`externalTexture`:`texture`:`unknown`}function te(e,t,n,r,i){if(e===`buffer`)return w(t,n,i);if(r.kind===`sampler`)return T(r);if(r.kind===`texture`)return r.textureKind===`texture_external`?{kind:`externalTexture`,externalTexture:{}}:r.textureKind.startsWith(`texture_storage_`)?ne(r):re(r)}function w(e,t,n){return{kind:`buffer`,buffer:{type:e===`uniform`?`uniform`:t===`read`?`read-only-storage`:`storage`,hasDynamicOffset:!1,minBindingSize:n?.size}}}function T(e){return{kind:`sampler`,sampler:{type:e.comparison?`comparison`:`filtering`}}}function ne(e){return{kind:`storageTexture`,storageTexture:{access:O(e.access),format:e.texelFormat??`rgba8unorm`,viewDimension:D(e.dimension)}}}function re(e){return{kind:`texture`,texture:{sampleType:E(e),viewDimension:D(e.dimension),multisampled:e.dimension===`multisampled_2d`||e.dimension===`depth_multisampled_2d`}}}function E(e){if(e.textureKind.startsWith(`texture_depth_`))return`depth`;let t=e.sampleType;return t?.kind===`scalar`&&t.name===`i32`?`sint`:t?.kind===`scalar`&&t.name===`u32`?`uint`:`unfilterable-float`}function D(e){switch(e){case`1d`:return`1d`;case`2d_array`:case`depth_2d_array`:return`2d-array`;case`cube`:case`depth_cube`:return`cube`;case`cube_array`:case`depth_cube_array`:return`cube-array`;case`3d`:return`3d`;default:return`2d`}}function O(e){return e===`read`?`read-only`:e===`read_write`?`read-write`:`write-only`}var ie=new Set(`alias.break.case.const.const_assert.continue.continuing.default.diagnostic.discard.else.enable.false.fn.for.if.let.loop.override.requires.return.struct.switch.true.var.while`.split(`.`)),ae=new Set([`import`,`export`,`from`,`as`]),k=new Set([...ie,...ae]),oe=new Set(`NULL.Self.abstract.active.alignas.alignof.as.asm.asm_fragment.async.attribute.auto.await.become.cast.catch.class.co_await.co_return.co_yield.coherent.column_major.common.compile.compile_fragment.concept.const_cast.consteval.constexpr.constinit.crate.debugger.decltype.delete.demote.demote_to_helper.do.dynamic_cast.enum.explicit.export.extends.extern.external.fallthrough.filter.final.finally.friend.from.fxgroup.get.goto.groupshared.highp.impl.implements.import.inline.instanceof.interface.layout.lowp.macro.macro_rules.match.mediump.meta.mod.module.move.mut.mutable.namespace.new.nil.noexcept.noinline.nointerpolation.non_coherent.noncoherent.noperspective.null.nullptr.of.operator.package.packoffset.partition.pass.patch.pixelfragment.precise.precision.premerge.priv.protected.pub.public.readonly.ref.regardless.register.reinterpret_cast.require.resource.restrict.self.set.shared.sizeof.smooth.snorm.static.static_assert.static_cast.std.subroutine.super.target.template.this.thread_local.throw.trait.try.type.typedef.typeid.typename.typeof.union.unless.unorm.unsafe.unsized.use.using.varying.virtual.volatile.wgsl.where.with.writeonly.yield`.split(`.`)),se=new Set([`binding_array`]);function A(e){return/^[A-Za-z_][A-Za-z0-9_]*$/u.test(e)&&e!==`_`&&!e.startsWith(`__`)&&!k.has(e)&&!oe.has(e)&&!se.has(e)}var j=`VGPU-WGSL-IDENT-NONASCII`,M=`https://github.com/vercel-labs/vgpu/issues/294`;function N(e,t){let n=[],r=0,i=1,a=1,o=(t,r,i,a,o)=>n.push({kind:t,text:e.slice(r,i),start:r,end:i,line:a,column:o}),s=()=>{e[r]===`
`?(i++,a=1):a++,r++};for(;r<e.length;){let n=e[r];if(/\s/.test(n)){s();continue}let c=r,l=i,u=a;if(n===`/`&&e[r+1]===`/`){for(;r<e.length&&e[r]!==`
`;)s();o(`lineComment`,c,r,l,u)}else if(n===`/`&&e[r+1]===`*`){let t=0;for(;r<e.length;)if(e[r]===`/`&&e[r+1]===`*`)t++,s(),s();else if(e[r]===`*`&&e[r+1]===`/`){if(t--,s(),s(),t===0){o(`blockComment`,c,r,l,u);break}}else s();if(t!==0)throw m(`VGPU-WGSL-LEX-UNTERM-COMMENT`,`Unterminated block comment`,l,u)}else if(n===`"`||n===`'`){let t=n;for(s();r<e.length&&e[r]!==t;){if(e[r]===`
`)throw m(`VGPU-WGSL-LEX-UNTERM-STRING`,`Unterminated string`,l,u);e[r]===`\\`&&s(),s()}if(r>=e.length)throw m(`VGPU-WGSL-LEX-UNTERM-STRING`,`Unterminated string`,l,u);s(),o(`string`,c,r,l,u)}else if(/[A-Za-z_]/.test(n)){for(;r<e.length&&/[A-Za-z0-9_]/.test(e[r]);)s();let t=e.slice(c,r);o(k.has(t)?`keyword`:`ident`,c,r,l,u)}else if(/[0-9]/.test(n)||n===`.`&&/[0-9]/.test(e[r+1]??``)){for(n===`.`&&s();r<e.length;){let t=e[r];if(/[A-Za-z0-9_.]/.test(t))s();else if((t===`+`||t===`-`)&&F(e[r-1])&&/[0-9]/.test(e[r+1]??``))s();else break}o(`number`,c,r,l,u)}else{if(n.charCodeAt(0)>127)throw P(e,r,i,a,t);s(),o(`punct`,c,r,l,u)}}return n}function P(e,t,n,r,i){let a=t;for(;a>0&&ce(e[a-1]);)a--;let o=t+1;for(;o<e.length&&ce(e[o]);)o++;let s=e.slice(a,o),c=r-(t-a),l=p(j,`Non-ASCII identifier '${s}'${i===void 0?``:` in ${i}`} at line ${n} column ${c}; vgpu's WGSL pipeline supports ASCII identifiers only`,{fix:`Rename '${s}' using ASCII letters, digits and '_'. Unicode (XID) identifiers are tracked in ${M}`,line:n,column:c});return l.range={file:i,start:{line:n,column:c}},l}function ce(e){return e.charCodeAt(0)>127||/[A-Za-z0-9_]/.test(e)}function F(e){return e===`e`||e===`E`||e===`p`||e===`P`}var I=(1n<<64n)-1n,le=11400714785074694791n,ue=14029467366897019727n,L=1609587929392839161n,de=9650029242287828579n,fe=2870177450012600261n;function pe(e,t=0n){let n=new TextEncoder().encode(e),r=0,i;if(n.length>=32){let e=t+le+ue,a=t+ue,o=t,s=t-le,c=n.length-32;do e=R(e,me(n,r)),r+=8,a=R(a,me(n,r)),r+=8,o=R(o,me(n,r)),r+=8,s=R(s,me(n,r)),r+=8;while(r<=c);i=B(e,1n)+B(a,7n)+B(o,12n)+B(s,18n),i=z(i,e),i=z(i,a),i=z(i,o),i=z(i,s)}else i=t+fe;for(i=i+BigInt(n.length)&I;r+8<=n.length;)i^=R(0n,me(n,r)),i=B(i,27n)*le+de&I,r+=8;for(r+4<=n.length&&(i^=he(n,r)*le&I,i=B(i,23n)*ue+L&I,r+=4);r<n.length;)i^=BigInt(n[r])*fe&I,i=B(i,11n)*le&I,r++;return i^=i>>33n,i=i*ue&I,i^=i>>29n,i=i*L&I,i^=i>>32n,i.toString(16).padStart(16,`0`)}function R(e,t){return B(e+t*ue&I,31n)*le&I}function z(e,t){return e^=R(0n,t),e*le+de&I}function B(e,t){return(e<<t|e>>64n-t)&I}function me(e,t){let n=0n;for(let r=7;r>=0;r--)n=(n<<8n)+BigInt(e[t+r]);return n}function he(e,t){return BigInt(e[t])|BigInt(e[t+1])<<8n|BigInt(e[t+2])<<16n|BigInt(e[t+3])<<24n}function V(e){return pe(e)}function ge(e){return V(e).slice(0,8)}function _e(e,t){return`_vgsl_${ge(e)}__${t}`}function H(e,t){let n=e.find(e=>e.name===t);if(!n)return;let r=n.args.map(e=>e.text).join(``),i=Number(r.replace(/[ui]$/,``));return Number.isFinite(i)?i:void 0}function ve(e){let t=[[]],n=0,r=0;for(let i of e)i.text===`<`?n++:i.text===`>`?n=Math.max(0,n-1):i.text===`(`?r++:i.text===`)`&&(r=Math.max(0,r-1)),i.text===`,`&&n===0&&r===0?t.push([]):t[t.length-1].push(i);return t.map(U).filter(e=>e.length>0)}function U(e){let t=0,n=e.length;for(;t<n&&e[t].text===`,`;)t++;for(;n>t&&e[n-1].text===`,`;)n--;return e.slice(t,n)}function ye(e){if(e!==void 0&&be(e))return Number(e.replace(/[ui]$/,``))}function be(e){return/^(0|[1-9][0-9]*)([ui])?$/.test(e)}function xe(e){if(e===`read`||e===`write`||e===`read_write`)return e}function Se(e){return[`f32`,`f16`,`i32`,`u32`,`bool`].find(t=>t===e)}function Ce(e){return{kind:`scalar`,name:e===`f`?`f32`:e===`h`?`f16`:e===`i`?`i32`:`u32`}}function we(e){return e===`f16`?2:4}function Te(e,t){return Math.ceil(t/e)*e}function W(e){let t=U(e);if(t.length===0)throw m(`VGPU-WGSL-REFLECT-TYPE`,`Expected WGSL type`);let n=t.map(e=>e.text).join(``),r=Ee(n);if(r)return r;if(t[1]?.text===`<`){let e=t[0].text,n=De(e,ve(t.slice(2,-1)));if(n)return n}return Oe(n)||ke(n)}function Ee(e){let t=Se(e);if(t)return{kind:`scalar`,name:t};let n=e.match(/^vec([234])([fiuh])$/);if(n)return{kind:`vector`,width:Number(n[1]),element:Ce(n[2])};let r=e.match(/^mat([234])x([234])([fh])$/);if(r){let e=r[3]===`h`?{kind:`scalar`,name:`f16`}:{kind:`scalar`,name:`f32`};return{kind:`matrix`,columns:Number(r[1]),rows:Number(r[2]),element:e}}}function De(e,t){if(e===`array`){let e=t[1]?.map(e=>e.text).join(``),n=e===void 0?void 0:ye(e);return{kind:`array`,element:W(t[0]??[]),count:n,countExpression:e}}if(e===`atomic`)return{kind:`atomic`,element:W(t[0]??[])};if(e===`vec2`||e===`vec3`||e===`vec4`)return{kind:`vector`,width:Number(e.slice(3)),element:W(t[0]??[])};if(/^mat[234]x[234]$/.test(e))return{kind:`matrix`,columns:Number(e[3]),rows:Number(e[5]),element:W(t[0]??[])};if(e===`ptr`)return{kind:`ptr`,addressSpace:t[0]?.map(e=>e.text).join(``)??``,element:W(t[1]??[]),access:t[2]?.map(e=>e.text).join(``)};if(e===`sampler`)return{kind:`sampler`,comparison:!1};if(e.startsWith(`texture_storage_`))return{kind:`texture`,textureKind:e,dimension:e.slice(16),texelFormat:t[0]?.map(e=>e.text).join(``),access:xe(t[1]?.map(e=>e.text).join(``))};if(e.startsWith(`texture_`))return{kind:`texture`,textureKind:e,dimension:e.slice(8),sampleType:t[0]?W(t[0]):void 0}}function Oe(e){if(e===`sampler`||e===`sampler_comparison`)return{kind:`sampler`,comparison:e===`sampler_comparison`};if(e===`texture_external`)return{kind:`texture`,textureKind:e};if(e.startsWith(`texture_depth_`)||e.startsWith(`texture_`))return{kind:`texture`,textureKind:e,dimension:e.slice(8)}}function ke(e){return{kind:`identifier`,name:e}}function G(e){if(e?.kind!==`ident`&&e?.kind!==`keyword`)throw m(`VGPU-WGSL-REFLECT-PARSE`,`Expected identifier`,e?.line,e?.column);return e.text}function K(e,t,n){for(let r=t;r<e.length;r++)if(e[r].text===n)return r;throw m(`VGPU-WGSL-REFLECT-PARSE`,`Expected ${n}`,e[t]?.line,e[t]?.column)}function Ae(e,t,n,r){for(let i=t;i<n;i++)if(e[i].text===r)return i}function je(e,t,n){let r=0;for(let i=t;i<e.length;i++)if((e[i].text===`{`||e[i].text===`(`)&&r++,(e[i].text===`}`||e[i].text===`)`)&&(r=Math.max(0,r-1)),r===0&&e[i].text===n)return i;return e.length}function Me(e,t){let n=e[t].text,r=n===`(`?`)`:n===`{`?`}`:`>`,i=0;for(let a=t;a<e.length;a++)if(e[a].text===n&&i++,e[a].text===r&&(i--,i===0))return a;throw m(`VGPU-WGSL-REFLECT-PARSE`,`Unclosed ${n}`,e[t]?.line,e[t]?.column)}function Ne(e,t){let n=[],r=t;for(;e[r]?.text===`@`;){let t=e[r],i=G(e[r+1]);r+=2;let a=[];if(e[r]?.text===`(`){let t=Me(e,r);a=e.slice(r+1,t),r=t+1}n.push({name:i,args:a,token:t})}return[n,r]}function q(e){switch(e.kind){case`scalar`:return e.name;case`identifier`:return e.name;case`vector`:return`vec${e.width}<${q(e.element)}>`;case`matrix`:return`mat${e.columns}x${e.rows}<${q(e.element)}>`;case`array`:return`array<${q(e.element)}${e.count===void 0?``:`,${e.count}`}>`;default:return e.kind}}function Pe(e){let t=e.find(e=>e.name===`workgroup_size`);if(!t)return;let n=ve(t.args).map(e=>Number(e.map(e=>e.text).join(``)));return[n[0]??1,n[1]??1,n[2]??1]}function Fe(e,t){if(e[t]?.text!==`<`)return{after:t};let n=K(e,t,`>`),r=ve(e.slice(t+1,n)).map(e=>e.map(e=>e.text).join(``));return{addressSpace:r[0],access:xe(r[1]),after:n+1}}function Ie(e){let t=[],n=[],r=[],i=[],a=[],o=[],s=e.tokens.filter(e=>e.kind!==`lineComment`&&e.kind!==`blockComment`),c=0,l=0;for(;c<s.length;){let u=s[c];if(u.text===`{`){l++,c++;continue}if(u.text===`}`){l=Math.max(0,l-1),c++;continue}if(l>0){c++;continue}let d=c,f;s[c]?.text===`export`?(c++,[f,c]=Ne(s,c)):([f,c]=Ne(s,c),s[c]?.text===`export`&&c++);let p=s[c]?.text;if(p===`enable`)s[c+1]?.kind===`ident`&&o.push(s[c+1].text),c=je(s,c,`;`)+1;else if(p===`struct`){let n=Le(e,s,c,f);n.item&&t.push(n.item),c=n.next}else if(p===`alias`){let t=Re(e,s,c,f);t.item&&n.push(t.item),c=t.next}else if(p===`var`){let t=ze(e,s,c,f);t.item&&r.push(t.item),c=t.next}else if(p===`fn`){let t=Be(e,s,c,f,d);t.item&&i.push(t.item),c=t.next}else if(p===`override`){let e=He(s,c,f);e.item&&a.push(e.item),c=e.next}else c=Math.max(d+1,c+1)}return{structs:t,aliases:n,vars:r,entries:i,overrides:a,features:o}}function Le(e,t,n,r){let i=G(t[n+1]),a=K(t,n+2,`{`),o=Me(t,a);return{item:{name:i,originalName:i,mangledName:We(e,i,`struct`),members:Ue(t.slice(a+1,o)),path:e.path},next:o+1}}function Re(e,t,n,r){let i=G(t[n+1]),a=K(t,n+2,`=`),o=je(t,a+1,`;`);return{item:{name:i,originalName:i,mangledName:We(e,i,`alias`),target:W(t.slice(a+1,o)),path:e.path},next:o+1}}function ze(e,t,n,r){let{addressSpace:i,access:a,after:o}=Fe(t,n+1),s=G(t[o]),c=K(t,o+1,`:`),l=je(t,c+1,`;`);return{item:{path:e.path,name:s,mangledName:Ge(r)?s:We(e,s,`var`),attrs:r,addressSpace:i,access:a,type:W(t.slice(c+1,l))},next:l+1}}function Be(e,t,n,r,i=n){let a=G(t[n+1]),o=r.find(e=>e.name===`vertex`||e.name===`fragment`||e.name===`compute`)?.name;if(!o)return{item:void 0,next:n+1};let s=K(t,n+2,`(`),c=Me(t,s),l=Me(t,K(t,c+1,`{`));return{item:{name:a,mangledName:a,stage:o,workgroupSize:Pe(r),path:e.path,params:Ve(t.slice(s+1,c)),declarationStartToken:t[i],declarationEndToken:t[l]},next:l+1}}function Ve(e){let t=[],n=0;for(;n<e.length;){let[r,i]=Ne(e,n);if(n=i,!e[n]||e[n].text===`,`){n++;continue}let a=G(e[n]),o=K(e,n+1,`:`),s=o+1,c=0;for(;s<e.length&&(e[s].text===`<`&&c++,e[s].text===`>`&&(c=Math.max(0,c-1)),c!==0||e[s].text!==`,`);)s++;t.push({name:a,attrs:r,type:W(e.slice(o+1,s))}),n=s+1}return t}function He(e,t,n){let r=G(e[t+1]),i=je(e,t+1,`;`),a=Ae(e,t+2,i,`=`);return{item:{name:r,mangledName:r,id:H(n,`id`),defaultValue:a===void 0?void 0:e.slice(a+1,i).map(e=>e.text).join(``)},next:i+1}}function Ue(e){let t=[],n=0;for(;n<e.length;){let[r,i]=Ne(e,n);if(n=i,!e[n]||e[n].text===`,`||e[n].text===`;`){n++;continue}let a=G(e[n]),o=K(e,n+1,`:`),s=o+1,c=0;for(;s<e.length&&(e[s].text===`<`&&c++,e[s].text===`>`&&(c=Math.max(0,c-1)),c!==0||e[s].text!==`,`&&e[s].text!==`;`);)s++;t.push({name:a,attrs:r,type:W(e.slice(o+1,s)),align:H(r,`align`),size:H(r,`size`)}),n=s+1}return t}function We(e,t,n){return n===`override`?t:_e(e.path,t)}function Ge(e){return H(e,`group`)!==void 0||H(e,`binding`)!==void 0}var Ke=`literal length required for auto layout; use draw.group(n, bg) manual binding`,qe="VGPUError: `bool` is not host-shareable in uniform/storage. Fix: use `u32` (0 | 1) → struct Params { enabled: u32 }",Je="use a manual group claim (`draw.group(n, bg)`)";function Ye(e=1,t=1){return m(`VGPU-WGSL-REFLECT-ARRAY-LENGTH`,Ke,e,t)}function Xe(e=1,t=1){return m(`VGPU-WGSL-REFLECT-BOOL-HOST-SHAREABLE`,qe,e,t)}function Ze(e,t,n=1,r=1){return m(`VGPU-WGSL-REFLECT-UNKNOWN-TYPE`,`type '${e}' is unknown in ${t}; ${Je}`,n,r)}function Qe(e,t,n=1,r=1){return m(`VGPU-WGSL-REFLECT-NS-TYPE`,`type '${e}' is a namespace-member import; use a named import or manual @group(1+) binding`,n,r)}function $e(e,t=1,n=1){return m(`VGPU-WGSL-REFLECT-NON-HOST-SHAREABLE`,`Type ${e} is not host-shareable; ${Je}`,t,n)}var et=`wgsl-host-shareable-v1`;function tt(e,t,n){let r=new Map;for(let e of t){let t=new Map;for(let n of[...e.structs,...e.aliases])t.set(n.originalName,{path:n.path,name:n.originalName,mangledName:n.mangledName,kind:`members`in n?`struct`:`alias`});r.set(e.structs[0]?.path??e.aliases[0]?.path??e.vars[0]?.path??``,t)}let i=new Map(e.map(e=>[e.path,r.get(e.path)??new Map])),a=new Map;for(let t of e){let r=new Map(i.get(t.path));for(let a of t.parsed.imports)nt(t,a,r,e,i,n);a.set(t.path,r)}return a}function nt(e,t,n,r,i,a){let o=st(t,e.path,r,a),s=i.get(o);for(let e of t.bindings){if(e.namespace){n.set(e.local,{path:o,name:e.local,mangledName:e.local,kind:`namespace`});continue}let t=s?.get(e.imported);t&&n.set(e.local,t)}}function rt(e,t){let n=new Map,r=new Map,i=new Map,a={structs:n,aliases:r,byMangled:i};for(let o of e){for(let e of o.structs){let r={name:e.name,mangledName:e.mangledName,members:e.members.map(n=>({name:n.name,type:it(n.type,e.path,t,a),align:n.align,size:n.size}))};n.set(e.mangledName,r),i.set(e.mangledName,r)}for(let e of o.aliases){let n={name:e.name,mangledName:e.mangledName,target:it(e.target,e.path,t,a)};r.set(e.mangledName,n),i.set(e.mangledName,n)}}return{structs:n,aliases:r,byMangled:i}}function it(e,t,n,r){switch(e.kind){case`identifier`:{let r=e.name.indexOf(`.`);if(r>0){let i=e.name.slice(0,r);if(n.get(t)?.get(i)?.kind===`namespace`)throw Qe(e.name,t)}let i=n.get(t)?.get(e.name);if(i?.kind===`namespace`)throw Qe(e.name,t);if(!i)throw Ze(e.name,t);return{kind:`identifier`,name:i.name,mangledName:i.mangledName}}case`array`:case`atomic`:case`vector`:case`matrix`:case`ptr`:return{...e,element:it(e.element,t,n,r)};case`texture`:return{...e,sampleType:e.sampleType?it(e.sampleType,t,n,r):void 0};default:return e}}function at(e,t){if(!t||e.kind!==`identifier`)return e;let n=t.aliases.get(e.mangledName??e.name);return n?at(n.target,t):e}function ot(e,t){let n=at(e,t);switch(n.kind){case`array`:case`atomic`:case`vector`:case`matrix`:case`ptr`:return{...n,element:ot(n.element,t)};case`texture`:return{...n,sampleType:n.sampleType?ot(n.sampleType,t):void 0};default:return n}}function st(e,t,n,r){let i=ct(e,t,r);if(i!==void 0&&n.some(e=>e.path===i))return i;let a=e.from,o=t.slice(0,t.lastIndexOf(`/`)+1),s=a.startsWith(`/`)?a:lt(`${o}${a}`);return[a,s].find(e=>n.some(t=>t.path===e))??i??s}function ct(e,t,n){if(n)try{return n(t,e)}catch{return}}function lt(e){let t=e.startsWith(`/`),n=[];for(let t of e.split(`/`))t&&t!==`.`&&(t===`..`?n.pop():n.push(t));return`${t?`/`:``}${n.join(`/`)}`}function ut(e,t=q(e),n=t,r){return dt(r?ot(e,r):e,t,n,r)}function dt(e,t,n,r){switch(e.kind){case`scalar`:return ft(e,t,n);case`atomic`:return pt(e,t,n);case`vector`:return mt(e,t,n,r);case`matrix`:return ht(e,t,n,r);case`array`:return gt(e,t,n,r);case`identifier`:return vt(e,t,n,r);default:throw $e(q(e))}}function ft(e,t,n){let r=we(e.name);if(e.name===`bool`)throw Xe();return{name:t,mangledName:n,layoutMode:et,type:e,align:r,size:r}}function pt(e,t,n){return{name:t,mangledName:n,layoutMode:et,type:e,align:4,size:4}}function mt(e,t,n,r){let i=ut(e.element,t,n,r).size??4;return{name:t,mangledName:n,layoutMode:et,type:e,align:e.width===2?i*2:i*4,size:i*e.width}}function ht(e,t,n,r){let i=ut({kind:`vector`,width:e.rows,element:e.element},`${t}[]`,`${n}[]`,r),a=Te(i.align,i.size??0);return{name:t,mangledName:n,layoutMode:et,type:e,align:i.align,size:a*e.columns,stride:a,element:i}}function gt(e,t,n,r){_t(e.countExpression);let i=ut(e.element,`${t}[]`,`${n}[]`,r),a=Te(yt(e.element,r),i.size??0);return{name:t,mangledName:n,layoutMode:et,type:e,align:yt(e,r),size:e.count===void 0?void 0:a*e.count,stride:a,element:i,runtimeSized:e.count===void 0}}function _t(e){if(e!==void 0&&!be(e))throw Ye()}function vt(e,t,n,r){if(!r)throw Ze(e.name,`<unknown>`);let i=r.structs.get(e.mangledName??e.name);if(!i)throw Ze(e.name,`<unknown>`);let a=[],o=0,s=1;for(let e of i.members){let t=J(e,o,r);a.push(t.member),o=t.offset+(t.member.size??0),s=Math.max(s,t.member.align)}return{name:t,mangledName:n,layoutMode:et,type:e,align:s,size:Te(s,o),members:a}}function J(e,t,n){let r=ut(e.type,e.name,e.name,n),i=Math.max(yt(e.type,n),e.align??1),a=Math.max(r.size??0,e.size??0),o=Te(i,t);return{member:{name:e.name,offset:o,align:i,size:a,type:e.type,layout:r,explicitAlign:e.align,explicitSize:e.size},offset:o}}function yt(e,t){let n=t?ot(e,t):e;switch(n.kind){case`scalar`:return bt(n.name);case`atomic`:return 4;case`vector`:return n.width===2?yt(n.element,t)*2:yt(n.element,t)*4;case`matrix`:return yt({kind:`vector`,width:n.rows,element:n.element},t);case`array`:return yt(n.element,t);case`identifier`:return xt(n,t);default:throw $e(q(n))}}function bt(e){if(e===`bool`)throw Xe();return we(e)}function xt(e,t){let n=t?.structs.get(e.mangledName??e.name);if(!n)throw Ze(e.name,`<unknown>`);return Math.max(1,...n.members.map(e=>Math.max(yt(e.type,t),e.align??1)))}var St=/^_vgsl_[0-9a-f]{8,16}__[A-Za-z_][A-Za-z0-9_]*$/,Ct=new Set([`fn`,`struct`,`const`,`alias`,`var`,`override`]);function wt(e){return new Tt(e).analyze()}var Tt=class{tokens;scopes=[];declarations=[];references=[];functions=[];preserved=new Map;symbolsByScope=new Map;moduleFallbackReasons=[];pendingSymbols=[];moduleScopeId;constructor(e){this.tokens=e,this.moduleScopeId=this.createScope(`module`,void 0,void 0,0)}analyze(){this.collectTopLevel();for(let e of this.functions)this.walkFunction(e);return{tokens:this.tokens,scopes:this.scopes,declarations:this.declarations,references:this.references,functions:this.functions,preservedTokens:[...this.preserved.entries()].map(([e,t])=>({tokenIndex:e,reason:t})),fallback:{wholeModule:this.moduleFallbackReasons.length>0,reasons:this.moduleFallbackReasons}}}collectTopLevel(){let e=0;for(let t=0;t<this.tokens.length;t++){let n=this.tokens[t];Dt(n)||(n.text===`{`?e++:n.text===`}`?(e--,e<0&&(this.moduleFallback(`unmatched top-level closing brace`,t),e=0)):e===0&&(n.text===`@`?t=this.preserveAttribute(t):n.text===`enable`||n.text===`requires`||n.text===`diagnostic`||n.text===`const_assert`?t=this.preserveStatement(t,`directive`):n.text!==`export`&&(n.text===`struct`?t=this.collectStruct(t):n.text===`fn`?t=this.collectFunction(t):n.text===`const`||n.text===`alias`||n.text===`var`||n.text===`override`?t=this.preserveGlobalDeclaration(t):n.kind===`keyword`&&!Ct.has(n.text)&&this.moduleFallback(`unexpected top-level keyword '${n.text}'`,t))))}e!==0&&this.moduleFallback(`unclosed top-level brace`,this.tokens.length-1),this.scopes[this.moduleScopeId].endToken=Math.max(0,this.tokens.length-1)}collectStruct(e){let t=this.nextSig(e);if(t===void 0||this.tokens[t]?.kind!==`ident`)return this.moduleFallback(`struct without name`,e),e;this.preserveToken(t,`global`);let n=this.nextSig(t);if(n===void 0||this.tokens[n]?.text!==`{`)return this.moduleFallback(`struct without body`,e),t;let r=this.findMatching(n,`{`,`}`);if(r===void 0)return this.moduleFallback(`unclosed struct body`,n),n;for(let e=n;e<=r;e++)this.tokens[e]?.kind===`ident`&&this.preserveToken(e,`struct`);return r}collectFunction(e){let t=this.nextSig(e);if(t===void 0||this.tokens[t]?.kind!==`ident`)return this.moduleFallback(`function without name`,e),e;let n=this.tokens[t].text,r=St.test(n)&&!this.hasEntryAttributeBefore(e);this.addDeclaration(n,`function`,t,this.moduleScopeId,void 0,r),r||this.preserveToken(t,`global`);let i=this.nextSig(t);if(i===void 0||this.tokens[i]?.text!==`(`)return this.moduleFallback(`function without parameter list`,t),t;let a=this.findMatching(i,`(`,`)`);if(a===void 0)return this.moduleFallback(`unclosed function parameter list`,i),i;let o=this.findNextText(a+1,`{`);if(o===void 0)return this.moduleFallback(`function without body`,a),a;this.preserveFunctionSignatureTail(a+1,o);let s=this.findMatching(o,`{`,`}`);if(s===void 0)return this.moduleFallback(`unclosed function body`,o),o;let c=this.createScope(`function`,this.moduleScopeId,this.functions.length,i);return this.functions.push({id:this.functions.length,name:n,nameTokenIndex:t,scopeId:c,bodyStartToken:o,bodyEndToken:s,skipped:!1,fallbackReasons:[]}),this.collectParams(i,a,c,this.functions.length-1),this.scopes[c].endToken=s,s}collectParams(e,t,n,r){for(let i=e+1;i<t;i++){let e=this.tokens[i];if(!Dt(e)){if(e.text===`@`)i=this.preserveAttribute(i);else if(e.kind===`ident`&&this.nextSig(i)!==void 0&&this.tokens[this.nextSig(i)]?.text===`:`){this.addDeclaration(e.text,`param`,i,n,r,!0);let a=this.nextSig(i);i=this.preserveTypeFrom(a+1,[`,`,`)`],t)}}}}preserveFunctionSignatureTail(e,t){for(let n=e;n<t;n++){let e=this.tokens[n];Dt(e)||(e.text===`@`?n=this.preserveAttribute(n):e.kind===`ident`&&this.preserveToken(n,`type`))}}preserveGlobalDeclaration(e){let t=e+1;if(this.tokens[e]?.text===`var`){let n=this.nextSig(e);if(n!==void 0&&this.tokens[n]?.text===`<`){let e=this.findMatching(n,`<`,`>`);if(e===void 0)return this.moduleFallback(`unparseable top-level var template`,n),n;this.preserveRange(n,e,`type`),t=e+1}}let n=this.findNextIdent(t);n!==void 0&&(this.preserveToken(n,`global`),this.addDeclaration(this.tokens[n].text,`global`,n,this.moduleScopeId,void 0,!1));let r=this.findStatementEnd(e);for(let t=e;t<=r;t++)this.tokens[t]?.kind===`ident`&&this.preserveToken(t,`global`);return r}walkFunction(e){let t=[this.moduleScopeId,e.scopeId],n=[],r=(n,r)=>{let i=this.createScope(n,t[t.length-1],e.id,r);return t.push(i),i},i=n=>{if(t.length<=2){this.functionFallback(e,`scope frame underflow`,n);return}let r=t.pop();return this.scopes[r].endToken=n,r};r(`block`,e.bodyStartToken);let a=1;for(let o=e.bodyStartToken+1;o<e.bodyEndToken;o++){this.activatePendingSymbols(o);let s=this.tokens[o];if(Dt(s))continue;if(s.text===`@`){o=this.preserveAttribute(o);continue}if(s.text===`.`){let e=this.nextSig(o);e!==void 0&&this.tokens[e]?.kind===`ident`&&this.preserveToken(e,`member`);continue}if(s.text===`enable`||s.text===`requires`||s.text===`diagnostic`){o=this.preserveStatement(o,`directive`);continue}if(s.text===`for`){let t=r(`for-init`,o),i=this.nextSig(o);(i===void 0||this.tokens[i]?.text!==`(`)&&this.functionFallback(e,`for without parenthesized header`,o),n.push({scopeId:t,headerDepth:0,awaitingBody:!1});continue}let c=n[n.length-1];if(c&&c.bodyDepth===void 0&&(s.text===`(`&&c.headerDepth++,s.text===`)`&&(c.headerDepth--,c.headerDepth<=0&&(c.awaitingBody=!0))),s.text===`{`){a++;let e=Et(n,e=>e.awaitingBody&&e.bodyDepth===void 0);e&&(e.bodyDepth=a),r(`block`,o)}else if(s.text===`}`){let t=a;for(i(o),a--;n.length>0&&n[n.length-1].bodyDepth===t;)i(o),n.pop();a<0&&this.functionFallback(e,`unmatched closing brace`,o)}else if(s.text===`:`)o=this.preserveTypeFrom(o+1,[`=`,`;`,`,`,`)`,`{`],e.bodyEndToken);else if(s.text===`-`&&this.tokens[this.nextSig(o)??-1]?.text===`>`)o=this.preserveTypeFrom((this.nextSig(o)??o)+1,[`{`],e.bodyEndToken);else if(s.text===`let`||s.text===`const`||s.text===`var`)o=this.collectLocalDeclaration(o,t[t.length-1],e);else if(s.kind===`ident`&&!this.preserved.has(o)){let n=this.resolve(s.text,t);n===void 0?this.preserveToken(o,`unknown`):this.references.push({name:s.text,tokenIndex:o,declarationId:n,scopeId:t[t.length-1],functionId:e.id})}}for(;t.length>2;)i(e.bodyEndToken)}collectLocalDeclaration(e,t,n){let r=this.tokens[e].text,i=e+1;if(r===`var`){let t=this.nextSig(e);if(t!==void 0&&this.tokens[t]?.text===`<`){let e=this.findMatching(t,`<`,`>`);if(e===void 0)return this.functionFallback(n,`unparseable var template`,t),t;this.preserveRange(t,e,`type`),i=e+1}}let a=this.findNextIdent(i);if(a===void 0||a>=n.bodyEndToken)return this.functionFallback(n,`${r} without identifier`,e),e;this.addDeclaration(this.tokens[a].text,r,a,t,n.id,!0,this.findStatementEnd(e));let o=this.nextSig(a);return o!==void 0&&this.tokens[o]?.text===`:`?this.preserveTypeFrom(o+1,[`=`,`;`,`,`,`)`],n.bodyEndToken):a}addDeclaration(e,t,n,r,i,a,o){let s=this.declarations.length;return this.declarations.push({id:s,name:e,kind:t,tokenIndex:n,scopeId:r,functionId:i,safeToRename:a}),o===void 0?this.activateSymbol(e,s,r):this.pendingSymbols.push({name:e,id:s,scopeId:r,activateAfter:o}),s}activatePendingSymbols(e){for(let t=this.pendingSymbols.length-1;t>=0;t--){let n=this.pendingSymbols[t];n.activateAfter>=e||(this.activateSymbol(n.name,n.id,n.scopeId),this.pendingSymbols.splice(t,1))}}activateSymbol(e,t,n){let r=this.symbolsByScope.get(n);r||(r=new Map,this.symbolsByScope.set(n,r)),r.has(e)||r.set(e,t)}resolve(e,t){for(let n=t.length-1;n>=0;n--){let r=this.symbolsByScope.get(t[n])?.get(e);if(r!==void 0)return r}}preserveAttribute(e){this.preserveToken(e,`attribute`);let t=this.nextSig(e);if(t===void 0)return e;this.preserveToken(t,`attribute`);let n=this.nextSig(t);if(n===void 0||this.tokens[n]?.text!==`(`)return t;let r=this.findMatching(n,`(`,`)`);return r===void 0?(this.preserveRange(n,n,`attribute`),n):(this.preserveRange(n,r,`attribute`),r)}preserveTypeFrom(e,t,n){let r=0,i=0,a=0,o=e-1;for(let s=e;s<n;s++){let n=this.tokens[s];if(!Dt(n)){if(r===0&&i===0&&a===0&&t.includes(n.text))return Math.max(e-1,s-1);if(n.text===`<`)r++;else if(n.text===`>`)r=Math.max(0,r-1);else if(n.text===`(`)i++;else if(n.text===`)`){if(i===0&&t.includes(`)`))return Math.max(e-1,s-1);i=Math.max(0,i-1)}else n.text===`[`?a++:n.text===`]`&&(a=Math.max(0,a-1));n.kind===`ident`&&this.preserveToken(s,`type`),o=s}}return o}preserveStatement(e,t){let n=this.findStatementEnd(e);return this.preserveRange(e,n,t),n}preserveRange(e,t,n){for(let r=e;r<=t;r++)this.tokens[r]&&this.tokens[r].kind!==`lineComment`&&this.tokens[r].kind!==`blockComment`&&this.preserveToken(r,n)}preserveToken(e,t){this.preserved.has(e)||this.preserved.set(e,t)}createScope(e,t,n,r){let i=this.scopes.length;return this.scopes.push({id:i,kind:e,parentId:t,functionId:n,startToken:r}),i}nextSig(e){for(let t=e+1;t<this.tokens.length;t++)if(!Dt(this.tokens[t]))return t}findNextIdent(e){for(let t=e;t<this.tokens.length;t++){let e=this.tokens[t];if(!Dt(e)){if(e.kind===`ident`)return t;if(e.text!==`@`)return}}}findNextText(e,t){for(let n=e;n<this.tokens.length;n++)if(!Dt(this.tokens[n])&&this.tokens[n].text===t)return n}findStatementEnd(e){let t=0;for(let n=e;n<this.tokens.length;n++){let e=this.tokens[n].text;if(e===`(`)t++;else if(e===`)`)t=Math.max(0,t-1);else if(t===0&&(e===`;`||e===`{`||e===`}`))return n}return this.tokens.length-1}findMatching(e,t,n){let r=0;for(let i=e;i<this.tokens.length;i++){let e=this.tokens[i].text;if(e===t&&r++,e===n&&(r--,r===0))return i}}hasEntryAttributeBefore(e){for(let t=e-1;t>=0;t--){let e=this.tokens[t];if(!Dt(e)){if(e.text===`)`||e.kind===`ident`||e.text===`@`){let t=e.text;if(t===`compute`||t===`vertex`||t===`fragment`)return!0}else break}}return!1}moduleFallback(e,t){this.moduleFallbackReasons.push(`${e} at token ${t}`)}functionFallback(e,t,n){e.skipped=!0,e.fallbackReasons.push(`${t} at token ${n}`)}};function Et(e,t){for(let n=e.length-1;n>=0;n--)if(t(e[n]))return e[n]}function Dt(e){return e.kind===`lineComment`||e.kind===`blockComment`}var Ot=new Set([`textureSample`,`textureSampleBias`,`textureSampleLevel`,`textureSampleGrad`,`textureGather`,`textureSampleBaseClampToEdge`]),kt=new Set([`textureSampleCompare`,`textureSampleCompareLevel`,`textureGatherCompare`]);function At(e,t,n){let r=new Map;for(let i=0;i<e.length;i++){let a=e[i],o=t[i],s=wt(a.tokens),c=new Map;for(let e of o.vars){let t=H(e.attrs,`group`),n=H(e.attrs,`binding`),r=s.declarations.find(t=>t.kind===`global`&&t.name===e.name);t!==void 0&&n!==void 0&&r&&c.set(r.id,{group:t,binding:n})}let l=new Map;for(let e of s.declarations){if(e.kind!==`function`)continue;let t=s.functions.find(t=>t.nameTokenIndex===e.tokenIndex);t&&l.set(e.id,t.id)}for(let e of o.entries){let t=s.functions.find(t=>t.name===e.name),i=[],a=s.fallback.wholeModule||!t;!a&&t&&(a=!jt(t.id,new Map,new Set,s,c,l,i));let o=t?It(t.id,s,c,l):n.map(Rt);r.set(e,a?Lt(n,o):zt(i))}}return r}function jt(e,t,n,r,i,a,o){let s=r.functions[e];if(!s||s.skipped)return!1;let c=`${e}|${[...t].map(([e,t])=>`${e}:${t.group}:${t.binding}`).join(`,`)}`;if(n.has(c))return!0;n.add(c);let l=r.references.filter(t=>t.functionId===e),u=new Map(l.map(e=>[e.tokenIndex,e]));for(let e=s.bodyStartToken+1;e<s.bodyEndToken;e++){let s=r.tokens[e]?.text,c=Ot.has(s??``)?`filtering`:kt.has(s??``)?`comparison`:void 0,l=u.get(e),d=l&&a.get(l.declarationId);if(!c&&d===void 0)continue;let f=Ft(r,e);if(f===void 0||r.tokens[f]?.text!==`(`)continue;let p=Pt(r,f);if(!p)return!1;let m=p.map(([e,n])=>Mt(e,n,r,i,t));if(c){let e=+(s===`textureGather`&&!Nt(p[0],r,i,t)),n=m[e],a=m[e+1];if(!n||!a)return!1;o.push({texture:n,sampler:a,mode:c})}else{let e=r.declarations.filter(e=>e.kind===`param`&&e.functionId===d).sort((e,t)=>e.tokenIndex-t.tokenIndex),t=new Map;for(let n=0;n<e.length;n++)m[n]&&t.set(e[n].id,m[n]);if(!jt(d,t,n,r,i,a,o))return!1}}return!0}function Mt(e,t,n,r,i){for(let a of n.references){if(a.tokenIndex<e||a.tokenIndex>t)continue;let n=r.get(a.declarationId)??i.get(a.declarationId);if(n)return n}}function Nt(e,t,n,r){let i=t.references.find(t=>t.tokenIndex>=e[0]&&t.tokenIndex<=e[1]);return i?.tokenIndex===e[0]?n.get(i.declarationId)??r.get(i.declarationId):void 0}function Pt(e,t){let n=[],r=1,i=0,a=0,o=0,s=t+1;for(let c=t+1;c<e.tokens.length;c++){let t=e.tokens[c].text;if(t===`(`)r++;else if(t===`)`){if(r--,r===0)return n.push([s,c-1]),n}else t===`[`?i++:t===`]`?i--:t===`{`?a++:t===`}`?a--:t===`<`?o++:t===`>`?o--:t===`,`&&r===1&&i===0&&a===0&&o===0&&(n.push([s,c-1]),s=c+1)}}function Ft(e,t){for(let n=t+1;n<e.tokens.length;n++)if(e.tokens[n].kind!==`lineComment`&&e.tokens[n].kind!==`blockComment`)return n}function It(e,t,n,r){let i=[e],a=new Set,o=new Map;for(;i.length;){let e=i.pop();if(!a.has(e)){a.add(e);for(let a of t.references){if(a.functionId!==e)continue;let t=n.get(a.declarationId);t&&o.set(`${t.group}:${t.binding}`,t);let s=r.get(a.declarationId);s!==void 0&&i.push(s)}}}return[...o.values()]}function Lt(e,t){let n=new Set(t.map(e=>`${e.group}:${e.binding}`)),r=e.filter(e=>n.has(`${e.group}:${e.binding}`)),i=r.filter(e=>e.bindingLayout?.kind===`texture`&&e.bindingLayout.texture.sampleType===`unfilterable-float`&&!e.bindingLayout.texture.multisampled),a=r.filter(e=>e.bindingLayout?.kind===`sampler`&&e.bindingLayout.sampler.type===`filtering`);return i.flatMap(e=>a.map(t=>({texture:Rt(e),sampler:Rt(t),mode:`filtering`})))}function Rt(e){return{group:e.group,binding:e.binding}}function zt(e){let t=new Set;return e.filter(e=>{let n=`${e.texture.group}:${e.texture.binding}:${e.sampler.group}:${e.sampler.binding}:${e.mode}`;return!t.has(n)&&(t.add(n),!0)})}function Bt(e,t){let n=e.map(Ie),r=tt(e,n,t),i=rt(n,r),a=[],o=[];for(let e of n)for(let t of e.vars){let e=H(t.attrs,`group`),n=H(t.attrs,`binding`);if(e===void 0||n===void 0)continue;let s=it(t.type,t.path,r,i),c=C(s,t.addressSpace),l=t.addressSpace===`uniform`||t.addressSpace===`storage`?ut(s,t.name,t.mangledName,i):void 0;l&&o.push(l),a.push({group:e,binding:n,name:t.name,mangledName:t.mangledName,type:s,kind:c,addressSpace:t.addressSpace,access:t.access,struct:s.kind===`identifier`?i.structs.get(s.mangledName??s.name):void 0,layout:l,bindingLayout:te(c,t.addressSpace,t.access,s,l)})}a.sort((e,t)=>e.group-t.group||e.binding-t.binding);let s=Vt(e,n,a),c=At(e,n,a);return{bindings:a,entryPoints:n.flatMap(e=>e.entries.map(e=>Ht(e,n.flatMap(e=>e.structs),r,i,s.get(e)??a,c.get(e)??[]))),overrides:n.flatMap(e=>e.overrides),featuresRequired:[...new Set(n.flatMap(e=>e.features))],aliases:[...i.aliases.values()],structs:[...i.structs.values()],hostShareableLayouts:o}}function Vt(e,t,n){let r=new Map;for(let i=0;i<e.length;i++){let a=e[i],o=t[i],s=wt(a.tokens),c=s.fallback.wholeModule,l=new Map;for(let e of s.declarations){if(e.kind!==`function`)continue;let t=s.functions.find(t=>t.nameTokenIndex===e.tokenIndex);t&&l.set(e.id,t.id)}let u=new Map;for(let e of o.vars){let t=H(e.attrs,`group`),n=H(e.attrs,`binding`);if(t===void 0||n===void 0)continue;let r=s.declarations.find(t=>t.kind===`global`&&t.name===e.name);r&&u.set(r.id,{group:t,binding:n})}for(let e of o.entries){let t=s.functions.find(t=>t.name===e.name);if(c||!t){r.set(e,n);continue}let i=[t.id],a=new Set,o=new Map;for(;i.length;){let e=i.pop();if(!a.has(e)&&(a.add(e),s.functions[e]))for(let t of s.references){if(t.functionId!==e)continue;let n=u.get(t.declarationId);n&&o.set(`${n.group}:${n.binding}`,n);let r=l.get(t.declarationId);r!==void 0&&i.push(r)}}r.set(e,[...o.values()].sort((e,t)=>e.group-t.group||e.binding-t.binding))}}return r}function Ht(e,t,n,r,i,a){return{name:e.name,mangledName:e.mangledName,stage:e.stage,...e.workgroupSize?{workgroupSize:e.workgroupSize}:{},bindings:i.map(({group:e,binding:t})=>({group:e,binding:t})),samplingPairs:a,...e.stage===`vertex`?{inputs:Ut(e,t,n,r)}:{}}}function Ut(e,t,n,r){let i=[];for(let a of e.params){if(Wt(a.attrs,`builtin`))continue;let o=it(a.type,e.path,n,r),s=H(a.attrs,`location`);if(s!==void 0){i.push({name:a.name,location:s,type:o});continue}let c=at(o,r);if(c.kind!==`identifier`)continue;let l=t.find(e=>e.mangledName===(c.mangledName??c.name)),u=r.structs.get(c.mangledName??c.name);if(l)for(let e=0;e<l.members.length;e++){let t=l.members[e];if(Wt(t.attrs,`builtin`))continue;let a=H(t.attrs,`location`);a!==void 0&&i.push({name:t.name,location:a,type:u?.members[e]?.type??it(t.type,l.path,n,r)})}}return i}function Wt(e,t){return e.some(e=>e.name===t)}function Gt(e,t=`<runtime>`){let n=N(e,t),r=h(n);if(r.imports.length>0)throw m(`VGPU-WGSL-REFLECT-SOURCE-IMPORT`,`reflectSource() accepts a single raw WGSL string; use resolveShader() for WGSL import graphs.`);return Bt([{path:t,source:e,tokens:n,parsed:r}])}function Kt(e){if(typeof e==`object`&&e){for(let t of Object.values(e))Kt(t);Object.freeze(e)}return e}function qt(e){if(typeof e==`string`)return{wgsl:e};if(typeof e!=`object`||!e||Array.isArray(e))throw $t(`source must be a WGSL string or object`);let t=Zt(e,`wgsl`);if(typeof t!=`string`)throw $t(`source.wgsl must be a string own data property`);let n=Qt(e,`functionExports`);if(!n.present)return{wgsl:t};if(!Array.isArray(n.value))throw $t(`source.functionExports must be an array when present`);return{wgsl:t,functionExports:Jt(n.value)}}function Jt(e){let t=[];for(let n=0;n<e.length;n++){let r=Xt(e,n,`source.functionExports`);if(typeof r!=`object`||!r||Array.isArray(r))throw $t(`source.functionExports[${n}] must be an object`);let i=Yt(r,`name`,n),a=Yt(r,`resolvedName`,n),o=Zt(r,`parameterNames`);if(!Array.isArray(o))throw $t(`source.functionExports[${n}].parameterNames must be an array`);let s=[],c=new Set;for(let e=0;e<o.length;e++){let t=Xt(o,e,`source.functionExports[${n}].parameterNames`);if(typeof t!=`string`||!A(t))throw $t(`source.functionExports[${n}].parameterNames[${e}] must be a valid WGSL identifier`);if(c.has(t))throw $t(`source.functionExports[${n}].parameterNames contains duplicate ${t}`);c.add(t),s.push(t)}t.push({name:i,resolvedName:a,parameterNames:s})}return t}function Yt(e,t,n){let r=Zt(e,t);if(typeof r!=`string`||!A(r))throw $t(`source.functionExports[${n}].${t} must be a valid WGSL identifier`);return r}function Xt(e,t,n){let r;try{r=Object.getOwnPropertyDescriptor(e,String(t))}catch{throw $t(`${n}[${t}] could not be inspected`)}if(!r||!(`value`in r))throw $t(`${n}[${t}] must be a present data property`);return r.value}function Zt(e,t){let n=Qt(e,t);return n.present?n.value:void 0}function Qt(e,t){let n;try{n=Object.getOwnPropertyDescriptor(e,t)}catch{throw $t(`source.${t} could not be inspected`)}if(!n)return{present:!1};if(!(`value`in n))throw $t(`source.${t} must be a data property`);return{present:!0,value:n.value}}function $t(e){return m(`VGPU-SHADER-SOURCE-INVALID`,`Invalid prepareShader() input: ${e}`)}function en(e){return{bindings:rn(e.bindings),entryPoints:e.entryPoints.map(tn),overrides:rn(e.overrides),featuresRequired:[...e.featuresRequired],aliases:rn(e.aliases),structs:rn(e.structs),hostShareableLayouts:rn(e.hostShareableLayouts)}}function tn(e){return{name:e.name,mangledName:e.mangledName,stage:e.stage,...e.workgroupSize?{workgroupSize:e.workgroupSize.map(nn)}:{},bindings:rn(e.bindings??[]),samplingPairs:rn(e.samplingPairs??[]),...e.inputs?{inputs:rn(e.inputs)}:{}}}function nn(e){return Number.isFinite(e)?e:`unresolved`}function rn(e){if(Array.isArray(e))return e.map(rn);if(typeof e!=`object`||!e)return e;let t={};for(let[n,r]of Object.entries(e))r!==void 0&&(t[n]=rn(r));return t}var an=14695981039346656037n,on=1099511628211n,sn=18446744073709551615n;function cn(e){let t=an;for(let n=0;n<e.length;n++){let r=e.charCodeAt(n);t=ln(t,r&255),t=ln(t,r>>>8)}return`fnv1a64-utf16le-v1:${t.toString(16).padStart(16,`0`)}`}function ln(e,t){return(e^BigInt(t))*on&sn}var un=`@vgpu/wgsl/prepare-v2`;function dn(e,t=`<runtime>`){if(typeof t!=`string`||t.length===0)throw m(`VGPU-SHADER-SOURCE-INVALID`,`Invalid prepareShader() path: expected a nonempty string`);let n=qt(e);return Kt({version:2,wgsl:n.wgsl,reflection:en(Gt(n.wgsl,t)),sourceChecksum:cn(n.wgsl),producer:un,...n.functionExports===void 0?{}:{functionExports:n.functionExports}})}var fn=e(t(),1),pn=n(),mn=`aero-shards`,hn=`aero-shards-canvas`,gn=[`full`,`left`,`right`,`center`],_n={glass:[0,0,0,0],chrome:[1,0,0,0]},vn=24,yn=160,Y=4,bn=3.1,xn=2.75,Sn=[1,.5],Cn=1,X=[2.7,3.9,5.6,8.1,11.6],wn=[.26,.23,.2,.17,.14],Tn=[1,1.3,1.8,2.6,3.6],En=[1,.8,.52,.32,.2],Z=X.length,Dn={plus:0,dots:1},On=8,kn=[[.37,.61],[.83,.12],[.21,.88],[.66,.44],[.05,.27]],An=4,jn=2.6,Mn=4,Nn=[[.2,-.78],[-.72,.02],[.58,-.06],[-.24,.62],[.8,.3]],Pn=[.84,.62,.44,.28,.14],Fn=[[.98,.78],[.9,.7],[.84,.64],[.8,.6],[.76,.56]],Q=Math.PI*2,In=[0,0,0,0],Ln=dn(`
struct Frame {
  view: vec4f,
  eye: vec4f,
  forward: vec4f,
  right: vec4f,
  up: vec4f,
  shard: vec4f,
  accent: vec4f,
  marker: vec4f,
  surface: vec4f,
}

struct Layer {
  view: vec4f,
  look: vec4f,
}

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat, first) center: vec4f,
  @location(1) @interpolate(flat, first) axis: vec4f,
  @location(2) @interpolate(flat, first) normal: vec4f,
  @location(3) @interpolate(flat, first) p01: vec4f,
  @location(4) @interpolate(flat, first) p23: vec4f,
  @location(5) @interpolate(flat, first) p4: vec4f,
  @location(6) @interpolate(flat, first) topA: vec4f,
  @location(7) @interpolate(flat, first) topB: vec4f,
  @location(8) @interpolate(flat, first) topC: vec4f,
  @location(9) @interpolate(flat, first) bottomA: vec4f,
  @location(10) @interpolate(flat, first) bottomB: vec4f,
  @location(11) @interpolate(flat, first) bottomC: vec4f,
}

struct FragmentOut {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
}

@group(0) @binding(0) var<uniform> scene: Frame;
@group(0) @binding(1) var<storage, read> shards: array<vec4f>;
@group(0) @binding(2) var<uniform> layerInfo: Layer;

fn project(world: vec3f) -> vec3f {
  let offset = world - scene.eye.xyz;
  let depth = max(dot(offset, scene.forward.xyz), 0.05);
  let x = dot(offset, scene.right.xyz);
  let y = dot(offset, scene.up.xyz);
  return vec3f(layerInfo.view.x * 0.5 + x * layerInfo.view.z / depth, layerInfo.view.y * 0.5 - y * layerInfo.view.z / depth, depth);
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> VertexOut {
  let index = instance * 6u;
  let a = shards[index];
  let b = shards[index + 1u];
  let c = shards[index + 2u];
  let d = shards[index + 3u];
  let e = shards[index + 4u];
  let f = shards[index + 5u];
  let center = a.xyz;
  let size = a.w;
  let axis = normalize(b.xyz);
  let normal = normalize(c.xyz);
  let side = normalize(cross(normal, axis));

  var out: VertexOut;
  let middle = project(center);
  if (middle.z < 0.35 || size <= 0.0) {
    out.position = vec4f(2.0, 2.0, 0.5, 1.0);
    return out;
  }

  let count = i32(f.z);
  let points = array<vec2f, 5>(d.xy, d.zw, e.xy, e.zw, f.xy);
  var low = vec2f(1e9);
  var high = vec2f(-1e9);
  var tops = array<vec2f, 5>(vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0));
  var bottoms = array<vec2f, 5>(vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0));
  for (var i = 0; i < 5; i += 1) {
    let corner = points[min(i, count - 1)];
    let onPlate = center + (axis * corner.x + side * corner.y) * size;
    let top = project(onPlate + normal * b.w * size);
    let bottom = project(onPlate - normal * b.w * size);
    tops[i] = top.xy;
    bottoms[i] = bottom.xy;
    low = min(low, min(top.xy, bottom.xy));
    high = max(high, max(top.xy, bottom.xy));
  }
  low -= vec2f(2.0);
  high += vec2f(2.0);
  let corners = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let pixel = mix(low, high, corners[vertexIndex]);
  out.position = vec4f(pixel.x / layerInfo.view.x * 2.0 - 1.0, 1.0 - pixel.y / layerInfo.view.y * 2.0, 0.5, 1.0);
  out.center = a;
  out.axis = vec4f(axis, b.w);
  out.normal = vec4f(normal, c.w);
  out.p01 = d;
  out.p23 = e;
  out.p4 = f;
  out.topA = vec4f(tops[0], tops[1]);
  out.topB = vec4f(tops[2], tops[3]);
  out.topC = vec4f(tops[4], 0.0, 0.0);
  out.bottomA = vec4f(bottoms[0], bottoms[1]);
  out.bottomB = vec4f(bottoms[2], bottoms[3]);
  out.bottomC = vec4f(bottoms[4], 0.0, 0.0);
  return out;
}

fn cross2(a: vec2f, b: vec2f) -> f32 {
  return a.x * b.y - a.y * b.x;
}

fn outlineCoverage(p: vec2f, points: array<vec2f, 5>, count: i32) -> f32 {
  var area = 0.0;
  for (var i = 0; i < 5; i += 1) {
    if (i < count) {
      area += cross2(points[i], points[(i + 1) % count]);
    }
  }
  let orient = select(-1.0, 1.0, area > 0.0);
  var distance = -1e9;
  for (var i = 0; i < 5; i += 1) {
    if (i < count) {
      let a = points[i];
      let edge = points[(i + 1) % count] - a;
      let span = length(edge);
      if (span > 1e-4) {
        let n = vec2f(edge.y, -edge.x) * (orient / span);
        distance = max(distance, dot(p - a, n));
      }
    }
  }
  return clamp(0.5 - distance, 0.0, 1.0);
}

struct Prism {
  points: array<vec2f, 5>,
  count: i32,
  half: f32,
}

struct Hit {
  near: f32,
  far: f32,
  normal: vec3f,
}

fn plane(prism: Prism, k: i32) -> vec4f {
  if (k == 0) { return vec4f(0.0, 0.0, 1.0, prism.half); }
  if (k == 1) { return vec4f(0.0, 0.0, -1.0, prism.half); }
  let a = prism.points[k - 2];
  let b = prism.points[(k - 1) % prism.count];
  let edge = b - a;
  let n = normalize(vec2f(edge.y, -edge.x));
  return vec4f(n, 0.0, dot(n, a));
}

fn trace(prism: Prism, ro: vec3f, rd: vec3f) -> Hit {
  var hit: Hit;
  hit.near = -1e9;
  hit.far = 1e9;
  hit.normal = vec3f(0.0, 0.0, 1.0);
  for (var k = 0; k < 7; k += 1) {
    if (k < prism.count + 2) {
      let p = plane(prism, k);
      let denom = dot(p.xyz, rd);
      let gap = p.w - dot(p.xyz, ro);
      if (abs(denom) < 1e-7) {
        if (gap < 0.0) { hit.far = -1e9; }
      } else {
        let t = gap / denom;
        if (denom < 0.0) {
          if (t > hit.near) {
            hit.near = t;
            hit.normal = p.xyz;
          }
        } else if (t < hit.far) {
          hit.far = t;
        }
      }
    }
  }
  return hit;
}

fn exitFrom(prism: Prism, ro: vec3f, rd: vec3f) -> vec4f {
  var best = 1e9;
  var normal = vec3f(0.0, 0.0, -1.0);
  for (var k = 0; k < 7; k += 1) {
    if (k < prism.count + 2) {
      let p = plane(prism, k);
      let denom = dot(p.xyz, rd);
      if (denom > 1e-6) {
        let t = (p.w - dot(p.xyz, ro)) / denom;
        if (t < best) {
          best = t;
          normal = p.xyz;
        }
      }
    }
  }
  return vec4f(normal, max(best, 0.0));
}

fn rectLight(r: vec3f, dir: vec3f, across: vec3f, extent: vec2f, soft: f32) -> f32 {
  let facing = dot(r, dir);
  if (facing <= 0.0) { return 0.0; }
  let up = cross(dir, across);
  let u = dot(r, across) / facing;
  let v = dot(r, up) / facing;
  let a = 1.0 - smoothstep(extent.x - soft, extent.x + soft, abs(u));
  let b = 1.0 - smoothstep(extent.y - soft, extent.y + soft, abs(v));
  return a * b;
}

const KEY_DIR = vec3f(-0.28, 0.72, 0.64) / length(vec3f(-0.28, 0.72, 0.64));
const KEY_ACROSS = vec3f(0.92, 0.0, 0.4) / length(vec3f(0.92, 0.0, 0.4));
const LEFT_DIR = vec3f(-0.86, 0.12, 0.5) / length(vec3f(-0.86, 0.12, 0.5));
const LEFT_ACROSS = vec3f(0.5, 0.0, 0.86) / length(vec3f(0.5, 0.0, 0.86));
const RIM_DIR = vec3f(0.78, 0.22, -0.58) / length(vec3f(0.78, 0.22, -0.58));
const RIM_ACROSS = vec3f(0.6, 0.0, 0.8) / length(vec3f(0.6, 0.0, 0.8));
const TOP_DIR = vec3f(0.05, 0.94, -0.33) / length(vec3f(0.05, 0.94, -0.33));
const TOP_ACROSS = vec3f(1.0, 0.0, 0.0);

fn lobe(r: vec3f, dir: vec3f, width: f32) -> f32 {
  return exp((dot(r, dir) - 1.0) / (width * width));
}

fn studio(r: vec3f, soft: f32, accent: vec3f, ink: vec3f) -> vec3f {
  let sky = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  var col = mix(ink * 0.03, ink * 0.12 + accent * 0.03, smoothstep(0.25, 0.95, sky));
  col += mix(ink, vec3f(1.0), 0.6) * lobe(r, KEY_DIR, 0.38) * 3.6;
  col += mix(accent, vec3f(1.0), 0.2) * lobe(r, RIM_DIR, 0.34) * 3.4;
  col += vec3f(1.0, 0.98, 1.0) * rectLight(r, LEFT_DIR, LEFT_ACROSS, vec2f(0.12, 0.8), 0.08 + soft) * 3.2;
  col += vec3f(1.0, 0.98, 1.0) * rectLight(r, TOP_DIR, TOP_ACROSS, vec2f(0.9, 0.1), 0.08 + soft) * 2.6;
  return col;
}

fn studioLight(r: vec3f, soft: f32, accent: vec3f) -> vec3f {
  let ground = vec3f(0.2, 0.2, 0.23);
  let skyTone = vec3f(0.97, 0.97, 0.99);
  var col = mix(ground, skyTone, smoothstep(-0.08 - soft, 0.16 + soft, r.y));
  col = mix(col, vec3f(0.55, 0.55, 0.6), lobe(r, vec3f(0.0, -1.0, 0.0), 0.5) * 0.4);
  col += vec3f(0.4) * rectLight(r, KEY_DIR, KEY_ACROSS, vec2f(0.46, 0.3), 0.07 + soft);
  col -= vec3f(0.55) * rectLight(r, LEFT_DIR, LEFT_ACROSS, vec2f(0.1, 0.85), 0.05 + soft);
  col -= vec3f(0.45) * rectLight(r, RIM_DIR, RIM_ACROSS, vec2f(0.12, 0.9), 0.05 + soft);
  return clamp(col, vec3f(0.05), vec3f(1.2));
}

fn schlick(cosine: f32, f0: f32) -> f32 {
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosine, 0.0, 1.0), 5.0);
}

fn rayFor(pixel: vec2f) -> vec3f {
  let x = pixel.x - layerInfo.view.x * 0.5;
  let y = layerInfo.view.y * 0.5 - pixel.y;
  return normalize(scene.forward.xyz * layerInfo.view.z + scene.right.xyz * x + scene.up.xyz * y);
}

struct Surface {
  coverage: f32,
  color: vec3f,
  alpha: f32,
  depth: f32,
}

fn shade(pixel: vec2f, in: VertexOut) -> Surface {
  let center = in.center.xyz;
  let size = in.center.w;
  let axis = in.axis.xyz;
  let plateNormal = in.normal.xyz;
  let side = normalize(cross(plateNormal, axis));
  var prism: Prism;
  prism.points = array<vec2f, 5>(in.p01.xy, in.p01.zw, in.p23.xy, in.p23.zw, in.p4.xy);
  prism.count = i32(in.p4.z);
  prism.half = in.axis.w;

  let eye = scene.eye.xyz;
  let toLocal = mat3x3f(axis.x, side.x, plateNormal.x, axis.y, side.y, plateNormal.y, axis.z, side.z, plateNormal.z);
  let fromLocal = mat3x3f(axis, side, plateNormal);
  let origin = toLocal * (eye - center) / size;

  let rd = rayFor(pixel);
  let ray = toLocal * rd;
  let denom = dot(ray, vec3f(0.0, 0.0, 1.0));
  let flatT = -origin.z / select(denom, 1e-4, abs(denom) < 1e-4);
  let flatPoint = origin.xy + ray.xy * flatT;
  let footprint = max(length(fwidth(flatPoint)) * 0.7, 1e-4);
  let softBase = clamp(length(fwidth(reflect(rd, plateNormal))) * 0.5, 0.0, 0.5);

  let primary = trace(prism, origin, ray);
  let tops = array<vec2f, 5>(in.topA.xy, in.topA.zw, in.topB.xy, in.topB.zw, in.topC.xy);
  let bottoms = array<vec2f, 5>(in.bottomA.xy, in.bottomA.zw, in.bottomB.xy, in.bottomB.zw, in.bottomC.xy);
  let coverage = max(outlineCoverage(pixel, tops, prism.count), outlineCoverage(pixel, bottoms, prism.count));

  var surface: Surface;
  let facing = select(-1.0, 1.0, origin.z > 0.0);
  let capT = (facing * prism.half - origin.z) / select(ray.z, -1e-4 * facing, abs(ray.z) < 1e-4);
  let missed = primary.near > primary.far;
  let hitT = select(primary.near, capT, missed);
  let hitNormal = select(primary.normal, vec3f(0.0, 0.0, facing), missed);
  surface.coverage = select(0.0, coverage, hitT > 0.0);
  surface.color = vec3f(0.0);
  surface.alpha = 0.0;
  surface.depth = 1.0;
  if (surface.coverage <= 0.0) { return surface; }
  let mainRay = ray;

  let local = origin + mainRay * hitT;
  let worldRay = fromLocal * mainRay;
  let viewDepth = max(hitT * size * dot(worldRay, scene.forward.xyz), 0.05);
  surface.depth = clamp(1.0 - 0.3 / viewDepth, 0.0, 1.0);

  let radius = max(prism.half * 1.15, footprint * 2.5);
  var n = hitNormal;
  var bevel = 0.0;
  if (abs(n.z) > 0.5) {
    var gap = 1e9;
    for (var k = 2; k < 7; k += 1) {
      if (k < prism.count + 2) {
        let p = plane(prism, k);
        gap = min(gap, p.w - dot(p.xy, local.xy));
      }
    }
    var toward = vec2f(0.0);
    for (var k = 2; k < 7; k += 1) {
      if (k < prism.count + 2) {
        let p = plane(prism, k);
        let g = p.w - dot(p.xy, local.xy);
        toward += p.xy * exp(-(g - gap) / (radius * 0.35));
      }
    }
    toward = normalize(toward);
    bevel = clamp(1.0 - gap / radius, 0.0, 1.0);
    let angle = bevel * bevel * 0.7853982;
    n = normalize(n * cos(angle) + vec3f(toward, 0.0) * sin(angle));
  } else {
    let gap = prism.half - abs(local.z);
    bevel = clamp(1.0 - gap / radius, 0.0, 1.0);
    let angle = bevel * bevel * 0.7853982;
    n = normalize(n * cos(angle) + vec3f(0.0, 0.0, sign(local.z)) * sin(angle));
  }
  let bendRate = 1.8 / max(radius / footprint, 1.0);
  let normal = normalize(fromLocal * n);
  let view = -worldRay;
  let reflected = reflect(worldRay, normal);
  let soft = softBase + bendRate * smoothstep(0.0, 0.25, bevel) * 1.2 + clamp(footprint * 0.6, 0.0, 0.5);
  let ndv = clamp(dot(normal, view), 0.0, 1.0);

  let accent = scene.accent.rgb;
  let base = scene.shard.rgb;
  let world = center + fromLocal * local * size;
  let height = clamp(0.5 + world.y * 0.45, 0.0, 1.0);
  let tone = mix(accent, base, height);
  let body = mix(tone, mix(base, accent, 0.5), in.normal.w * 0.3);
  let mode = scene.surface.x;
  let lightMode = scene.up.w > 0.5;
  let wrap = clamp(dot(normal, KEY_DIR) * 0.5 + 0.5, 0.0, 1.0);

  var color = vec3f(0.0);
  var alpha = 1.0;
  let chrome = mode > 0.5;
  if (lightMode) {
    let env = studioLight(reflected, soft, accent);
    if (chrome) {
      color = env * mix(body, vec3f(1.0), 0.6);
    } else {
      let fresnel = schlick(ndv, 0.05);
      let diffuse = clamp(dot(normal, KEY_DIR) * 0.5 + 0.5, 0.0, 1.0);
      alpha = clamp(0.32 + fresnel * 0.5 + (1.0 - abs(n.z)) * 0.5, 0.0, 1.0);
      color = mix(body, vec3f(1.0), 0.15) * (0.5 + 0.4 * diffuse) * alpha + (env - vec3f(0.78)) * fresnel * 0.8;
    }
  } else if (chrome) {
    let env = studio(reflected, soft, accent, body);
    color = env * mix(body, vec3f(1.0), 0.55) * 0.9 + body * 0.02;
  } else {
    let fresnel = schlick(ndv, 0.04);
    let env = studio(reflected, soft, accent, body);
    var light = vec3f(0.0);
    var cursor = local;
    var direction = toLocal * refract(worldRay, normal, 1.0 / 1.5);
    var travelled = 0.0;
    var carry = 1.0 - fresnel;
    var through = 0.0;
    for (var bounce = 0; bounce < 3; bounce += 1) {
      let outlet = exitFrom(prism, cursor, direction);
      travelled += outlet.w;
      cursor = cursor + direction * outlet.w;
      let outward = outlet.xyz;
      let escaped = refract(direction, -outward, 1.5);
      if (dot(escaped, escaped) > 0.0) {
        let leave = schlick(dot(direction, outward), 0.04);
        let worldOut = normalize(fromLocal * escaped);
        let absorb = exp(-(vec3f(1.0) - body) * travelled * size * 22.0);
        let straight = smoothstep(0.97, 0.999, dot(worldOut, worldRay));
        let energy = carry * (1.0 - leave);
        light += studio(worldOut, soft * 2.0 + 0.04, accent, body) * absorb * energy * (1.0 - straight) * 2.0;
        through += energy * straight * (absorb.r + absorb.g + absorb.b) / 3.0;
        carry *= leave;
      }
      direction = reflect(direction, outward);
    }
    let edge = max(pow(1.0 - abs(n.z), 1.2), bevel * bevel * 0.85);
    let glow = mix(mix(body, accent, 0.35), vec3f(1.0), 0.28) * edge * (0.35 + 0.45 * wrap);
    color = env * fresnel * 0.85 + light * (1.0 - smoothstep(0.0, 0.6, bevel)) + body * 0.02 + glow;
    alpha = clamp(1.0 - through + edge * 0.25, 0.0, 1.0);
  }

  color *= select(1.3, 1.0, lightMode);
  let haze = smoothstep(3.5, 12.0, viewDepth) * layerInfo.look.x;
  let hazeColor = select(mix(base, accent, 0.5) * 0.3, mix(base, vec3f(1.0), 0.72), lightMode);
  color = mix(color, hazeColor * alpha + color * 0.3, haze);
  let flash = in.p4.w;
  color += mix(accent, vec3f(1.0), 0.35) * flash * select(0.5, 0.0, lightMode) * max(alpha, 0.35);
  alpha = max(alpha, flash * 0.45 * select(1.0, 0.0, lightMode));
  surface.color = color;
  surface.alpha = alpha;
  return surface;
}

@fragment
fn fs_solid(in: VertexOut) -> FragmentOut {
  let surface = shade(in.position.xy, in);
  if (surface.coverage < 0.999 || surface.alpha < 0.6) { discard; }
  var out: FragmentOut;
  out.color = vec4f(surface.color, surface.alpha);
  out.depth = surface.depth;
  return out;
}

@fragment
fn fs_edge(in: VertexOut) -> FragmentOut {
  let surface = shade(in.position.xy, in);
  if (surface.coverage <= 0.001 || (surface.coverage >= 0.9996 && surface.alpha >= 0.62)) { discard; }
  var out: FragmentOut;
  out.color = vec4f(surface.color, surface.alpha) * surface.coverage;
  out.depth = surface.depth;
  return out;
}
`),Rn=dn(`
struct Spread { texel: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> spreadInfo: Spread;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let sigma = max(spreadInfo.texel.z, 0.3);
  let reach = min(i32(ceil(sigma * 2.6)), 20);
  var total = textureSampleLevel(source, linearSampler, uv, 0.0);
  var weight = 1.0;
  for (var i = 1; i <= reach; i += 1) {
    let w = exp(-f32(i * i) / (2.0 * sigma * sigma));
    let o = spreadInfo.texel.xy * f32(i);
    total += (textureSampleLevel(source, linearSampler, uv + o, 0.0) + textureSampleLevel(source, linearSampler, uv - o, 0.0)) * w;
    weight += 2.0 * w;
  }
  return total / weight;
}
`),zn=dn(`
struct Shade {
  info: vec4f,
  more: vec4f,
}
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var depthMap: texture_depth_2d;
@group(0) @binding(2) var<uniform> shadeInfo: Shade;

@fragment
fn fs_main(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let bounds = vec2i(textureDimensions(source)) - vec2i(1);
  let here = vec2i(pixel.xy);
  let color = textureLoad(source, here, 0);
  if (color.a <= 0.002 || shadeInfo.info.z <= 0.0) { return color; }
  let depth = textureLoad(depthMap, here, 0);
  let east = textureLoad(depthMap, clamp(here + vec2i(1, 0), vec2i(0), bounds), 0);
  let west = textureLoad(depthMap, clamp(here - vec2i(1, 0), vec2i(0), bounds), 0);
  let south = textureLoad(depthMap, clamp(here + vec2i(0, 1), vec2i(0), bounds), 0);
  let north = textureLoad(depthMap, clamp(here - vec2i(0, 1), vec2i(0), bounds), 0);
  let limit = shadeInfo.more.x * 0.5;
  let slopeX = clamp(select(east - depth, depth - west, abs(depth - west) < abs(east - depth)), -limit, limit);
  let slopeY = clamp(select(south - depth, depth - north, abs(depth - north) < abs(south - depth)), -limit, limit);
  var occlusion = 0.0;
  for (var i = 1; i <= 12; i += 1) {
    let offset = -shadeInfo.info.xy * f32(i);
    let probe = clamp(vec2i(pixel.xy + offset), vec2i(0), bounds);
    let other = textureLoad(depthMap, probe, 0);
    let expected = depth + slopeX * offset.x + slopeY * offset.y;
    let closer = smoothstep(shadeInfo.more.x * 0.6, shadeInfo.more.x * 2.4, expected - other);
    let reach = 1.0 - f32(i - 1) / 12.0;
    occlusion = max(occlusion, closer * reach * reach);
  }
  return vec4f(color.rgb * (1.0 - occlusion * shadeInfo.info.z), color.a);
}
`),Bn=dn(`
struct Blend { info: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> mixInfo: Blend;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleLevel(source, linearSampler, uv, 0.0) * mixInfo.info.x;
}
`),Vn=dn(`
struct Frame {
  view: vec4f,
  eye: vec4f,
  forward: vec4f,
  right: vec4f,
  up: vec4f,
  shard: vec4f,
  accent: vec4f,
  marker: vec4f,
  surface: vec4f,
}

struct MarkerOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat, first) shape: vec4f,
  @location(2) @interpolate(flat, first) light: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Frame;
@group(0) @binding(1) var<storage, read> markers: array<vec4f>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instance: u32) -> MarkerOut {
  let a = markers[instance * 2u];
  let b = markers[instance * 2u + 1u];
  let offset = a.xyz - scene.eye.xyz;
  let depth = max(dot(offset, scene.forward.xyz), 0.05);
  let center = vec2f(
    scene.view.x * 0.5 + dot(offset, scene.right.xyz) * scene.view.z / depth,
    scene.view.y * 0.5 - dot(offset, scene.up.xyz) * scene.view.z / depth,
  );
  let pixel = scene.marker.y;
  let size = scene.marker.z * clamp(sqrt(scene.marker.w / depth), 0.6, 1.3) * b.z;
  let blur = min(scene.forward.w * abs(1.0 - scene.eye.w / depth), scene.right.w) * 0.18;
  let frame = b.y;
  let reach = select(size, size * 2.6, frame > 0.001) + blur + 1.5 * pixel;
  let corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  let corner = corners[vertexIndex % 6u] * reach;
  var out: MarkerOut;
  if (depth < 0.35 || a.w <= 0.002) {
    out.position = vec4f(2.0, 2.0, 0.5, 1.0);
    return out;
  }
  let at = center + corner;
  out.position = vec4f(at.x / scene.view.x * 2.0 - 1.0, 1.0 - at.y / scene.view.y * 2.0, 0.5, 1.0);
  out.local = corner;
  out.shape = vec4f(size, blur, frame, pixel);
  out.light = vec4f(b.x, a.w, 0.0, 0.0);
  return out;
}

fn bar(value: f32, edge: f32, soft: f32) -> f32 {
  return clamp((edge - value) / soft + 0.5, 0.0, 1.0);
}

@fragment
fn fs_main(in: MarkerOut) -> @location(0) vec4f {
  let size = in.shape.x;
  let blur = in.shape.y;
  let frame = in.shape.z;
  let pixel = in.shape.w;
  let q = abs(in.local);
  let soft = 1.0 + blur;
  let thick = 0.6 * pixel + blur * 0.5;
  let energy = (0.6 * pixel) / thick;
  var cover = 0.0;
  if (scene.marker.x < 0.5) {
    let across = bar(q.x, size, soft) * bar(q.y, thick, soft);
    let down = bar(q.y, size, soft) * bar(q.x, thick, soft);
    cover = max(across, down) * energy;
  } else {
    cover = bar(length(in.local), size * 0.42 + blur * 0.3, soft) * mix(1.0, energy, 0.6);
  }
  if (frame > 0.001) {
    let edge = size * 2.3;
    let span = edge * 0.45;
    let line = 0.5 * pixel;
    let sides = bar(abs(q.x - edge), line, 1.0) * bar(edge - span - q.y, 0.0, 1.0) * bar(q.y - edge - line, 0.0, 1.0);
    let caps = bar(abs(q.y - edge), line, 1.0) * bar(edge - span - q.x, 0.0, 1.0) * bar(q.x - edge - line, 0.0, 1.0);
    cover = max(cover, max(sides, caps) * frame * 0.85);
  }
  let glow = in.light.x;
  let fade = in.light.y;
  let tint = mix(scene.shard.rgb, scene.accent.rgb, 0.4);
  if (scene.up.w > 0.5) {
    let ink = (1.0 - exp(-glow * 1.6)) * 0.85 * cover * fade;
    return vec4f(mix(tint, scene.accent.rgb, 0.5) * 0.55 * ink, ink);
  }
  let light = cover * glow * fade;
  let color = (1.0 - exp(-mix(tint, vec3f(1.0), 0.35) * light * 1.6)) * 1.4;
  return vec4f(color, max(max(color.r, color.g), color.b) * 0.8);
}
`),Hn=dn(`
struct Bloom { texel: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> bloom: Bloom;

fn bright(uv: vec2f) -> vec3f {
  let color = textureSampleLevel(source, linearSampler, uv, 0.0).rgb;
  let peak = max(max(color.r, color.g), color.b);
  return color * smoothstep(bloom.texel.z, bloom.texel.z + bloom.texel.w, peak);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let o = bloom.texel.xy;
  let total = bright(uv + vec2f(o.x, o.y)) + bright(uv + vec2f(-o.x, o.y)) + bright(uv + vec2f(o.x, -o.y)) + bright(uv - o);
  return vec4f(total * 0.25, 0.0);
}
`),Un=dn(`
struct Bloom { texel: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> bloom: Bloom;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let o = bloom.texel.xy;
  var color = textureSampleLevel(source, linearSampler, uv, 0.0) * 0.25;
  color += textureSampleLevel(source, linearSampler, uv + vec2f(o.x, o.y), 0.0) * 0.1875;
  color += textureSampleLevel(source, linearSampler, uv + vec2f(-o.x, o.y), 0.0) * 0.1875;
  color += textureSampleLevel(source, linearSampler, uv + vec2f(o.x, -o.y), 0.0) * 0.1875;
  color += textureSampleLevel(source, linearSampler, uv - o, 0.0) * 0.1875;
  return color;
}
`),Wn=dn(`
struct Bloom { texel: vec4f }
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> bloom: Bloom;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let delta = bloom.texel.xy;
  var color = textureSampleLevel(source, linearSampler, uv, 0.0) * 0.181862;
  color += (textureSampleLevel(source, linearSampler, uv + delta * 1.423135, 0.0) + textureSampleLevel(source, linearSampler, uv - delta * 1.423135, 0.0)) * 0.284316;
  color += (textureSampleLevel(source, linearSampler, uv + delta * 3.326702, 0.0) + textureSampleLevel(source, linearSampler, uv - delta * 3.326702, 0.0)) * 0.106598;
  color += (textureSampleLevel(source, linearSampler, uv + delta * 5.242989, 0.0) + textureSampleLevel(source, linearSampler, uv - delta * 5.242989, 0.0)) * 0.018156;
  return color;
}
`),Gn=dn(`
struct Finish {
  info: vec4f,
  paper: vec4f,
  mode: vec4f,
}
@group(0) @binding(0) var sceneTexture: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var bloom0: texture_2d<f32>;
@group(0) @binding(3) var bloom1: texture_2d<f32>;
@group(0) @binding(4) var bloom2: texture_2d<f32>;
@group(0) @binding(5) var bloom3: texture_2d<f32>;
@group(0) @binding(6) var<uniform> finish: Finish;

fn hash12(value: vec2f) -> f32 {
  let p = fract(value * vec2f(0.1031, 0.1030));
  let mixed = p + dot(p, p.yx + 33.33);
  return fract((mixed.x + mixed.y) * mixed.x);
}

fn smootherstep(x: f32) -> f32 {
  let t = clamp(x, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

@fragment
fn fs_main(@location(0) uv: vec2f, @builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let scene = textureLoad(sceneTexture, vec2i(pixel.xy), 0);
  let alpha = clamp(scene.a, 0.0, 1.0);
  let noise = hash12(floor(pixel.xy) + vec2f(finish.info.y, finish.info.y * 1.618)) - 0.5;
  let grain = 1.0 + noise * finish.info.x;
  var rgb = vec3f(0.0);
  var a = alpha;
  if (finish.mode.x > 0.5) {
    rgb = clamp(scene.rgb, vec3f(0.0), vec3f(alpha)) * grain;
  } else {
    var halo = textureSampleLevel(bloom0, linearSampler, uv, 0.0).rgb * 0.4;
    halo += textureSampleLevel(bloom1, linearSampler, uv, 0.0).rgb * 0.3;
    halo += textureSampleLevel(bloom2, linearSampler, uv, 0.0).rgb * 0.2;
    halo += textureSampleLevel(bloom3, linearSampler, uv, 0.0).rgb * 0.1;
    halo = halo * finish.info.z;
    rgb = (1.0 - exp(-max(scene.rgb, vec3f(0.0)) * finish.info.w)) * grain + halo / (1.0 + halo);
    a = max(alpha, max(max(rgb.r, rgb.g), rgb.b));
  }
  let vignette = finish.mode.y;
  if (vignette > 0.0) {
    let size = vec2f(textureDimensions(sceneTexture));
    let reach = max(vignette * 0.5 * min(size.x, size.y), 1.0);
    let fromEdge = min(pixel.xy, size - pixel.xy);
    let mask = smootherstep(fromEdge.x / reach) * smootherstep(fromEdge.y / reach);
    rgb *= mask;
    a *= mask;
  }
  rgb = clamp(rgb, vec3f(0.0), vec3f(max(a, 0.0)));
  if (finish.paper.a > 0.5) {
    return vec4f(finish.paper.rgb * (1.0 - a) + rgb, 1.0);
  }
  return vec4f(rgb, a);
}
`),$=(e,t,n)=>Math.min(n,Math.max(t,e)),Kn=e=>{let t=$(e,0,1);return t*t*t*(t*(t*6-15)+10)},qn=null,Jn=e=>{let t=e.trim();if(!t.startsWith(`#`))return null;if(t.length===4){let e=parseInt(t[1]+t[1],16),n=parseInt(t[2]+t[2],16),r=parseInt(t[3]+t[3],16);return Number.isNaN(e)||Number.isNaN(n)||Number.isNaN(r)?null:[e/255,n/255,r/255]}if(t.length===7){let e=parseInt(t.slice(1),16);return Number.isNaN(e)?null:[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}return null},Yn=(e,t)=>{if(e===`transparent`)return null;let n=Jn(e);if(n)return n;if(typeof document>`u`||(qn||=document.createElement(`canvas`).getContext(`2d`),!qn))return t;qn.fillStyle=`#000000`,qn.fillStyle=e;let r=qn.fillStyle;if(r.startsWith(`#`)){let e=parseInt(r.slice(1),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]}let i=/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(r);return i?i[4]!==void 0&&Number(i[4])===0?null:[Number(i[1])/255,Number(i[2])/255,Number(i[3])/255]:t},Xn=()=>typeof window>`u`?!1:typeof document<`u`&&document.querySelector(`[data-reduced-motion="true"]`)?!0:window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches??!1,Zn=(e,t,n,r)=>{let i=Math.imul(e+2654435769,2246822507)^Math.imul(t+1663821227,3266489909);return i^=Math.imul(n+668265263,374761393)^Math.imul(r+2135587861,2654435761),i=Math.imul(i^i>>>15,739982445),i=Math.imul(i^i>>>12,695872825),((i^i>>>15)>>>0)/4294967296},Qn=e=>{let t=e;return()=>{t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}},$n=(e,t,n,r,i)=>{let a,o,s;if(e===0){a=-1.32+2.64*n;let e=Nn[t];o=e[0]+(e[1]-e[0])*n+.1*Math.sin(n*Q*.7+t*2.3)+.045*Math.sin(n*Q*1.9+t),s=X[t]+.35*Math.sin(n*Math.PI*1.4+t*1.9)}else if(e===3){let e=n*Q+t*.9+Math.PI*.5,r=Fn[t];a=Math.cos(e)*r[0],o=Math.sin(e)*r[1]-.02,s=X[t]*1.1-Math.sin(e)*(.5+t*.25)}else{let r=e===1?-1:1;o=1.32-2.64*n,a=r*(Pn[t]+.1*Math.sin(n*Q*.6+t*1.3)+.03*Math.sin(n*Q*2.1+t)-.08*(1-n)),s=X[t]+.3*Math.sin(n*Math.PI*1.2+t)}return i[0]=a*r*s/Y,i[1]=o*s/Y,i[2]=Y-s,i},er=(e,t)=>{let n=Qn(t),r=[],i=0;for(let t=0;t<Z;t+=1){let a=t===Z-1?e-i:Math.round(e*wn[t]);i+=a;for(let e=0;e<a;e+=1){let i=n()*2-1,o=n(),s=[];if(o<.55){let e=.17+n()*.15;s.push([1,(n()-.5)*.08]),s.push([-.5-n()*.25,e*(.8+n()*.4)]),s.push([-.5-n()*.25,-e*(.8+n()*.4)])}else if(o<.8){let e=.2+n()*.14;s.push([1,0]),s.push([(n()-.3)*.5,e]),s.push([-.55-n()*.2,(n()-.5)*.1]),s.push([(n()-.3)*.5,-e*(.8+n()*.4)])}else{let e=n()<.5?4:5,t=.4+n()*.3,r=n()*Q;for(let i=0;i<e;i+=1){let a=r+(i+(n()-.5)*.6)*Q/e;s.push([Math.cos(a),Math.sin(a)*t])}}let c=s.length,l=0,u=0;for(let e of s)l+=e[0]/c,u+=e[1]/c;let d=[];for(let e=0;e<5;e+=1){let t=s[Math.min(e,c-1)];d.push(t[0]-l,t[1]-u)}r.push({level:t,phase:(e+n())/Math.max(a,1),lane:Math.sign(i)*Math.abs(i)**.85,layer:Math.sqrt(-2*Math.log(Math.max(n(),1e-6)))*Math.cos(Q*n()),size:.6+n()*n()*1.25,shape:d,sides:c,thickness:.06+n()*.04,yaw:(n()-.5)*.36,bank:(n()-.5)*.5,pitch:(n()-.5)*.24,tint:n(),drift:[n()*Q,n()*Q,n()*Q],rate:[.3+n()*.35,.25+n()*.35,.3+n()*.3],flutter:[n()*Q,.5+n()*.5],arrive:n(),sign:n()<.5?-1:1,slot:[n()*Q,.06+.3*Math.sqrt(n()),n()-.5,n()<.85?1:-1],offset:[0,0,0],velocity:[0,0,0],tilt:0,tiltVelocity:0,flash:0,gather:0,joined:!1,position:[0,0,0],s:0})}}return r};function tr({shardColor:e=`#896ABD`,accentColor:t=`#A855F7`,backgroundColor:n=`transparent`,lightMode:f=!1,placement:p=`full`,material:m=`glass`,count:ee=1300,shardSize:h=1,spread:g=1,twist:_=1,billow:v=1,speed:y=1,scale:b=1,depthOfField:x=.75,glow:S=.35,grain:C=.06,vignette:te=.3,intro:w=!0,mouseInteraction:T=!0,mouseStrength:ne=.6,markers:re=`plus`,pulseOnClick:E=!0,holdToGather:D=!0,parallax:O=.5,paused:ie=!1,dpr:ae=2,className:k=``,style:oe,onError:se}){let A=(0,fn.useRef)(null),j=(0,fn.useRef)(se);j.current=se;let M={shard:Yn(e,[.54,.42,.74])??[.54,.42,.74],accent:Yn(t,[.66,.33,.97])??[.66,.33,.97],paper:Yn(n,null),lightMode:f,placement:Math.max(0,gn.indexOf(p)),material:_n[m]??_n.glass,count:Math.round($(ee,100,6e3)),shardSize:$(h,.2,4),spread:$(g,0,3),twist:$(_,0,3),billow:$(v,0,3),speed:$(y,0,4),scale:$(b,.4,2.5),depthOfField:$(x,0,1),glow:$(S,0,2),grain:$(C,0,.5),vignette:$(te,0,1),intro:w,mouseInteraction:T,mouseStrength:$(ne,0,1),markers:Dn[re]??-1,pulseOnClick:E,holdToGather:D,parallax:$(O,0,1),paused:ie,dpr:Math.max(.5,ae)},N=(0,fn.useRef)(M);return N.current=M,(0,fn.useEffect)(()=>{let e=A.current;if(!e)return;let t=document.createElement(`canvas`);t.className=hn,e.appendChild(t);let n=!1,f=null,p=0,m=[],ee=e=>{n||(n=!0,cancelAnimationFrame(p),f?.dispose(),f=null,j.current?.(e instanceof Error?e:Error(String(e))))};return(async()=>{if(typeof navigator>`u`||!(`gpu`in navigator)||!navigator.gpu)throw Error(`WebGPU is not available`);let h=await d({powerPreference:`high-performance`});if(f=h,n){h.dispose();return}m.push(h.onError(ee));let g=navigator.gpu.getPreferredCanvasFormat(),_=()=>{let t=Math.min(window.devicePixelRatio||1,N.current.dpr);return[Math.max(1,Math.round(e.clientWidth*t)),Math.max(1,Math.round(e.clientHeight*t))]},v=o(h,t,{autoResize:!1,size:_(),format:g,alphaMode:`premultiplied`}),y=i(h,{minFilter:`linear`,magFilter:`linear`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),b=a(h,{size:v.size,format:`rgba16float`}),x=e=>[Math.max(1,Math.round(v.size[0]/2**(e+1))),Math.max(1,Math.round(v.size[1]/2**(e+1)))],S=Array.from({length:Mn},(e,t)=>({main:a(h,{size:x(t),format:`rgba16float`}),spare:a(h,{size:x(t),format:`rgba16float`})})),C=s(h,{view:[1,1,1,0],eye:[0,0,Y,bn],forward:[0,0,-1,0],right:[1,0,0,0],up:[0,1,0,0],shard:[.54,.42,.74,.5],accent:[.66,.33,.97,0],marker:[0,1,4,Y],surface:[7,0,0,2.4]}),te=0,w=null,T=new Float32Array,ne=u(h,{shader:Vn,vertices:6,cull:`none`,depth:!1,blend:`premultiplied`,label:`aero-shards-markers`}),re=e=>{e<=te&&w||(te=Math.max(e,512),T=new Float32Array(te*On),w=l(h,T.byteLength,`read`),ne.set({scene:C,markers:w}))};re(512);let E=e=>[Math.max(1,Math.round(v.size[0]*e)),Math.max(1,Math.round(v.size[1]*e))],D=Sn.map((e,t)=>({scale:e,layer:a(h,{size:E(e),format:`rgba16float`,depth:`depth32float`}),shaded:a(h,{size:E(e),format:`rgba16float`}),temp:a(h,{size:t===0?[1,1]:E(e),format:`rgba16float`}),blurred:a(h,{size:t===0?[1,1]:E(e),format:`rgba16float`}),softReady:t!==0})),O=X.map(()=>s(h,{view:[1,1,1,0],look:[.7,0,0,0]})),ie=X.map(()=>s(h,{texel:[0,0,0,0]})),ae=X.map(()=>s(h,{texel:[0,0,0,0]})),k=X.map(()=>s(h,{info:[1,0,0,0]})),oe=X.map(()=>s(h,{info:[0,0,0,0],more:[0,0,0,0]})),se=X.map((e,t)=>u(h,{shader:Ln,entry:{fragment:`fs_solid`},vertices:6,cull:`none`,depth:{write:!0,compare:`less`},label:`aero-shards-solid-${t}`})),A=X.map((e,t)=>u(h,{shader:Ln,entry:{fragment:`fs_edge`},vertices:6,cull:`none`,depth:{write:!1,compare:`less`},blend:`premultiplied`,label:`aero-shards-edge-${t}`})),j=X.map((e,t)=>D.map((e,n)=>({shadow:c(h,zn,{label:`aero-shards-shadow-${t}-${n}`,set:{source:e.layer,depthMap:e.layer.depth,shadeInfo:oe[t]}}),blurX:c(h,Rn,{label:`aero-shards-depth-x-${t}-${n}`,set:{source:e.shaded,linearSampler:y,spreadInfo:ie[t]}}),blurY:c(h,Rn,{label:`aero-shards-depth-y-${t}-${n}`,set:{source:e.temp,linearSampler:y,spreadInfo:ae[t]}}),sharp:c(h,Bn,{label:`aero-shards-sharp-${t}-${n}`,blend:`premultiplied`,set:{source:e.shaded,linearSampler:y,mixInfo:k[t]}}),soft:c(h,Bn,{label:`aero-shards-soft-${t}-${n}`,blend:`premultiplied`,set:{source:e.blurred,linearSampler:y,mixInfo:k[t]}})}))),M=0,P=null,ce=new Float32Array,F=new Float32Array,I=new Float32Array,le=e=>{if(e<=M&&P)return;M=Math.max(e,256),ce=new Float32Array(M*vn),F=new Float32Array(M*vn),I=new Float32Array(M);let t=l(h,ce.byteLength,`read`);P=t,X.forEach((e,n)=>{se[n].set({scene:C,shards:t,layerInfo:O[n]}),A[n].set({scene:C,shards:t,layerInfo:O[n]})})};le(N.current.count);let ue=S.map((e,t)=>{let n=t===0?b:S[t-1].main,r=s(h,{texel:[0,0,0,0]}),i=s(h,{texel:[0,0,0,0]}),a=s(h,{texel:[0,0,0,0]});return{source:n,level:e,downParams:r,horizontalParams:i,verticalParams:a,down:c(h,t===0?Hn:Un,{label:`aero-shards-down-${t}`,set:{source:n,linearSampler:y,bloom:r}}),horizontal:c(h,Wn,{label:`aero-shards-blur-x-${t}`,set:{source:e.main,linearSampler:y,bloom:i}}),vertical:c(h,Wn,{label:`aero-shards-blur-y-${t}`,set:{source:e.spare,linearSampler:y,bloom:a}})}}),L=s(h,{info:[0,0,0,1],paper:[0,0,0,0],mode:[0,0,0,0]}),de=c(h,Gn,{label:`aero-shards-finish`,set:{sceneTexture:b,linearSampler:y,bloom0:S[0].main,bloom1:S[1].main,bloom2:S[2].main,bloom3:S[3].main,finish:L}});if(await Promise.all([...se.map(e=>e.compile(D[0].layer)),...A.map(e=>e.compile(D[0].layer)),...j.flatMap(e=>e.flatMap((e,t)=>[e.shadow.compile(D[t].shaded),e.blurX.compile(D[t].temp),e.blurY.compile(D[t].blurred),e.sharp.compile(b),e.soft.compile(b)])),ne.compile(b),de.compile({colors:[g]}),...ue.flatMap((e,t)=>[e.down.compile(S[t].main),e.horizontal.compile(S[t].spare),e.vertical.compile(S[t].main)])]),n)return;let fe=Array.from({length:Z},()=>({position:new Float32Array(480),tangent:new Float32Array(480),across:new Float32Array(480),lift:new Float32Array(480),length:1})),pe=[0,0,0,0,0],R=[0,0,0,0,0],z=new Float32Array(483),B=new Float32Array(161),me=[0,0,0],he=``,V={visible:typeof IntersectionObserver>`u`,clock:0,last:0,travel:new Float64Array(Z),roll:0,twist:0,drift:0,introAt:-1,weights:gn.map((e,t)=>+(t===N.current.placement)),weightVelocity:[0,0,0,0],shards:er(N.current.count,1337),order:[],pointer:[.5,.5],inside:!1,presence:0,yaw:0,pitch:0,yawVelocity:0,pitchVelocity:0,pressAt:-1,pressPoint:null,holding:!1,hold:0,reach:0,gatherCenter:[0,0,0],rings:[],markerDrift:0,markerTarget:``,markerTotal:0,targets:new Map,quiet:0,seen:null},ge=e=>{let t=V.weights[3]>.999,n=`${e.toFixed(4)}|${V.weights.map(e=>e.toFixed(4)).join(`,`)}`;if(n===he)return t;he=n;for(let t=0;t<Z;t+=1){let n=fe[t],r=0;for(let n=0;n<=yn;n+=1){let i=n/yn,a=0,o=0,s=0;for(let n=0;n<4;n+=1){let r=V.weights[n];r<1e-4||($n(n,t,i,e,me),a+=me[0]*r,o+=me[1]*r,s+=me[2]*r)}z[n*3]=a,z[n*3+1]=o,z[n*3+2]=s,n>0&&(r+=Math.hypot(a-z[n*3-3],o-z[n*3-2],s-z[n*3-1])),B[n]=r}n.length=Math.max(r,.001);let i=0;for(let e=0;e<yn;e+=1){let t=e/159*r;for(;i<159&&B[i+1]<t;)i+=1;let a=Math.max(B[i+1]-B[i],1e-6),o=$((t-B[i])/a,0,1);for(let t=0;t<3;t+=1)n.position[e*3+t]=z[i*3+t]+(z[i*3+3+t]-z[i*3+t])*o}let a=0,o=1,s=0;for(let e=0;e<yn;e+=1){let t=Math.max(0,e-1),r=Math.min(159,e+1),i=n.position[r*3]-n.position[t*3],c=n.position[r*3+1]-n.position[t*3+1],l=n.position[r*3+2]-n.position[t*3+2],u=Math.hypot(i,c,l)||1;i/=u,c/=u,l/=u,e===0&&(a=-c,o=i,s=0);let d=a*i+o*c+s*l;a-=i*d,o-=c*d,s-=l*d;let f=Math.hypot(a,o,s)||1;a/=f,o/=f,s/=f,n.tangent[e*3]=i,n.tangent[e*3+1]=c,n.tangent[e*3+2]=l,n.across[e*3]=a,n.across[e*3+1]=o,n.across[e*3+2]=s,n.lift[e*3]=c*s-l*o,n.lift[e*3+1]=l*a-i*s,n.lift[e*3+2]=i*o-c*a}}return t},_e=()=>{let e=_();(e[0]!==v.size[0]||e[1]!==v.size[1])&&(v.resize(e),b.resize(e),D.forEach(e=>{e.layer.resize(E(e.scale)),e.shaded.resize(E(e.scale)),e.softReady&&(e.temp.resize(E(e.scale)),e.blurred.resize(E(e.scale)))}),S.forEach((e,t)=>{e.main.resize(x(t)),e.spare.resize(x(t))}),j.forEach(e=>e.forEach((e,t)=>e.shadow.set({depthMap:D[t].layer.depth}))),V.quiet=0)};if(typeof ResizeObserver<`u`){let t=new ResizeObserver(_e);t.observe(e),m.push(()=>t.disconnect())}let H={eye:[0,0,Y],forward:[0,0,-1],right:[1,0,0],up:[0,1,0],focal:1},ve=e=>{let t=Math.cos(V.yaw),n=Math.sin(V.yaw),r=Math.cos(V.pitch),i=Math.sin(V.pitch);H.eye[0]=n*r*Y,H.eye[1]=i*Y,H.eye[2]=t*r*Y,H.forward[0]=-n*r,H.forward[1]=-i,H.forward[2]=-t*r;let a=Math.hypot(H.forward[2],H.forward[0])||1;H.right[0]=-H.forward[2]/a,H.right[1]=0,H.right[2]=H.forward[0]/a,H.up[0]=H.right[1]*H.forward[2]-H.right[2]*H.forward[1],H.up[1]=H.right[2]*H.forward[0]-H.right[0]*H.forward[2],H.up[2]=H.right[0]*H.forward[1]-H.right[1]*H.forward[0],H.focal=v.size[1]*.5*Y*e.scale},U=[0,0,1],ye=(e,t)=>{let n=(e-.5)*v.size[0],r=(.5-t)*v.size[1];U[0]=H.forward[0]*H.focal+H.right[0]*n+H.up[0]*r,U[1]=H.forward[1]*H.focal+H.right[1]*n+H.up[1]*r,U[2]=H.forward[2]*H.focal+H.right[2]*n+H.up[2]*r;let i=Math.hypot(U[0],U[1],U[2])||1;return U[0]/=i,U[1]/=i,U[2]/=i,U},be=(t,n,r)=>{let i=v.size[0]/Math.max(v.size[1],1),a=ge(i),o=t.intro&&!r,s=V.introAt<0?0:V.clock-V.introAt,c=t.mouseInteraction&&!r?V.presence*t.mouseStrength:0,l=0,u=0,d=0;c>.001&&(ye(V.pointer[0],V.pointer[1]),l=U[0],u=U[1],d=U[2]);let f=Math.max(1,Math.ceil(n/(1/120))),p=n/Math.max(f,1),m=v.size[1]*.5,ee=V.rings.map(e=>{let t=e.age/jn;return{x:e.x,y:e.y,age:e.age,strength:(1-Math.exp(-e.age/.06))*(1-t)*(1-t)}}),h=(e,t,n,r)=>{let i=e-H.eye[0],a=t-H.eye[1],o=n-H.eye[2],s=Math.max(i*H.forward[0]+a*H.forward[1]+o*H.forward[2],.05);return r[0]=(i*H.right[0]+a*H.right[1]+o*H.right[2])*H.focal/s/m,r[1]=(i*H.up[0]+a*H.up[1]+o*H.up[2])*H.focal/s/m,s},g=(e,t,n)=>{let r=0;for(let i of ee){let a=Math.max(0,i.age-n*.07)*2.3,o=Math.hypot(e-i.x,t-i.y);r+=Math.exp(-((o-a)*(o-a))/.012)*i.strength}return r},_=[0,0],y=V.shards,b=Math.min(1,t.twist);for(let e=0;e<y.length;e+=1){let r=y[e],i=r.level,m=fe[i],g=(r.phase+V.travel[i])%1,v=1,x=0;if(o){let e=$((s-(i*.22+Math.max(0,g-.1)*(2.4-(Z-1)*.22)+r.arrive*.15))/.9,0,1);v=Kn(e);let t=(1-e)*(1-e);g=a?g-t*.06:Math.max(0,g-t*.06),x=t*.9*r.sign}r.s=g;let S=(g%1+1)%1*159,C=Math.floor(S),te=Math.min(C+1,159),w=S-C,T=(e,t)=>e[C*3+t]+(e[te*3+t]-e[C*3+t])*w,ne=T(m.position,0),re=T(m.position,1),E=T(m.position,2),D=T(m.tangent,0),O=T(m.tangent,1),ie=T(m.tangent,2),ae=T(m.across,0),k=T(m.across,1),oe=T(m.across,2),se=T(m.lift,0),A=T(m.lift,1),j=T(m.lift,2),M=t.twist*(g*Q*.6+V.twist+i*1.7),N=Math.cos(M),P=Math.sin(M),ce=ae*N+se*P,le=k*N+A*P,ue=oe*N+j*P,L=se*N-ae*P,de=A*N-k*P,pe=j*N-oe*P,R=X[i]/Y,z=t.spread*(.15+.035*X[i])*(.8+.3*Math.sin(g*Q*1.3+i*.8)),B=r.lane*z,me=r.layer*.012*R,he=a?1:Kn(g/.12)*Kn((1-g)/.12),ge=t.billow*.16*R*Math.sin(g*Q*1.3-V.drift*.5+i*1.1)*(.4+.6*he),_e=t.billow*.06*R*Math.sin(g*Q*.8-V.drift*.35+i*2.4),ve=.009*R,U=V.drift,ye=ne+se*ge+ae*_e+ce*B+L*me+Math.sin(U*r.rate[0]+r.drift[0])*ve,be=re+A*ge+k*_e+le*B+de*me+Math.sin(U*r.rate[1]+r.drift[1])*ve,xe=E+j*ge+oe*_e+ue*B+pe*me+Math.sin(U*r.rate[2]+r.drift[2])*ve,Se=0,Ce=0,we=0,Te=0,W=ye+r.offset[0],Ee=be+r.offset[1],De=xe+r.offset[2];if(c>.001){let e=W-H.eye[0],n=Ee-H.eye[1],r=De-H.eye[2],i=e*l+n*u+r*d,a=e-l*i,o=n-u*i,s=r-d*i,f=Math.hypot(a,o,s),p=.24*R/t.scale,m=Math.exp(-(f*f)/(p*p));if(m>.002&&f>1e-5){let e=a/f,t=o/f,n=s/f,r=(e*D+t*O+n*ie)*.7,i=c*m*9*R;Se+=(e-D*r)*i,Ce+=(t-O*r)*i,we+=(n-ie*r)*i,Te+=c*m*1.1*(e*ae+t*k+n*oe)}}if(V.hold>.001&&r.joined){let e=r.slot,i=e[0]+V.clock*(.8/(.12+e[1]))*e[3],a=e[1]/t.scale,o=V.gatherCenter[0]+Math.cos(i)*a,s=V.gatherCenter[1]+Math.sin(i)*a*.75,c=V.gatherCenter[2]+Math.sin(i)*a*.45+e[2]*.3;r.gather+=(V.hold-r.gather)*(1-Math.exp(-n/.3));let l=r.gather*30;Se+=(o-W)*l,Ce+=(s-Ee)*l,we+=(c-De)*l,Te+=r.gather*.6*Math.sin(i)}else r.gather+=(0-r.gather)*(1-Math.exp(-n/.2));if(ee.length){h(W,Ee,De,_);for(let e of ee){let t=Math.max(0,e.age-i*.07)*2.3,n=_[0]-e.x,a=_[1]-e.y,o=Math.hypot(n,a),s=Math.exp(-((o-t)*(o-t))/.012)*e.strength;if(s>.01){r.flash=Math.max(r.flash,s*.75);let e=Math.max(o,.05),t=(H.right[0]*n+H.up[0]*a)/e,i=(H.right[1]*n+H.up[1]*a)/e,c=(H.right[2]*n+H.up[2]*a)/e;Te+=s*1.4*(t*ae+i*k+c*oe);let l=s*2.2*R/Math.max(o,.05);Se+=(H.right[0]*n+H.up[0]*a)*l,Ce+=(H.right[1]*n+H.up[1]*a)*l,we+=(H.right[2]*n+H.up[2]*a)*l}}}let Oe=24*(1-r.gather*.95);for(let e=0;e<f;e+=1)r.velocity[0]+=(Se-Oe*r.offset[0]-7.5*r.velocity[0])*p,r.velocity[1]+=(Ce-Oe*r.offset[1]-7.5*r.velocity[1])*p,r.velocity[2]+=(we-Oe*r.offset[2]-7.5*r.velocity[2])*p,r.offset[0]+=r.velocity[0]*p,r.offset[1]+=r.velocity[1]*p,r.offset[2]+=r.velocity[2]*p,r.tiltVelocity+=(90*(Te-r.tilt)-15*r.tiltVelocity)*p,r.tilt+=r.tiltVelocity*p;r.flash*=Math.exp(-n/.45);let ke=ye+r.offset[0],G=be+r.offset[1],K=xe+r.offset[2];r.position[0]=ke,r.position[1]=G,r.position[2]=K;let Ae=H.eye[0]-ke,je=H.eye[1]-G,Me=H.eye[2]-K,Ne=Math.hypot(Ae,je,Me)||1;Ae/=Ne,je/=Ne,Me/=Ne;let q=D+r.velocity[0]*.05,Pe=O+r.velocity[1]*.05,Fe=ie+r.velocity[2]*.05,Ie=q*Ae+Pe*je+Fe*Me;q-=Ae*Ie,Pe-=je*Ie,Fe-=Me*Ie;let Le=Math.hypot(q,Pe,Fe);Le<1e-4&&(q=H.right[0],Pe=H.right[1],Fe=H.right[2],Le=1),q/=Le,Pe/=Le,Fe/=Le;let Re=je*Fe-Me*Pe,ze=Me*q-Ae*Fe,Be=Ae*Pe-je*q,Ve=r.yaw+.05*Math.sin(V.clock*r.flutter[1]*.7+r.flutter[0]),He=Math.cos(Ve),Ue=Math.sin(Ve),We=q*He+Re*Ue,Ge=Pe*He+ze*Ue,Ke=Fe*He+Be*Ue,qe=Re*He-q*Ue,Je=ze*He-Pe*Ue,Ye=Be*He-Fe*Ue,Xe=.8*b*Math.sin(M)+.3*Math.sin(g*Q*1.6-V.roll*.55+i*.9+r.lane*.7),Ze=.06*Math.sin(V.clock*r.flutter[1]+r.flutter[0]),Qe=Cn*Math.tanh((Xe+r.bank+Ze+r.tilt+x)/Cn),$e=Math.cos(Qe),et=Math.sin(Qe),tt=Ae*$e+qe*et,nt=je*$e+Je*et,rt=Me*$e+Ye*et,it=r.pitch+.2*Math.sin(g*Q*1.1-V.roll*.4+i*2.1),at=Math.cos(it),ot=Math.sin(it),st=We*at+tt*ot,ct=Ge*at+nt*ot,lt=Ke*at+rt*ot,ut=tt*at-We*ot,dt=nt*at-Ge*ot,ft=rt*at-Ke*ot,pt=ke-H.eye[0],mt=G-H.eye[1],ht=K-H.eye[2],gt=pt*H.forward[0]+mt*H.forward[1]+ht*H.forward[2];I[e]=gt;let _t=1-.45*r.lane*r.lane,vt=.062*t.shardSize*r.size*Tn[i]*v*Math.sqrt(he)*_t,J=e*vn;F[J]=ke,F[J+1]=G,F[J+2]=K,F[J+3]=vt>1e-5?vt:0,F[J+4]=st,F[J+5]=ct,F[J+6]=lt,F[J+7]=r.thickness,F[J+8]=ut,F[J+9]=dt,F[J+10]=ft,F[J+11]=r.tint;for(let e=0;e<10;e+=1)F[J+12+e]=r.shape[e];F[J+22]=r.sides,F[J+23]=r.flash}let x=0;for(let e=0;e<Z;e+=1)pe[e]=0,R[e]=0;if(t.markers>=0){let a=v.size[1]/Math.max(e.clientHeight,1),c=(V.pointer[0]-.5)*2*i,l=(.5-V.pointer[1])*2,u=t.mouseInteraction&&!r?V.presence:0,d=V.targets,f=new Map,p=1-Math.exp(-n/.12),y=``,b=72;for(let e=Z-1;e>=0;--e){R[e]=x;let n=X[e],r=.42*(n/Y)**.55,v=i*n/(Y*t.scale)*1.12+r,S=n/(Y*t.scale)*1.12+r,C=V.markerDrift,w=kn[e],ne=Math.floor((C-v)/r-w[0]),E=Math.ceil((C+v)/r-w[0]),D=Math.floor(-S/r-w[1]),O=Math.ceil(S/r-w[1]),ie=t.spread*(.15+.035*n)*1.4,ae=fe[e].position;for(let t=ne;t<=E;t+=1)for(let v=D;v<=O;v+=1){if(Zn(e,t,v,11)>.5)continue;let S=(t+w[0])*r-C,ne=(v+w[1])*r,E=Y-n,D=h(S,ne,E,_);if(Math.abs(_[0])>i*1.05||Math.abs(_[1])>1.05)continue;let O=1/0;for(let e=0;e<yn;e+=2){let t=S-ae[e*3],n=ne-ae[e*3+1],r=E-ae[e*3+2],i=t*t+n*n+r*r;i<O&&(O=i)}let k=Math.exp(-O/(ie*ie)),oe=Zn(e,t,v,23),se=Zn(e,t,v,37),A=oe<.07?.5+.5*Math.sin(V.clock*(1.4+se*2.2)+se*40):0,j=Math.hypot(_[0]-c,_[1]-l)*m/a,M=`${e}:${t}:${v}`;e<=2&&u>.01&&j<b&&(b=j,y=M);let N=M===V.markerTarget?u*(1-Kn((j-30)/42)):0,P=d.get(M)??0,ce=P+(N-P)*p;ce>.002&&f.set(M,ce);let F=Math.max(Kn((A-.55)/.4),ce),I=0;ee.length&&(I=g(_[0],_[1],e));let le=1;if(o){let t=$((_[0]/i+1)*.5,0,1);le=Kn((s-(e*.22+.35+t*(2.0999999999999996-(Z-1)*.22)))/.5)}let ue=En[e]*(1-Kn((D-3)/10)*.45)*le;if(ue<.002)continue;x>=te&&re(te*2);let L=x*On;T[L]=S,T[L+1]=ne,T[L+2]=E,T[L+3]=ue,T[L+4]=.42+.5*k+A*.9+ce*1.3+I*2.5,T[L+5]=F,T[L+6]=1+.15*k+.3*A+.2*ce,T[L+7]=0,x+=1,pe[e]+=1}}V.targets=f,V.markerTarget=y}V.markerTotal=x},xe=(t,n,i)=>{ve(t);let a=V.shards;le(a.length),be(t,n,i),V.order.length!==a.length&&(V.order=a.map((e,t)=>t));let o=V.order;for(let e=0;e<a.length;e+=1)I[e]+=a[e].level*100;for(let e=1;e<o.length;e+=1){let t=o[e],n=I[t],r=e-1;for(;r>=0&&I[o[r]]<n;)o[r+1]=o[r],--r;o[r+1]=t}let s=[0,0,0,0,0];for(let e=0;e<o.length;e+=1){let t=o[e]*vn,n=e*vn;s[a[o[e]].level]+=1;for(let e=0;e<vn;e+=1)ce[n+e]=F[t+e]}P?.write(ce.subarray(0,a.length*vn)),V.markerTotal>0&&w?.write(T.subarray(0,V.markerTotal*On));let c=[0,0,0,0,0],l=0;for(let e=Z-1;e>=0;--e)c[e]=l,l+=s[e];C.set({view:[v.size[0],v.size[1],H.focal,V.clock],eye:[H.eye[0],H.eye[1],H.eye[2],bn],forward:[H.forward[0],H.forward[1],H.forward[2],t.depthOfField*v.size[1]*.03],right:[H.right[0],H.right[1],H.right[2],v.size[1]*.05],up:[H.up[0],H.up[1],H.up[2],+!!t.lightMode],shard:[...t.shard,0],accent:[...t.accent,0],surface:t.material,marker:[t.markers,v.size[1]/Math.max(e.clientHeight,1),4*(v.size[1]/Math.max(e.clientHeight,1)),bn]}),ue.forEach(({downParams:e,horizontalParams:t,verticalParams:n,source:r,level:i})=>{e.set({texel:[.5/r.size[0],.5/r.size[1],.75,.5]}),t.set({texel:[1/i.main.size[0],0,0,0]}),n.set({texel:[0,1/i.main.size[1],0,0]})});let u=t.paper??[0,0,0],d=t.glow>.001&&!t.lightMode;L.set({info:[t.grain,Math.floor(V.clock*24),d?t.glow:0,1.3],paper:[u[0],u[1],u[2],+!!t.paper],mode:[+!!t.lightMode,t.vignette,0,0]});let f=t.depthOfField*v.size[1]*.012,p=v.size[1]*.02,m=X.map((n,r)=>{let i=Math.min(f*Math.abs(1-xn/n),p),a=+(i>=2.2),o=D[a],s=i>=.45;s&&!o.softReady&&(o.softReady=!0,o.temp.resize(E(o.scale)),o.blurred.resize(E(o.scale)));let c=o.layer.size;O[r].set({view:[c[0],c[1],H.focal*(c[0]/v.size[0]),r],look:[t.lightMode?.5:.7,0,0,0]});let l=i*o.scale;ie[r].set({texel:[1/c[0],0,l,0]}),ae[r].set({texel:[0,1/c[1],l,0]}),k[r].set({info:[En[r],0,0,0]});let u=Math.max(.6,1.4*(c[0]/Math.max(e.clientWidth,1))),d=t.material===_n.glass?0:t.lightMode?.32:.62;return oe[r].set({info:[u*.55,u*.85,d,0],more:[45e-5,0,0,0]}),{group:o,groupIndex:a,soft:s}});r(h,e=>{for(let t=Z-1;t>=0;--t){let{group:n,groupIndex:r,soft:i}=m[t],a=j[t][r];s[t]>0&&(e.pass({target:n.layer,clear:In,clearDepth:1},e=>{e.draw(se[t],{instances:s[t],firstInstance:c[t]}),e.draw(A[t],{instances:s[t],firstInstance:c[t]})}),e.pass({target:n.shaded,clear:In},e=>e.draw(a.shadow)),i&&(e.pass({target:n.temp,clear:In},e=>e.draw(a.blurX)),e.pass({target:n.blurred,clear:In},e=>e.draw(a.blurY)))),e.pass({target:b,clear:t===Z-1&&In},e=>{pe[t]>0&&e.draw(ne,{instances:pe[t],firstInstance:R[t]}),s[t]>0&&e.draw(i?a.soft:a.sharp)})}ue.forEach((t,n)=>{let r=S[n];d?(e.pass({target:r.main,clear:In},e=>e.draw(t.down)),e.pass({target:r.spare,clear:In},e=>e.draw(t.horizontal)),e.pass({target:r.main,clear:In},e=>e.draw(t.vertical))):e.pass({target:r.main,clear:In},()=>{})}),e.pass({target:v,clear:In},e=>e.draw(de))})},Se=e=>{if(p=requestAnimationFrame(Se),!V.visible||document.hidden){V.last=e;return}let t=N.current,n=V.last?Math.min((e-V.last)/1e3,.05):0;V.last=e;let r=Xn();V.clock+=n,V.introAt<0&&(V.introAt=V.clock),V.shards.length!==t.count&&(V.shards=er(t.count,1337),V.order=[]);let i=!t.paused&&!r;if(i){for(let e=0;e<Z;e+=1)V.travel[e]=(V.travel[e]+n*t.speed*.09/fe[e].length)%1;V.roll+=n*t.speed*1,V.twist+=n*t.speed*.08,V.drift+=n*t.speed}let a=gn.map((e,n)=>+(n===t.placement)),o=!1,s=Math.exp(-4*n);for(let e=0;e<4;e+=1){let t=V.weights[e]-a[e],r=V.weightVelocity[e]+4*t;V.weights[e]=a[e]+(t+r*n)*s,V.weightVelocity[e]=(V.weightVelocity[e]-4*r*n)*s,Math.abs(V.weights[e]-a[e])>5e-4&&(o=!0)}o||(V.weights=a,V.weightVelocity=[0,0,0,0]);let c=t.mouseInteraction&&V.inside&&!r;V.presence+=(+!!c-V.presence)*(1-Math.exp(-n/.25));let l=c?t.parallax:0,u=(V.pointer[0]-.5)*l*.14,d=(V.pointer[1]-.5)*l*.08;V.yawVelocity+=(38*(u-V.yaw)-11*V.yawVelocity)*n,V.pitchVelocity+=(38*(d-V.pitch)-11*V.pitchVelocity)*n,V.yaw+=V.yawVelocity*n,V.pitch+=V.pitchVelocity*n;let f=Math.abs(u-V.yaw)+Math.abs(d-V.pitch)>1e-4||Math.abs(V.yawVelocity)+Math.abs(V.pitchVelocity)>1e-4;if(V.pressAt>=0&&V.pressPoint&&t.holdToGather&&!r&&V.clock-V.pressAt>.18){if(!V.holding){V.holding=!0,ve(t),ye(V.pressPoint[0],V.pressPoint[1]);let e=bn/Math.max(U[0]*H.forward[0]+U[1]*H.forward[1]+U[2]*H.forward[2],.2);V.gatherCenter=[H.eye[0]+U[0]*e,H.eye[1]+U[1]*e,H.eye[2]+U[2]*e],V.reach=0}V.hold=Math.min(1,V.hold+n/.5),V.reach=Math.min(V.reach+n*.5,.55);let e=(.22+V.reach)/t.scale;for(let t of V.shards){if(t.joined||t.level>2)continue;let n=t.position[0]-V.gatherCenter[0],r=t.position[1]-V.gatherCenter[1];n*n+r*r<e*e&&(t.joined=!0)}}else if(V.hold>0&&(V.hold=Math.max(0,V.hold-n/.3),V.hold===0))for(let e of V.shards)e.joined=!1;for(let e of V.rings)e.age+=n;V.rings=V.rings.filter(e=>e.age<jn),i&&(V.markerDrift+=n*t.speed*.045);let m=V.shards.some(e=>e.flash>.01||Math.abs(e.tiltVelocity)>.01||Math.abs(e.tilt)>.01),ee=o||f||m||V.presence>.002||V.rings.length>0||V.hold>0||t.intro&&!r&&V.clock-V.introAt<3.9;V.seen!==t||ee||i?V.quiet=0:V.quiet+=1,V.seen=t,V.quiet>30||(_e(),xe(t,n,r))},Ce=t=>{let n=e.getBoundingClientRect();return{point:[(t.clientX-n.left)/Math.max(n.width,1),(t.clientY-n.top)/Math.max(n.height,1)],inside:t.clientX>=n.left&&t.clientX<=n.right&&t.clientY>=n.top&&t.clientY<=n.bottom}},we=e=>{let t=Ce(e);V.inside=t.inside,t.inside&&(V.pointer=t.point)},Te=()=>{V.inside=!1},W=e=>{let t=N.current;if(e.button!==0||Xn()||!t.mouseInteraction||e.target instanceof Element&&e.target.closest(`a, button, input, textarea, select, label, [role="button"], [role="slider"], [role="radio"], [role="tab"], [role="option"], [role="dialog"]`))return;let n=Ce(e);n.inside&&(V.pointer=n.point,V.pressAt=V.clock,V.pressPoint=n.point)},Ee=()=>{let e=N.current;if(!(V.pressAt<0)){if(!V.holding&&e.pulseOnClick&&V.pressPoint){let e=v.size[0]/Math.max(v.size[1],1);V.rings.push({x:(V.pressPoint[0]*2-1)*e,y:1-V.pressPoint[1]*2,age:0}),V.rings.length>An&&V.rings.shift()}if(V.holding)for(let e of V.shards)e.joined&&(e.tiltVelocity+=9*e.sign);V.pressAt=-1,V.holding=!1}};if(window.addEventListener(`pointermove`,we,{passive:!0}),window.addEventListener(`pointerdown`,W),window.addEventListener(`pointerup`,Ee),window.addEventListener(`pointercancel`,Ee),document.documentElement.addEventListener(`pointerleave`,Te),m.push(()=>{window.removeEventListener(`pointermove`,we),window.removeEventListener(`pointerdown`,W),window.removeEventListener(`pointerup`,Ee),window.removeEventListener(`pointercancel`,Ee),document.documentElement.removeEventListener(`pointerleave`,Te)}),typeof IntersectionObserver<`u`){let t=new IntersectionObserver(e=>{V.visible=e.some(e=>e.isIntersecting)});t.observe(e),m.push(()=>t.disconnect())}p=requestAnimationFrame(Se)})().catch(ee),()=>{n=!0,cancelAnimationFrame(p),m.forEach(e=>e()),f?.dispose(),t.remove()}},[]),(0,pn.jsx)(`div`,{ref:A,className:[mn,k].filter(Boolean).join(` `),style:oe})}export{tr as default};