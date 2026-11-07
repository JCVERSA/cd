/**
 * Precision geometric SVG primitives for the SwiftSlate Morphing Icon System.
 * Built following kaankiziltug/logo-design-skill:
 * - Clean 24x24 coordinate grid (scalable to 256x256 master audit)
 * - Exact angles (0°, 30°, 45°, 60°, 90°), max 2-decimal precision
 * - Isomorphic cubic-Bézier topologies so State A <-> State B interpolate natively in motion/react
 */

const KAPPA = 0.55228475

export function n(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * 4-cubic closed circle: M top -> C right -> C bottom -> C left -> C top Z.
 * Topologically identical to `sparkleCubic` and `diamondCubic` (M + 4xC + Z)!
 */
export function circleCubic(cx: number, cy: number, r: number): string {
  const k = r * KAPPA
  return [
    `M ${n(cx)} ${n(cy - r)}`,
    `C ${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}`,
    `C ${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)}`,
    `C ${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}`,
    `C ${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)}`,
    'Z',
  ].join(' ')
}

/**
 * SwiftSlate signature 4-point concave sparkle with identical M + 4xC + Z topology as `circleCubic`.
 */
export function sparkleCubic(cx: number, cy: number, r: number, pinch = 0.18): string {
  const p = r * pinch
  return [
    `M ${n(cx)} ${n(cy - r)}`,
    `C ${n(cx + p)} ${n(cy - p)} ${n(cx + p)} ${n(cy - p)} ${n(cx + r)} ${n(cy)}`,
    `C ${n(cx + p)} ${n(cy + p)} ${n(cx + p)} ${n(cy + p)} ${n(cx)} ${n(cy + r)}`,
    `C ${n(cx - p)} ${n(cy + p)} ${n(cx - p)} ${n(cy + p)} ${n(cx - r)} ${n(cy)}`,
    `C ${n(cx - p)} ${n(cy - p)} ${n(cx - p)} ${n(cy - p)} ${n(cx)} ${n(cy - r)}`,
    'Z',
  ].join(' ')
}

/**
 * Rounded rectangle with continuous-curvature cubic corners (M + 4x(L + C) + Z).
 * Morphs cleanly between any two rounded rects, pills, or bars.
 */
export function roundedRectCubic(x: number, y: number, w: number, h: number, r: number): string {
  const rx = Math.min(r, w / 2)
  const ry = Math.min(r, h / 2)
  const kx = rx * 0.62
  const ky = ry * 0.62
  const x2 = x + w
  const y2 = y + h
  return [
    `M ${n(x + rx)} ${n(y)}`,
    `L ${n(x2 - rx)} ${n(y)}`,
    `C ${n(x2 - rx + kx)} ${n(y)} ${n(x2)} ${n(y + ry - ky)} ${n(x2)} ${n(y + ry)}`,
    `L ${n(x2)} ${n(y2 - ry)}`,
    `C ${n(x2)} ${n(y2 - ry + ky)} ${n(x2 - rx + kx)} ${n(y2)} ${n(x2 - rx)} ${n(y2)}`,
    `L ${n(x + rx)} ${n(y2)}`,
    `C ${n(x + rx - kx)} ${n(y2)} ${n(x)} ${n(y2 - ry + ky)} ${n(x)} ${n(y2 - ry)}`,
    `L ${n(x)} ${n(y + ry)}`,
    `C ${n(x)} ${n(y + ry - ky)} ${n(x + rx - kx)} ${n(y)} ${n(x + rx)} ${n(y)}`,
    'Z',
  ].join(' ')
}

/**
 * Circular arc approximated with exact cubic Bézier segments (`segments` fixed for morph isomorphism).
 * Angles in degrees: 0° = 3 o'clock, 90° = 6 o'clock, -90° = 12 o'clock.
 */
export function arcCubic(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  segments = 3,
): string {
  const totalRad = ((endDeg - startDeg) * Math.PI) / 180
  const step = totalRad / segments
  const startRad = (startDeg * Math.PI) / 180
  const alpha = (4 / 3) * Math.tan(step / 4)

  const x0 = cx + r * Math.cos(startRad)
  const y0 = cy + r * Math.sin(startRad)
  const parts = [`M ${n(x0)} ${n(y0)}`]

  for (let i = 0; i < segments; i += 1) {
    const a1 = startRad + i * step
    const a2 = a1 + step
    const cos1 = Math.cos(a1)
    const sin1 = Math.sin(a1)
    const cos2 = Math.cos(a2)
    const sin2 = Math.sin(a2)

    const p1x = cx + r * (cos1 - alpha * sin1)
    const p1y = cy + r * (sin1 + alpha * cos1)
    const p2x = cx + r * (cos2 + alpha * sin2)
    const p2y = cy + r * (sin2 - alpha * cos2)
    const x = cx + r * cos2
    const y = cy + r * sin2
    parts.push(`C ${n(p1x)} ${n(p1y)} ${n(p2x)} ${n(p2y)} ${n(x)} ${n(y)}`)
  }

  return parts.join(' ')
}

/**
 * Polyline helper with fixed point count: M p0 L p1 L p2 ... (closed optional).
 */
export function polyPath(points: ReadonlyArray<readonly [number, number]>, closed = false): string {
  const [first, ...rest] = points
  const base = [`M ${n(first[0])} ${n(first[1])}`, ...rest.map(([x, y]) => `L ${n(x)} ${n(y)}`)]
  if (closed) base.push('Z')
  return base.join(' ')
}

/**
 * Extracts the exact command-and-arity signature of an SVG `d` string so unit tests
 * guarantee 100% topological isomorphism between `rest` and `morph` paths.
 */
export function pathSignature(d: string): string {
  const tokens = d.trim().match(/[MLCZ]|-?\d+(?:\.\d+)?/gi) || []
  return tokens.map((tok) => (/^[MLCZ]$/i.test(tok) ? tok.toUpperCase() : '#')).join('')
}
