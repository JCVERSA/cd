import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { ArrowRightIcon, CheckMarkIcon, SpinnerRingIcon } from '../icons'
import './SlideCommit.css'

export type SlideCommitPhase = 'idle' | 'pending' | 'done' | 'error'

export interface SlideCommitProps {
  label?: ReactNode
  doneLabel?: ReactNode
  errorLabel?: ReactNode
  onConfirm?: () => void | Promise<unknown>
  onDone?: () => void
  onError?: (reason: unknown) => void
  trackColor?: string
  handleColor?: string
  successColor?: string
  dangerColor?: string
  width?: number
  height?: number
  radius?: number
  speed?: number
  returnBounce?: number
  landingDip?: number
  holdMs?: number
  disabled?: boolean
  icon?: ReactNode
  className?: string
}

const PAD = 4
const SQUASH_MAX = 0.08
const SQUASH_DIV = 110
const SWELL = 1.03
const MIN_PENDING = 300
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]
const SHAKE = [0, -5, 5, -3, 3, -1, 0]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const resolveCssColor = (color: string): string => {
  const trimmed = color.trim()
  const varMatch = /^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\)/.exec(trimmed)
  if (!varMatch) return trimmed
  if (typeof document !== 'undefined') {
    const computed = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim()
    if (computed) return computed
  }
  return varMatch[2]?.trim() || '#d9c7ff'
}

const onColor = (inputColor: string) => {
  const hex = resolveCssColor(inputColor)
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? [...raw].map((ch) => ch + ch).join('') : raw.slice(0, 6)
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return '#111111'
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
  return yiq >= 128 ? '#111111' : '#ffffff'
}

const velocityOf = (hist: Array<[number, number]>) => {
  if (hist.length < 2) return 0
  const [t0, x0] = hist[0]
  const [t1, x1] = hist[hist.length - 1]
  return ((x1 - x0) / Math.max(1, t1 - t0)) * 1000
}

const finePointer = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)

type GripState = {
  id: number
  grab: number | null
  moved: boolean
  hist: Array<[number, number]>
}

export function SlideCommit({
  label = 'Slide to pay',
  doneLabel = 'Paid',
  errorLabel = 'Payment failed',
  onConfirm,
  onDone,
  onError,
  trackColor = '#262626',
  handleColor = '#f5f5f5',
  successColor = '#22c55e',
  dangerColor = '#e5484d',
  width = 280,
  height = 56,
  radius = 28,
  speed = 50,
  returnBounce = 0.38,
  landingDip = 0.026,
  holdMs = 1500,
  disabled = false,
  icon,
  className = '',
}: SlideCommitProps) {
  const osReduce = useReducedMotion()
  const [phase, setPhase] = useState<SlideCommitPhase>('idle')
  const [held, setHeld] = useState(false)
  const [hot, setHot] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const grip = useRef<GripState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const homeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const run = useRef(0)
  const unwatch = useRef<(() => void) | null>(null)
  const live = useRef<{ move: (e: PointerEvent) => void; up: (e: { pointerId?: number }) => void }>({
    move: () => undefined,
    up: () => undefined,
  })
  const lastPercent = useRef(0)

  const isReduced = () =>
    Boolean(osReduce || trackRef.current?.closest('[data-reduced-motion="true"]'))

  const GRIP = height - PAD * 2
  const INNER = width - PAD * 2
  const TRAVEL = Math.max(1, INNER - GRIP)
  const r = clamp(radius, 0, height / 2)
  const gripR = Math.max(0, r - PAD)
  const k = 260 + (clamp(speed, 0, 100) / 100) * 640
  const mass = 0.9
  const critical = 2 * Math.sqrt(k * mass)
  const commitSpring = { type: 'spring' as const, stiffness: k, damping: critical, mass }
  const homeSpring = { ...commitSpring, damping: critical * (1 - clamp(returnBounce, 0, 0.5)) }

  const x = useMotionValue(0)
  const anchor = useMotionValue(0)
  const shown = useMotionValue(1)
  const spin = useMotionValue(0)
  const pulse = useMotionValue(1)
  const shake = useMotionValue(0)
  const seen = useTransform(x, (v) => clamp(v, 0, TRAVEL))
  const edge = useTransform([seen, anchor], ([v, a]: number[]) => v + GRIP + clamp(a - v, 0, TRAVEL))
  const clip = useTransform(edge, (R) => `inset(0 ${INNER - R}px 0 0 round ${gripR}px)`)
  const content = useTransform([seen, edge], ([v, R]: number[]) => `translateX(${(v + R) / 2 - INNER / 2}px)`)
  const swell = hot && !held && phase === 'idle' && !osReduce ? SWELL : 1
  const shape = useTransform(x, (v) => {
    const q = 1 - Math.min(SQUASH_MAX, Math.max(0, -v) / SQUASH_DIV)
    return `scale(${q * swell}, ${swell / q})`
  })
  const origin = useTransform(seen, (v) => `${v}px 50%`)
  const say = useTransform(seen, [0, TRAVEL * 0.55], [1, 0])
  const arrow = useTransform([seen, shown], ([v, on]: number[]) => on * clamp(1 - (v - TRAVEL * 0.55) / (TRAVEL * 0.4), 0, 1))
  const trackTransform = useTransform([shake, pulse], ([s, p]: number[]) => `translateX(${s}px) scale(${p})`)

  const labelText = typeof label === 'string' ? label : 'Slide to confirm'
  useMotionValueEvent(x, 'change', (rawV) => {
    const v = clamp(rawV, 0, TRAVEL)
    const percent = Math.round((v / TRAVEL) * 100)
    if (percent === lastPercent.current || !capsuleRef.current) return
    lastPercent.current = percent
    capsuleRef.current.setAttribute('aria-valuenow', String(percent))
    capsuleRef.current.setAttribute('aria-valuetext', `${labelText}, ${percent}%`)
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timer.current) clearTimeout(timer.current)
      if (homeTimer.current) clearTimeout(homeTimer.current)
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      unwatch.current?.()
      run.current += 1
    }
  }, [])

  const local = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return (clientX - rect.left) / (rect.width / width || 1)
  }

  const goHome = (velocity: number) => {
    if (isReduced()) animate(x, 0, { duration: 0.2, ease: EASE_OUT })
    else animate(x, 0, { ...homeSpring, velocity: Math.min(0, velocity) })
  }

  const settle = () => {
    if (!mountedRef.current) return
    setPhase('idle')
    animate(shown, 1, { duration: 0.2, delay: 0.12 })
    if (isReduced()) anchor.set(0)
    else animate(anchor, 0, { type: 'spring', duration: 0.3, bounce: 0 })
  }

  const resolve = (viaKey: boolean) => {
    if (!mountedRef.current) return
    setPhase('done')
    anchor.set(x.get())
    animate(spin, 0, { duration: 0.12 })
    if (isReduced()) x.set(0)
    else {
      animate(x, 0, commitSpring)
      if (!viaKey && landingDip > 0) {
        animate(pulse, [1, 1 - landingDip, 1], { duration: 0.46, times: [0, 0.62, 1], ease: EASE_OUT, delay: 0.1 })
      }
    }
    onDone?.()
    if (holdMs > 0) timer.current = setTimeout(settle, holdMs)
  }

  const reject = (reason: unknown) => {
    if (!mountedRef.current) return
    setPhase('error')
    onError?.(reason)
    animate(spin, 0, { duration: 0.12 })
    animate(shown, 1, { duration: 0.2, delay: 0.12 })
    if (isReduced()) goHome(0)
    else {
      animate(shake, SHAKE, { duration: 0.45, ease: EASE_OUT })
      homeTimer.current = setTimeout(() => {
        if (mountedRef.current && !grip.current) goHome(0)
      }, 300)
    }
    timer.current = setTimeout(() => {
      if (mountedRef.current) setPhase('idle')
    }, Math.max(holdMs, 1500))
  }

  const commit = (viaKey: boolean) => {
    if (timer.current) clearTimeout(timer.current)
    const id = ++run.current
    x.set(TRAVEL)
    let out: unknown
    try {
      out = onConfirm?.()
    } catch (reason) {
      reject(reason)
      return
    }
    const isThenable = (val: unknown): val is PromiseLike<unknown> =>
      Boolean(val && typeof (val as PromiseLike<unknown>).then === 'function')

    if (!isThenable(out)) {
      animate(shown, 0, { duration: 0.12 })
      resolve(viaKey)
      return
    }
    setPhase('pending')
    animate(shown, 0, { duration: 0.2 })
    animate(spin, 1, { duration: 0.2 })
    const t0 = performance.now()
    const later = (fn: () => void) => {
      pendingTimer.current = setTimeout(
        () => {
          if (mountedRef.current && id === run.current) fn()
        },
        Math.max(0, MIN_PENDING - (performance.now() - t0)),
      )
    }
    out.then(
      () => later(() => resolve(viaKey)),
      (reason: unknown) => later(() => reject(reason)),
    )
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || grip.current || phase === 'pending' || phase === 'done' || e.button !== 0) return
    const pointerId = e.pointerId ?? 0
    x.stop()
    grip.current = { id: pointerId, grab: null, moved: false, hist: [] }
    setHeld(true)
    try {
      trackRef.current?.setPointerCapture(pointerId)
    } catch {
      // Synthetic pointer events in tests may not support setPointerCapture
    }
    unwatch.current?.()
    const onMove = (ev: PointerEvent) => live.current.move(ev)
    const onUp = (ev: PointerEvent) => live.current.up(ev)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    unwatch.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      unwatch.current = null
    }
  }

  const move = (e: PointerEvent) => {
    const g = grip.current
    if (!g || g.id !== (e.pointerId ?? 0)) return
    const at = local(e.clientX)
    if (g.grab === null) {
      g.grab = at - x.get()
      return
    }
    const next = clamp(at - g.grab, 0, TRAVEL)
    if (Math.abs(next - x.get()) > 0.5) g.moved = true
    g.hist.push([e.timeStamp, next])
    if (g.hist.length > 4) g.hist.shift()
    x.set(next)
  }

  const up = (e: { pointerId?: number }) => {
    const g = grip.current
    const pointerId = e.pointerId ?? 0
    if (!g || g.id !== pointerId) return
    grip.current = null
    unwatch.current?.()
    try {
      trackRef.current?.releasePointerCapture(pointerId)
    } catch {
      // Ignore if not captured
    }
    setHeld(false)
    if (x.get() >= TRAVEL) commit(false)
    else if (g.moved) goHome(velocityOf(g.hist))
  }
  live.current = { move, up }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled || phase === 'pending' || phase === 'done') return
    const step = TRAVEL / 10
    if (e.key === 'End') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(TRAVEL, x.get() + step)
      x.set(next)
      if (next >= TRAVEL) commit(true)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      x.set(Math.max(0, x.get() - step))
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault()
      if (e.key === 'Escape') e.stopPropagation()
      if (grip.current) up({ pointerId: grip.current.id })
      else x.set(0)
    }
  }

  const fontSize = clamp(Math.round(height * 0.28), 12, 16)
  const iconSize = Math.round(GRIP * 0.42)
  const done = phase === 'done'

  const rootStyle = {
    width,
    height,
    '--sc-track': trackColor,
    '--sc-ink': handleColor,
    '--sc-ok': successColor,
    '--sc-no': dangerColor,
    '--sc-on-ink': onColor(handleColor),
    '--sc-on-ok': onColor(successColor),
    '--sc-on-no': onColor(dangerColor),
    '--sc-radius': `${r}px`,
    '--sc-grip-r': `${gripR}px`,
    '--sc-pad': `${PAD}px`,
    '--sc-font': `${fontSize}px`,
  } as CSSProperties

  return (
    <div
      className={`slide-commit${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-held={held ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      style={rootStyle}
    >
      <motion.div
        ref={trackRef}
        className="slide-commit__track"
        style={{ transform: trackTransform }}
        onPointerDown={down}
      >
        <motion.span className="slide-commit__label" style={{ opacity: say }} aria-hidden="true">
          <span className="slide-commit__text slide-commit__text--plain">{label}</span>
          <span className="slide-commit__text slide-commit__text--error">{errorLabel}</span>
        </motion.span>
        <motion.div
          ref={capsuleRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={labelText}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-valuetext={`${labelText}, 0%`}
          aria-busy={phase === 'pending' || undefined}
          aria-disabled={disabled || undefined}
          className="slide-commit__capsule"
          style={{ clipPath: clip, transform: shape, transformOrigin: origin }}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse' && finePointer()) setHot(true)
          }}
          onPointerLeave={() => setHot(false)}
          onKeyDown={onKeyDown}
        >
          <motion.div className="slide-commit__content" style={{ transform: content }}>
            <motion.span className="slide-commit__arrow" style={{ opacity: arrow }} aria-hidden="true">
              {icon ?? <ArrowRightIcon size={iconSize} strokeWidth={2} aria-hidden="true" />}
            </motion.span>
            <motion.span className="slide-commit__spin" style={{ opacity: spin }} aria-hidden="true">
              <SpinnerRingIcon size={iconSize} strokeWidth={2.2} className="slide-commit__spinner" aria-hidden="true" />
            </motion.span>
            <motion.span
              className="slide-commit__done"
              aria-hidden="true"
              initial={false}
              animate={{ opacity: done ? 1 : 0, scale: done || osReduce ? 1 : 0.95 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <CheckMarkIcon size={Math.round(GRIP * 0.38)} strokeWidth={2.3} aria-hidden="true" />
              {doneLabel}
            </motion.span>
          </motion.div>
        </motion.div>
        <span className="slide-commit__sr" aria-live="polite">
          {phase === 'pending' ? 'Working' : phase === 'done' ? doneLabel : phase === 'error' ? errorLabel : ''}
        </span>
      </motion.div>
    </div>
  )
}

export default SlideCommit
