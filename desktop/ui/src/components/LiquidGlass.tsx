import { useEffect, useRef } from 'react'
import type { ThemeId } from '../types'
import './LiquidGlass.css'

/**
 * LiquidGlass — WebGL SDF refractive bevel + top-biased directional specular rim
 * + fingertip pressed-glass caustic lens shader adapted from
 * Na2H2P2O7/liquid-glass-skill (assets/glass.js) for SwiftSlate's live GPU
 * <ThemeBackground /> stage.
 *
 * Unlike a static-wallpaper app where glass.js fills the viewport with an opaque
 * texture, SwiftSlate renders 5 live WebGPU/WebGL2 backgrounds behind .app, so
 * this pass outputs premultiplied-alpha lens bevel caustics + directional rims
 * strictly over [data-glass] surfaces while CSS backdrop-filter blurs the live
 * 60fps shader canvas underneath, parking at 0% CPU when pointer/scroll settles.
 */

const MAX_PANELS = 16
const EDGE_PX = 26
const PRESS_SIGMA = 50
const PRESS_BASE = 0.42
const PRESS_BOOST = 0.34

const THEME_DISPERSION: Record<ThemeId, [number, number, number]> = {
  lavender: [0.82, 0.66, 1.0],
  amber: [1.0, 0.78, 0.38],
  sapphire: [0.48, 0.82, 1.0],
  emerald: [0.42, 0.96, 0.76],
  rose: [1.0, 0.54, 0.78],
}

const VERT_SRC = [
  'attribute vec2 aPos;',
  'void main() {',
  '  gl_Position = vec4(aPos, 0.0, 1.0);',
  '}',
].join('\n')

const FRAG_SRC = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform vec2 uViewport;',
  'uniform float uDpr;',
  'uniform vec3 uAccent;',
  'uniform float uIntensity;',
  'uniform vec3 uPointer;',
  `uniform vec4 uPanels[${MAX_PANELS}];`,
  `uniform vec4 uPanelAux[${MAX_PANELS}];`,
  'uniform int uPanelCount;',
  '',
  'float sdRoundRect(vec2 p, vec2 halfSize, float r) {',
  '  vec2 q = abs(p) - (halfSize - vec2(r));',
  '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
  '}',
  '',
  'float dither(vec2 p) {',
  '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;',
  '}',
  '',
  'void main() {',
  '  vec2 fragPx = gl_FragCoord.xy;',
  '  vec2 cssPos = vec2(fragPx.x, uViewport.y * uDpr - fragPx.y) / uDpr;',
  '',
  '  vec2 pressDisp = vec2(0.0);',
  '  float pressGlow = 0.0;',
  '  if (uPointer.z > 0.001) {',
  '    vec2 pv = cssPos - uPointer.xy;',
  `    float g = exp(-dot(pv, pv) / (2.0 * ${PRESS_SIGMA.toFixed(1)} * ${PRESS_SIGMA.toFixed(1)}));`,
  '    pressDisp = pv * (0.28 * g * uPointer.z);',
  '    pressGlow = g * uPointer.z;',
  '  }',
  '',
  '  vec3 col = vec3(0.0);',
  '  float alpha = 0.0;',
  '',
  `  for (int i = 0; i < ${MAX_PANELS}; i++) {`,
  '    if (i >= uPanelCount) break;',
  '    vec4 b = uPanels[i];',
  '    vec4 a = uPanelAux[i];',
  '    vec2 halfSize = b.zw;',
  '    float radius = min(a.x, min(halfSize.x, halfSize.y));',
  '    float highlight = a.y;',
  '    float strength = a.z;',
  '',
  '    vec2 p = (cssPos + pressDisp * 0.35) - b.xy;',
  '    if (abs(p.x) > halfSize.x + 3.0 || abs(p.y) > halfSize.y + 3.0) continue;',
  '',
  '    float sd = sdRoundRect(p, halfSize, radius);',
  '    if (sd > 1.2) continue;',
  '',
  '    float mask = smoothstep(0.85, -0.85, sd);',
  `    float inner = clamp(-sd / ${EDGE_PX.toFixed(1)}, 0.0, 1.0);`,
  '    float bevel = (1.0 - inner) * (1.0 - inner);',
  '',
  '    float topBias = 0.5 + 0.5 * clamp(-p.y / max(halfSize.y, 1.0), -1.0, 1.0);',
  '    float sideBias = abs(p.x) / max(halfSize.x, 1.0);',
  '',
  '    float rim = smoothstep(-2.4, -0.55, sd) * smoothstep(0.85, -0.18, sd);',
  '    float rimAmt = rim * (0.22 + 0.24 * highlight) * (0.38 + 0.62 * topBias);',
  '',
  '    float caustic = bevel * strength * (0.14 + 0.16 * highlight) * (0.45 + 0.55 * max(topBias, sideBias * 0.65));',
  '    float finger = mask * pressGlow * (0.11 + 0.18 * bevel);',
  '',
  '    vec3 prism = mix(vec3(1.0), uAccent, 0.42 + 0.28 * sideBias);',
  '    vec3 localCol = vec3(0.98, 0.99, 1.0) * rimAmt + prism * (caustic + finger);',
  '    float localA = clamp((rimAmt * 0.92 + caustic * 0.78 + finger * 0.85) * uIntensity, 0.0, 0.55);',
  '',
  '    col = max(col, localCol * uIntensity);',
  '    alpha = max(alpha, localA);',
  '  }',
  '',
  '  if (alpha <= 0.001) {',
  '    gl_FragColor = vec4(0.0);',
  '    return;',
  '  }',
  '',
  '  col += dither(fragPx) / 255.0;',
  '  col = clamp(col, 0.0, 1.0);',
  '  gl_FragColor = vec4(col * alpha, alpha);',
  '}',
].join('\n')

interface PanelEntry {
  el: HTMLElement
  radius: number
  strength: number
  highlight: number
  priority: number
}

export interface LiquidGlassProps {
  theme: ThemeId
  intensity?: number
  hidden?: boolean
  reducedMotion?: boolean
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function parseRadius(el: HTMLElement): number {
  const raw = getComputedStyle(el).borderTopLeftRadius
  const n = parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 16
}

export function LiquidGlass({
  theme,
  intensity = 0.92,
  hidden = false,
  reducedMotion = false,
}: LiquidGlassProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ theme, intensity, hidden, reducedMotion })
  propsRef.current = { theme, intensity, hidden, reducedMotion }
  const wakeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    wakeRef.current?.()
  }, [theme, intensity, hidden, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let gl: WebGLRenderingContext | null = null
    try {
      gl = (canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
      }) ||
        canvas.getContext('experimental-webgl', {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
        })) as WebGLRenderingContext | null
    } catch {
      gl = null
    }

    if (!gl) {
      document.body.classList.add('no-webgl')
      return undefined
    }

    const maxUniforms = Number(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0)
    if (maxUniforms > 0 && maxUniforms < 48) {
      document.body.classList.add('no-webgl')
      return undefined
    }
    document.body.classList.remove('no-webgl')

    let prog: WebGLProgram | null = null
    let quadBuf: WebGLBuffer | null = null
    let loc: {
      uViewport: WebGLUniformLocation | null
      uDpr: WebGLUniformLocation | null
      uAccent: WebGLUniformLocation | null
      uIntensity: WebGLUniformLocation | null
      uPointer: WebGLUniformLocation | null
      uPanels: WebGLUniformLocation | null
      uPanelAux: WebGLUniformLocation | null
      uPanelCount: WebGLUniformLocation | null
    } | null = null

    const initPipeline = () => {
      if (!gl) return false
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
      if (!vs || !fs) return false
      const p = gl.createProgram()
      if (!p) return false
      gl.attachShader(p, vs)
      gl.attachShader(p, fs)
      gl.linkProgram(p)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        gl.deleteProgram(p)
        return false
      }
      prog = p
      gl.useProgram(prog)

      quadBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const aPos = gl.getAttribLocation(prog, 'aPos')
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

      loc = {
        uViewport: gl.getUniformLocation(prog, 'uViewport'),
        uDpr: gl.getUniformLocation(prog, 'uDpr'),
        uAccent: gl.getUniformLocation(prog, 'uAccent'),
        uIntensity: gl.getUniformLocation(prog, 'uIntensity'),
        uPointer: gl.getUniformLocation(prog, 'uPointer'),
        uPanels: gl.getUniformLocation(prog, 'uPanels[0]'),
        uPanelAux: gl.getUniformLocation(prog, 'uPanelAux[0]'),
        uPanelCount: gl.getUniformLocation(prog, 'uPanelCount'),
      }
      return true
    }

    if (!initPipeline()) {
      document.body.classList.add('no-webgl')
      return undefined
    }

    const panelData = new Float32Array(MAX_PANELS * 4)
    const panelAux = new Float32Array(MAX_PANELS * 4)
    const entries = new Map<HTMLElement, PanelEntry>()
    let hotEl: HTMLElement | null = null
    let dpr = 1
    let rafId = 0
    let dirtyUntil = 0
    let lastNow = performance.now()
    let contextLost = false
    const pointer = { x: 0, y: 0, target: 0, strength: 0, down: false }

    const syncViewport = () => {
      if (!gl || contextLost) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(window.innerWidth * dpr))
      const h = Math.max(1, Math.round(window.innerHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
    }

    const scanDom = () => {
      const found = Array.from(document.querySelectorAll<HTMLElement>('[data-glass]'))
      const seen = new Set<HTMLElement>()
      for (const el of found) {
        seen.add(el)
        const existing = entries.get(el)
        const rawStrength = parseFloat(el.dataset.glassStrength || '')
        const strength = Number.isFinite(rawStrength) ? rawStrength : 0.36
        const priority = el.classList.contains('modal-panel')
          ? 3
          : el.classList.contains('backdrop-peek-pill') || el.classList.contains('topbar') || el.classList.contains('sidebar')
            ? 2
            : 1
        if (existing) {
          existing.radius = parseRadius(el)
          existing.strength = strength
          existing.priority = priority
        } else {
          entries.set(el, {
            el,
            radius: parseRadius(el),
            strength,
            highlight: 0,
            priority,
          })
        }
      }
      for (const key of entries.keys()) {
        if (!seen.has(key)) entries.delete(key)
      }
    }

    const renderFrame = (now: number) => {
      rafId = 0
      if (!gl || !prog || !loc || contextLost || document.hidden) return
      const { theme: activeTheme, intensity: activeIntensity, hidden: isHidden, reducedMotion: isReduced } = propsRef.current
      if (isHidden || isReduced) {
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return
      }

      const dt = Math.min(64, Math.max(1, now - lastNow))
      lastNow = now

      const kPtr = 1 - Math.exp(-dt / 70)
      pointer.strength += (pointer.target - pointer.strength) * kPtr

      const kHi = 1 - Math.exp(-dt / 150)
      let stillAnimating = Math.abs(pointer.strength - pointer.target) > 0.004

      const vw = window.innerWidth
      const vh = window.innerHeight
      const visible: Array<{ entry: PanelEntry; rect: DOMRect }> = []

      for (const entry of entries.values()) {
        const target = entry.el === hotEl ? 1 : 0
        entry.highlight += (target - entry.highlight) * kHi
        if (Math.abs(entry.highlight - target) > 0.004) stillAnimating = true

        const rect = entry.el.getBoundingClientRect()
        if (rect.width < 2 || rect.height < 2) continue
        if (rect.bottom < -4 || rect.top > vh + 4 || rect.right < -4 || rect.left > vw + 4) continue
        visible.push({ entry, rect })
      }

      visible.sort((a, b) => b.entry.priority - a.entry.priority)
      const count = Math.min(visible.length, MAX_PANELS)

      for (let i = 0; i < count; i++) {
        const { entry, rect } = visible[i]
        const base = i * 4
        panelData[base] = rect.left + rect.width * 0.5
        panelData[base + 1] = rect.top + rect.height * 0.5
        panelData[base + 2] = rect.width * 0.5
        panelData[base + 3] = rect.height * 0.5
        panelAux[base] = entry.radius
        panelAux[base + 1] = entry.highlight
        panelAux[base + 2] = entry.strength
        panelAux[base + 3] = 0
      }

      const accent = THEME_DISPERSION[activeTheme] ?? THEME_DISPERSION.lavender
      gl.useProgram(prog)
      gl.uniform2f(loc.uViewport, vw, vh)
      gl.uniform1f(loc.uDpr, dpr)
      gl.uniform3f(loc.uAccent, accent[0], accent[1], accent[2])
      gl.uniform1f(loc.uIntensity, Math.max(0.15, Math.min(1.25, activeIntensity)))
      gl.uniform3f(loc.uPointer, pointer.x, pointer.y, pointer.strength)
      gl.uniform4fv(loc.uPanels, panelData)
      gl.uniform4fv(loc.uPanelAux, panelAux)
      gl.uniform1i(loc.uPanelCount, count)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      if (stillAnimating || now < dirtyUntil) {
        rafId = requestAnimationFrame(renderFrame)
      }
    }

    const markDirty = (holdMs = 120) => {
      if (document.hidden || contextLost) return
      const now = performance.now()
      dirtyUntil = Math.max(dirtyUntil, now + holdMs)
      if (!rafId) {
        lastNow = now
        rafId = requestAnimationFrame(renderFrame)
      }
    }

    wakeRef.current = () => {
      scanDom()
      syncViewport()
      markDirty(260)
    }

    syncViewport()
    scanDom()
    markDirty(260)

    const onResize = () => {
      syncViewport()
      scanDom()
      markDirty(220)
    }
    const onScroll = () => markDirty(140)
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.target = PRESS_BASE + (pointer.down ? PRESS_BOOST : 0)
      const targetEl = e.target instanceof Element ? (e.target.closest('[data-glass-hot]') as HTMLElement | null) : null
      if (targetEl !== hotEl) {
        hotEl = targetEl
      }
      markDirty(180)
    }
    const onPointerDown = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.down = true
      pointer.target = PRESS_BASE + PRESS_BOOST
      markDirty(240)
    }
    const onPointerUp = () => {
      pointer.down = false
      pointer.target = pointer.strength > 0.02 ? PRESS_BASE : 0
      markDirty(240)
    }
    const onPointerLeave = () => {
      pointer.down = false
      pointer.target = 0
      hotEl = null
      markDirty(320)
    }
    const onVisibility = () => {
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId)
          rafId = 0
        }
      } else {
        scanDom()
        syncViewport()
        markDirty(220)
      }
    }
    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }
    const onContextRestored = () => {
      contextLost = false
      if (initPipeline()) {
        syncViewport()
        scanDom()
        markDirty(300)
      }
    }

    let scanQueued = false
    const observer = new MutationObserver(() => {
      if (scanQueued) return
      scanQueued = true
      requestAnimationFrame(() => {
        scanQueued = false
        scanDom()
        markDirty(240)
      })
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-glass', 'data-glass-strength', 'class', 'data-panels-hidden'],
    })

    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })
    document.documentElement.addEventListener('mouseleave', onPointerLeave, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    return () => {
      wakeRef.current = null
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.documentElement.removeEventListener('mouseleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (gl && !contextLost) {
        if (quadBuf) gl.deleteBuffer(quadBuf)
        if (prog) gl.deleteProgram(prog)
      }
    }
  }, [])

  return <canvas ref={canvasRef} className="liquid-glass-canvas" aria-hidden="true" />
}

export default LiquidGlass
