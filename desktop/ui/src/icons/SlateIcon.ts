import { motion } from 'motion/react'
import { createElement, useEffect, useRef, useState } from 'react'
import { GLYPH_CATALOG, type GlyphName } from './glyphCatalog'

export type SlateIconProps = {
  size?: number
  strokeWidth?: number
  morphed?: boolean
  mode?: 'interactive' | 'state'
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
  'data-icon'?: string
}

const INTERACTIVE_HOST_SELECTOR = [
  'button',
  'a',
  '[role="button"]',
  '[role="option"]',
  '.chroma-card',
  '.diagnostic-row',
  '.telemetry-cell',
  '.assurance-strip',
  '.style-note',
  '.activity-row',
  '.setting-row',
].join(', ')

const MORPH_TRANSITION = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
}

const INSTANT_TRANSITION = {
  duration: 0,
}

function isReducedMotionActive(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true') {
    return true
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return false
}

export function SlateIcon({
  name,
  size = 16,
  strokeWidth = 1.85,
  morphed = false,
  mode = 'interactive',
  className,
  'aria-hidden': ariaHidden = true,
  'data-icon': dataIcon,
}: SlateIconProps & { name: GlyphName }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [engaged, setEngaged] = useState(false)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const host = (svgEl.closest(INTERACTIVE_HOST_SELECTOR) as HTMLElement | null) || svgEl

    const onEnter = () => setEngaged(true)
    const onLeave = () => {
      setEngaged(false)
      setPressed(false)
    }
    const onFocusIn = () => setEngaged(true)
    const onFocusOut = (event: Event) => {
      const related = (event as FocusEvent).relatedTarget as Node | null
      if (!host.contains(related)) {
        setEngaged(false)
      }
    }
    const onDown = () => setPressed(true)
    const onUp = () => setPressed(false)

    host.addEventListener('pointerenter', onEnter, { passive: true })
    host.addEventListener('pointerleave', onLeave, { passive: true })
    host.addEventListener('focusin', onFocusIn)
    host.addEventListener('focusout', onFocusOut)
    host.addEventListener('pointerdown', onDown, { passive: true })
    host.addEventListener('pointerup', onUp, { passive: true })
    host.addEventListener('pointercancel', onUp, { passive: true })

    return () => {
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('focusin', onFocusIn)
      host.removeEventListener('focusout', onFocusOut)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const reduced = isReducedMotionActive()
  const isMorphed = mode === 'state' ? Boolean(morphed) : Boolean(morphed || engaged)
  const transition = reduced ? INSTANT_TRANSITION : MORPH_TRANSITION
  const targetScale = reduced ? 1 : pressed ? 0.92 : engaged && mode === 'state' ? 1.05 : 1

  const specs = GLYPH_CATALOG[name]
  const classes = ['slate-icon', isMorphed ? 'slate-icon-morphed' : '', className || '']
    .filter(Boolean)
    .join(' ')

  const svgProps: Record<string, unknown> = {
    ref: svgRef,
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    className: classes,
    'aria-hidden': ariaHidden,
    'data-slate-glyph': dataIcon || name,
    'data-morphed': isMorphed ? 'true' : 'false',
    initial: false,
    animate: { scale: targetScale },
    transition,
  }

  return createElement(
    motion.svg,
    svgProps,
    specs.map((spec, index) => {
      const targetD = isMorphed ? spec.morph : spec.rest
      const targetOpacity = spec.opacity ? (isMorphed ? spec.opacity[1] : spec.opacity[0]) : 1
      return createElement(motion.path, {
        key: index,
        d: targetD,
        initial: false,
        animate: {
          d: targetD,
          opacity: targetOpacity,
        },
        transition,
        fill: spec.filled ? 'currentColor' : 'none',
        stroke: spec.filled ? 'none' : 'currentColor',
        strokeWidth: spec.filled ? undefined : (spec.strokeWidth ?? strokeWidth),
        strokeLinecap: spec.filled ? undefined : 'round',
        strokeLinejoin: spec.filled ? undefined : 'round',
      })
    }),
  )
}
