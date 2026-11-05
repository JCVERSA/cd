import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react'
import type { HTMLMotionProps } from 'motion/react'
import { Check, LoaderCircle, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, PropsWithChildren, ReactNode } from 'react'

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
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 560, damping: 32 }}
      className={cn('button', `button-${variant}`, `button-${size}`, className)}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : icon}
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
      <motion.span
        className="switch-knob"
        animate={{ x: checked ? 18 : 0 }}
        transition={{ type: 'spring', stiffness: 560, damping: 34 }}
      />
    </button>
  )
}

export function Badge({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }>) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}

export function SpotlightCard({ children, className, delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  const x = useMotionValue(-200)
  const y = useMotionValue(-200)
  const background = useMotionTemplate`radial-gradient(360px circle at ${x}px ${y}px, color-mix(in srgb, var(--accent) 13%, transparent), transparent 76%)`
  const reduce = useReducedMotion()

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(event.clientX - rect.left)
    y.set(event.clientY - rect.top)
  }

  return (
    <motion.div
      className={cn('glass-card spotlight-card', className)}
      style={{ backgroundImage: background }}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        x.set(-200)
        y.set(-200)
      }}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, delay }}
      whileHover={reduce ? undefined : { scale: 1.008 }}
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
      const preferred = panel?.querySelector<HTMLElement>('[autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
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
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 31 }}
          >
            <header className="modal-header">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description ? <p id={descriptionId}>{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} icon={<X size={18} />} />
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
            initial={{ opacity: 0, x: 22, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 18, scale: 0.97 }}
          >
            {toast.tone === 'success' ? <Check size={16} /> : null}
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
