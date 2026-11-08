import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import './HoldButton.css'

export type HoldPhase = 'idle' | 'holding' | 'done'
export type HoldInputKind = 'pointer' | 'key' | null

export interface HoldButtonProps {
  children?: ReactNode
  doneLabel?: ReactNode
  icon?: ReactNode
  doneIcon?: ReactNode
  backgroundColor?: string
  fillColor?: string
  textColor?: string
  fillTextColor?: string
  size?: 'sm' | 'md' | 'lg'
  radius?: number
  fillDirection?: 'right' | 'up'
  holdTime?: number
  releaseTime?: number
  pressScale?: number
  wave?: boolean
  waveAmplitude?: number
  glow?: boolean
  resetAfter?: number
  disabled?: boolean
  onHold?: () => void
  onTap?: () => void
  className?: string
}

const TAP_MS = 250
const HIT_PAD = 10
const LINEAR = (t: number) => t
const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3)

export function HoldButton({
  children = 'Hold to delete',
  doneLabel = 'Deleted',
  icon = null,
  doneIcon = null,
  backgroundColor = '#27272a',
  fillColor = '#5227FF',
  textColor = '#f5f5f5',
  fillTextColor = '#ffffff',
  size = 'md',
  radius = 14,
  fillDirection = 'right',
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.97,
  wave = true,
  waveAmplitude = 6,
  glow = true,
  resetAfter = 1200,
  disabled = false,
  onHold,
  onTap,
  className = '',
}: HoldButtonProps) {
  const [phase, setPhase] = useState<HoldPhase>('idle')
  const [input, setInput] = useState<HoldInputKind>(null)
  const phaseRef = useRef<HoldPhase>('idle')
  const inputRef = useRef<HoldInputKind>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(true)
  const gesture = useRef<{ pointerId: number | null; start: number; rect: DOMRect | null }>({
    pointerId: null,
    start: 0,
    rect: null,
  })
  const timers = useRef<{ complete?: ReturnType<typeof setTimeout>; reset?: ReturnType<typeof setTimeout> }>({})
  const hintId = useId()

  const go = (next: HoldPhase, kind: HoldInputKind = null) => {
    phaseRef.current = next
    inputRef.current = kind
    if (!mountedRef.current) return
    setPhase(next)
    setInput(kind)
  }

  const clearTimers = () => {
    if (timers.current.complete) clearTimeout(timers.current.complete)
    if (timers.current.reset) clearTimeout(timers.current.reset)
  }

  const motionState = useRef({ raf: 0, p: 0, from: 0, to: 0, start: 0 })

  const complete = () => {
    if (phaseRef.current !== 'holding') return
    if (performance.now() - gesture.current.start < holdTime - 50) return
    clearTimers()
    go('done', inputRef.current)
    onHold?.()
    if (resetAfter > 0) {
      timers.current.reset = setTimeout(() => {
        if (!mountedRef.current) return
        go('idle')
        drive(0, releaseTime, EASE_OUT)
      }, resetAfter)
    }
  }

  const drive = (to: number, duration: number, ease: (t: number) => number) => {
    const m = motionState.current
    cancelAnimationFrame(m.raf)
    m.from = m.p
    m.to = to
    m.start = performance.now()
    const step = (now: number) => {
      if (!mountedRef.current) return
      const t = duration > 0 ? Math.min(1, (now - m.start) / duration) : 1
      m.p = m.from + (m.to - m.from) * ease(t)
      buttonRef.current?.style.setProperty('--hb-p', m.p.toFixed(4))
      if (t < 1) {
        m.raf = requestAnimationFrame(step)
        return
      }
      m.raf = 0
      if (m.to === 1) complete()
    }
    m.raf = requestAnimationFrame(step)
  }

  const begin = (kind: HoldInputKind) => {
    if (disabled || phaseRef.current !== 'idle') return false
    const button = buttonRef.current
    if (!button) return false
    gesture.current.start = performance.now()
    gesture.current.rect = button.getBoundingClientRect()
    go('holding', kind)
    drive(1, holdTime, LINEAR)
    timers.current.complete = setTimeout(complete, holdTime + 100)
    return true
  }

  const release = ({ drifted = false }: { drifted?: boolean } = {}) => {
    if (phaseRef.current !== 'holding') return
    clearTimers()
    const held = performance.now() - gesture.current.start
    go('idle')
    drive(0, releaseTime, EASE_OUT)
    if (!drifted && held < TAP_MS) onTap?.()
  }
  const releaseRef = useRef(release)
  releaseRef.current = release

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerId = e.pointerId ?? 0
    if (e.button !== 0 || (e.nativeEvent.isTrusted && !e.isPrimary) || gesture.current.pointerId !== null) return
    if (!begin('pointer')) return
    gesture.current.pointerId = pointerId
    try {
      e.currentTarget.setPointerCapture(pointerId)
    } catch {
      // Synthetic pointer events in tests may not support setPointerCapture
    }
  }

  const endPointer = (e: ReactPointerEvent<HTMLButtonElement>, options?: { drifted?: boolean }) => {
    const pointerId = e.pointerId ?? 0
    if (pointerId !== gesture.current.pointerId) return
    gesture.current.pointerId = null
    try {
      if (e.currentTarget.hasPointerCapture?.(pointerId)) {
        e.currentTarget.releasePointerCapture(pointerId)
      }
    } catch {
      // Ignore if not captured
    }
    release(options)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if ((e.pointerId ?? 0) !== gesture.current.pointerId) return
    const r = gesture.current.rect
    if (!r) return
    const hasBounds = r.width > 0 || r.height > 0
    const out = hasBounds
      ? e.clientX < r.left - HIT_PAD ||
        e.clientX > r.right + HIT_PAD ||
        e.clientY < r.top - HIT_PAD ||
        e.clientY > r.bottom + HIT_PAD
      : Math.abs(e.clientX) > 200 || Math.abs(e.clientY) > 200
    if (out) endPointer(e, { drifted: true })
  }

  const handlePointerLeave = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch') endPointer(e, { drifted: true })
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      if (inputRef.current === 'key') {
        e.stopPropagation()
        release({ drifted: true })
      }
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!e.repeat) begin('key')
    }
  }

  const handleKeyUp = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (inputRef.current === 'key') release()
    }
  }

  useLayoutEffect(() => {
    const button = buttonRef.current
    if (!button) return undefined
    const measure = () => {
      button.style.setProperty('--hb-w', `${button.offsetWidth}px`)
      button.style.setProperty('--hb-h', `${button.offsetHeight}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(button)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (phase !== 'holding') return undefined
    const cancel = () => releaseRef.current({ drifted: true })
    const onVisibility = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [phase])

  useEffect(() => {
    mountedRef.current = true
    const t = timers.current
    const m = motionState.current
    return () => {
      mountedRef.current = false
      if (t.complete) clearTimeout(t.complete)
      if (t.reset) clearTimeout(t.reset)
      cancelAnimationFrame(m.raf)
    }
  }, [])

  const direction = fillDirection === 'up' ? 'up' : 'right'
  const labels = (
    <>
      <span className="hold-button__idle" aria-hidden={phase === 'done'}>
        {icon ? <span className="hold-button__icon">{icon}</span> : null}
        {children}
      </span>
      <span className="hold-button__done" aria-hidden={phase !== 'done'}>
        {doneIcon ? <span className="hold-button__icon">{doneIcon}</span> : null}
        {doneLabel}
      </span>
    </>
  )

  const buttonStyle = {
    '--hb-radius': `${radius}px`,
    '--hb-bg': backgroundColor,
    '--hb-fill': fillColor,
    '--hb-text': textColor,
    '--hb-fill-text': fillTextColor,
    '--hb-hold': `${holdTime}ms`,
    '--hb-cycles': holdTime / 1100,
    '--hb-release': `${releaseTime}ms`,
    '--hb-press': pressScale,
    '--hb-wave': `${wave ? waveAmplitude : 0}px`,
  } as CSSProperties

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`hold-button hold-button--${size}${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-input={input ?? undefined}
      data-direction={direction}
      data-glow={glow ? 'true' : undefined}
      aria-describedby={hintId}
      style={buttonStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => endPointer(e)}
      onPointerCancel={(e) => endPointer(e, { drifted: true })}
      onLostPointerCapture={(e) => endPointer(e, { drifted: true })}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hold-button__pulse" aria-hidden="true" />
      <span className="hold-button__label">{labels}</span>
      <span className="hold-button__clip" aria-hidden="true">
        <span className="hold-button__fill">
          <span className="hold-button__label hold-button__label--fill">{labels}</span>
        </span>
        <span className="hold-button__crest" aria-hidden="true">
          <span className="hold-button__label hold-button__label--fill">{labels}</span>
        </span>
      </span>
      <span id={hintId} className="hold-button__sr" aria-hidden="true">
        Press and hold for {Math.round(holdTime / 100) / 10} seconds to confirm
      </span>
    </button>
  )
}

export default HoldButton
