import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, PropsWithChildren, ReactNode } from 'react'
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckMarkIcon,
  ChevronMorphIcon,
  CloseXIcon,
  EyeToggleIcon,
  KeyVaultIcon,
  SearchIcon,
  SpinnerRingIcon,
} from '../icons'

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1]

export function cn(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ')
}

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.12, ease: EASE_OUT }}
      className={cn('button', `button-${variant}`, `button-${size}`, className)}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <SpinnerRingIcon size={16} strokeWidth={1.85} className="spin" aria-hidden="true" /> : icon}
      {children}
    </motion.button>
  )
}

export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn('switch', checked && 'switch-on')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }>) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}

export function SpotlightCard({
  children,
  className,
  delay = 0,
  interactive = false,
}: PropsWithChildren<{ className?: string; delay?: number; interactive?: boolean }>) {
  const x = useMotionValue(-200)
  const y = useMotionValue(-200)
  const rectRef = useRef<DOMRect | null>(null)
  const background = useMotionTemplate`radial-gradient(340px circle at ${x}px ${y}px, color-mix(in srgb, var(--accent) 12%, transparent), transparent 76%)`
  const reduce = useReducedMotion()

  if (!interactive) {
    return <div className={cn('glass-card', className)}>{children}</div>
  }

  function handleEnter(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse') {
      rectRef.current = event.currentTarget.getBoundingClientRect()
    }
  }

  function handleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return
    const rect = rectRef.current ?? event.currentTarget.getBoundingClientRect()
    rectRef.current = rect
    x.set(event.clientX - rect.left)
    y.set(event.clientY - rect.top)
  }

  return (
    <motion.div
      className={cn('glass-card spotlight-card', className)}
      style={reduce ? undefined : { backgroundImage: background }}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={() => {
        rectRef.current = null
        x.set(-200)
        y.set(-200)
      }}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT, delay: Math.min(delay, 0.14) }}
    >
      {children}
    </motion.div>
  )
}

type ModalProps = PropsWithChildren<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}>

export function Modal({ open, onClose, title, description, footer, children, size = 'md' }: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    const focusFirst = window.requestAnimationFrame(() => {
      const preferred = panel?.querySelector<HTMLElement>('[data-autofocus], [autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [data-select-trigger]:not([disabled])')
      const first = panel?.querySelector<HTMLElement>(focusableSelector)
      ;(preferred || first || panel)?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFirst)
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.11, ease: EASE_OUT } }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={cn('modal-panel', `modal-${size}`)}
            initial={{ opacity: 0, scale: 0.965, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: 0.985, y: 4, transition: { duration: 0.11, ease: EASE_OUT } }}
          >
            <header className="modal-header">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description ? <p id={descriptionId}>{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} icon={<CloseXIcon size={17} strokeWidth={1.85} aria-hidden="true" />} />
            </header>
            <div className="modal-body">{children}</div>
            {footer ? <footer className="modal-footer">{footer}</footer> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export type ToastItem = { id: number; message: string; tone?: 'success' | 'danger' | 'neutral' }

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <motion.div
            key={toast.id}
            className={cn('toast', `toast-${toast.tone || 'neutral'}`)}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.12, ease: EASE_OUT } }}
          >
            {toast.tone === 'success' ? <CheckCircleIcon size={16} strokeWidth={1.85} aria-hidden="true" /> : null}
            {toast.tone === 'danger' ? <AlertCircleIcon size={16} strokeWidth={1.85} aria-hidden="true" /> : null}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton', className)} aria-hidden="true" />
}

export function Field({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function SecretInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="secret-input-wrap">
      <KeyVaultIcon size={16} strokeWidth={1.85} aria-hidden="true" />
      <input
        id={id}
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="secret-visibility-toggle"
        aria-label={revealed ? 'Hide API key' : 'Show API key'}
        aria-pressed={revealed}
        onClick={() => setRevealed((current) => !current)}
      >
        <EyeToggleIcon size={15} strokeWidth={1.85} morphed={revealed} aria-hidden="true" />
      </button>
    </div>
  )
}

export type SelectOption<T extends string = string> = {
  value: T
  label: string
  detail?: string
  mono?: boolean
}

type SelectPopoverPosition = {
  top?: number
  bottom?: number
  left: number
  minWidth: number
  maxWidth: number
  maxHeight: number
  placement: 'bottom' | 'top'
}

type SelectProps<T extends string = string> = {
  id?: string
  label: string
  value: T
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  searchableThreshold?: number
}

const MAX_RENDERED_OPTIONS = 150

export function Select<T extends string = string>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  size = 'md',
  className,
  searchableThreshold = 8,
}: SelectProps<T>) {
  const listboxId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  const glidePillRef = useRef<HTMLSpanElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const instantGlideRef = useRef(true)
  const [open, setOpen] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<SelectPopoverPosition>({
    top: 0,
    left: 0,
    minWidth: 220,
    maxWidth: 360,
    maxHeight: 280,
    placement: 'bottom',
  })

  const isSearchable = options.length > searchableThreshold
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) =>
      `${option.label} ${option.detail || ''} ${option.value}`.toLowerCase().includes(normalized),
    )
  }, [options, query])

  const visibleOptions = useMemo(() => {
    if (filteredOptions.length <= MAX_RENDERED_OPTIONS) return filteredOptions
    const sliced = filteredOptions.slice(0, MAX_RENDERED_OPTIONS)
    if (selectedOption && !sliced.some((item) => item.value === selectedOption.value)) {
      const match = filteredOptions.find((item) => item.value === selectedOption.value)
      if (match) return [match, ...sliced.slice(0, MAX_RENDERED_OPTIONS - 1)]
    }
    return sliced
  }, [filteredOptions, selectedOption])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vw = window.innerWidth || 1024
    const vh = window.innerHeight || 768
    const minWidth = Math.min(Math.max(rect.width || 220, 210), vw - 24)
    const maxWidth = Math.min(Math.max(rect.width || 300, 340), vw - 24)
    const spaceBelow = vh - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = rect.top > 0 && spaceBelow < 190 && spaceAbove > spaceBelow
    const left = Math.max(12, Math.min(rect.left, vw - minWidth - 12))

    if (openUpward) {
      setPosition({
        bottom: vh - rect.top + 6,
        left,
        minWidth,
        maxWidth,
        maxHeight: Math.min(280, Math.max(140, spaceAbove - 8)),
        placement: 'top',
      })
    } else {
      setPosition({
        top: rect.bottom + 6,
        left,
        minWidth,
        maxWidth,
        maxHeight: Math.min(280, Math.max(140, spaceBelow > 0 ? spaceBelow - 8 : 280)),
        placement: 'bottom',
      })
    }
  }, [])

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
    }
  }, [])

  const openMenu = useCallback((preferredDirection?: 'first' | 'last') => {
    if (disabled) return
    setQuery('')
    instantGlideRef.current = true
    const currentIdx = options.findIndex((option) => option.value === value)
    if (preferredDirection === 'first') {
      setActiveIndex(0)
    } else if (preferredDirection === 'last') {
      setActiveIndex(Math.max(0, options.length - 1))
    } else {
      setActiveIndex(currentIdx >= 0 ? currentIdx : 0)
    }
    updatePosition()
    setOpen(true)
  }, [disabled, options, updatePosition, value])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const target = isSearchable ? searchRef.current : listboxRef.current
    const frame = window.requestAnimationFrame(() => {
      target?.focus({ preventScroll: true })
      const selectedEl = listboxRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      selectedEl?.scrollIntoView?.({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isSearchable, open, updatePosition])

  useLayoutEffect(() => {
    const pill = glidePillRef.current
    const list = listboxRef.current
    if (!pill || !list || !open) return
    const activeEl = list.querySelector<HTMLElement>('[data-active="true"]')
    if (!activeEl) {
      pill.style.opacity = '0'
      return
    }
    const jump = instantGlideRef.current || pill.style.opacity !== '1'
    pill.style.transitionDuration = jump ? '0ms, 0ms, 140ms' : ''
    pill.style.transform = `translateY(${activeEl.offsetTop}px)`
    pill.style.height = `${activeEl.offsetHeight}px`
    pill.style.opacity = '1'
    instantGlideRef.current = false
  }, [activeIndex, open, visibleOptions])

  useEffect(() => {
    if (!open) return
    const activeEl = listboxRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    activeEl?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      closeMenu(false)
    }

    function handleCaptureKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        closeMenu(true)
      } else if (event.key === 'Tab') {
        triggerRef.current?.focus({ preventScroll: true })
        closeMenu(false)
      }
    }

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('keydown', handleCaptureKeyDown, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('keydown', handleCaptureKeyDown, true)
    }
  }, [closeMenu, open, updatePosition])

  function selectAt(index: number, viaPointer = false) {
    const chosen = visibleOptions[index]
    if (!chosen) return
    if (chosen.value !== value && viaPointer) {
      setSwapping(true)
    }
    onChange(chosen.value)
    closeMenu(true)
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openMenu(open ? undefined : undefined)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu('last')
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) closeMenu(true)
      else openMenu()
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>, inSearchInput = false) {
    const count = visibleOptions.length
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (count > 0) setActiveIndex((prev) => (prev + 1) % count)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (count > 0) setActiveIndex((prev) => (prev - 1 + count) % count)
    } else if (event.key === 'Home' && !inSearchInput) {
      event.preventDefault()
      if (count > 0) setActiveIndex(0)
    } else if (event.key === 'End' && !inSearchInput) {
      event.preventDefault()
      if (count > 0) setActiveIndex(count - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (clampedActiveIndex >= 0) selectAt(clampedActiveIndex)
    } else if (event.key === ' ' && !inSearchInput) {
      event.preventDefault()
      if (clampedActiveIndex >= 0) selectAt(clampedActiveIndex)
    } else if (!inSearchInput && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const char = event.key.toLowerCase()
      const nextIdx = visibleOptions.findIndex(
        (item, idx) => idx > activeIndex && item.label.toLowerCase().startsWith(char),
      )
      const fallbackIdx = visibleOptions.findIndex((item) => item.label.toLowerCase().startsWith(char))
      const resolved = nextIdx >= 0 ? nextIdx : fallbackIdx
      if (resolved >= 0) setActiveIndex(resolved)
    }
  }

  const clampedActiveIndex = visibleOptions.length
    ? Math.min(activeIndex, visibleOptions.length - 1)
    : -1
  const activeOptionId = clampedActiveIndex >= 0 ? `${listboxId}-opt-${clampedActiveIndex}` : undefined
  const portalTarget = typeof document !== 'undefined'
    ? (triggerRef.current?.closest('.app') ?? document.querySelector('.app') ?? document.body)
    : null

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        data-select-trigger=""
        data-swap={swapping ? '' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        className={cn(
          'select-trigger',
          size === 'sm' && 'select-trigger-sm',
          open && 'select-trigger-open',
          className,
        )}
        onAnimationEnd={(event) => {
          if (event.animationName === 'gs-swap') setSwapping(false)
        }}
        onClick={(event) => {
          event.stopPropagation()
          if (open) closeMenu(true)
          else openMenu()
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="select-trigger-content">
          <span className={cn('select-trigger-label', selectedOption?.mono && 'select-mono')}>
            {selectedOption ? selectedOption.label : (value || placeholder)}
          </span>
          {selectedOption?.detail ? (
            <span className="select-trigger-detail">— {selectedOption.detail}</span>
          ) : null}
        </span>
        <ChevronMorphIcon size={16} strokeWidth={1.85} morphed={open} className={cn('select-chevron', open && 'select-chevron-open')} aria-hidden="true" />
      </button>

      {portalTarget
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={popoverRef}
                  role="region"
                  aria-label={`${label} menu`}
                  className={cn('select-popover', `select-popover-${position.placement}`)}
                  style={{
                    top: position.top,
                    bottom: position.bottom,
                    left: position.left,
                    minWidth: position.minWidth,
                    maxWidth: position.maxWidth,
                  }}
                  initial={{ opacity: 0, y: position.placement === 'top' ? 5 : -5, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: EASE_OUT } }}
                  exit={{ opacity: 0, y: position.placement === 'top' ? 3 : -3, scale: 0.985, transition: { duration: 0.1, ease: EASE_OUT } }}
                >
                  {isSearchable ? (
                    <div className="select-search">
                      <SearchIcon size={14} strokeWidth={1.85} aria-hidden="true" />
                      <input
                        ref={searchRef}
                        type="text"
                        role="combobox"
                        aria-expanded={true}
                        aria-autocomplete="list"
                        value={query}
                        aria-label={`Filter ${label}`}
                        aria-controls={listboxId}
                        aria-activedescendant={activeOptionId}
                        placeholder="Filter options…"
                        onChange={(event) => {
                          setQuery(event.target.value)
                          setActiveIndex(0)
                        }}
                        onKeyDown={(event) => handleMenuKeyDown(event, true)}
                      />
                    </div>
                  ) : null}

                  <div
                    ref={listboxRef}
                    id={listboxId}
                    role="listbox"
                    aria-label={label}
                    tabIndex={isSearchable ? undefined : -1}
                    aria-activedescendant={!isSearchable ? activeOptionId : undefined}
                    className="select-options"
                    style={{ maxHeight: isSearchable ? Math.max(120, position.maxHeight - 40) : position.maxHeight }}
                    onKeyDown={!isSearchable ? (event) => handleMenuKeyDown(event, false) : undefined}
                  >
                    <span ref={glidePillRef} className="select-glide-pill" aria-hidden="true" />
                    {visibleOptions.length ? (
                      visibleOptions.map((option, index) => {
                        const isSelected = option.value === value
                        const isActive = index === clampedActiveIndex
                        return (
                          <div
                            key={option.value}
                            id={`${listboxId}-opt-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            data-active={isActive ? 'true' : undefined}
                            className={cn(
                              'select-option',
                              isActive && 'select-option-active',
                              isSelected && 'select-option-selected',
                            )}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectAt(index, true)}
                          >
                            <span className="select-option-copy">
                              <strong className={cn(option.mono && 'select-mono')}>{option.label}</strong>
                              {option.detail ? <small>{option.detail}</small> : null}
                            </span>
                            {isSelected ? (
                              <span className="select-option-check" aria-hidden="true">
                                <CheckMarkIcon size={13} />
                              </span>
                            ) : null}
                          </div>
                        )
                      })
                    ) : (
                      <div role="option" aria-disabled="true" aria-selected={false} className="select-empty">
                        No matching options
                      </div>
                    )}
                  </div>

                  {filteredOptions.length > MAX_RENDERED_OPTIONS ? (
                    <div className="select-more-hint">
                      Showing {MAX_RENDERED_OPTIONS} of {filteredOptions.length} — type above to narrow
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            portalTarget,
          )
        : null}
    </>
  )
}