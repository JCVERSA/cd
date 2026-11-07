import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BoltInstantIcon,
  CheckMarkIcon,
  CommandsIcon,
  ExternalLaunchIcon,
  ShieldCheckIcon,
} from '../icons'
import type { Provider, ProviderId } from '../types'
import { BrandLogo } from './BrandLogo'
import { ProviderLogo, getProviderPortalUrl, getProviderTileClass } from './ProviderLogo'
import { Button, SecretInput } from './ui'

export function Onboarding({
  open,
  providers,
  onComplete,
}: {
  open: boolean
  providers: Provider[]
  onComplete: (provider: ProviderId, apiKey: string) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [provider, setProvider] = useState<ProviderId>('gemini')
  const [key, setKey] = useState('')
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const choices = providers.filter((item) => ['gemini', 'groq', 'cerebras', 'ollama'].includes(item.id))
  const selectedProvider = providers.find((item) => item.id === provider)
  const selectedPortalUrl = getProviderPortalUrl(provider, selectedProvider?.portalAvailable)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selector = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusFirst = window.requestAnimationFrame(() => panel?.querySelector<HTMLElement>(selector)?.focus())

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector))
        .filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) return
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

    document.addEventListener('keydown', trapFocus)
    return () => {
      window.cancelAnimationFrame(focusFirst)
      document.removeEventListener('keydown', trapFocus)
      previousFocus?.focus()
    }
  }, [open])

  async function finish() {
    setCompleting(true)
    setError('')
    try {
      await onComplete(provider, key.trim())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Setup could not be saved.')
    } finally {
      setCompleting(false)
    }
  }

  async function openSelectedPortal() {
    if (!selectedPortalUrl) return
    try {
      await api.openProviderPortal(provider, selectedPortalUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open provider page.')
    }
  }

  const steps = [
    {
      title: 'Write faster in every Windows app.',
      copy: 'Type a short inline trigger after any sentence. SwiftSlate rewrites it in place and steps out of your way.',
    },
    {
      title: 'Choose where SwiftSlate thinks.',
      copy: 'Pick a free-tier cloud API or a local runtime. All 16 providers stay available later.',
    },
    {
      title: provider === 'ollama' ? 'Your local server needs no key.' : 'Add an API key securely.',
      copy: provider === 'ollama'
        ? 'SwiftSlate connects only to the local Ollama server on 127.0.0.1.'
        : 'Encrypted with Windows DPAPI so no other account or machine can decrypt it.',
    },
    {
      title: 'Ready in your system tray.',
      copy: 'SwiftSlate stays lightweight in the background and listens globally. Try any trigger below.',
    },
  ]

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="onboarding-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="onboarding-panel"
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } }}
            exit={{ opacity: 0, y: 6, scale: 0.99, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
          >
            <div className="onboarding-art" aria-hidden="true">
              <div className="onboarding-stage-top">
                <div className="onboarding-logo"><BrandLogo size={46} /></div>
                <div>
                  <strong>SwiftSlate</strong>
                  <span>Windows inline engine</span>
                </div>
              </div>

              <div className="onboarding-app-frame">
                <div className="app-frame-bar">
                  <span>Release notes — Editor</span>
                  <code>.formal</code>
                </div>
                <div className="app-frame-body">
                  <div className="app-frame-line app-frame-before">
                    <span>Typed</span>
                    <p>can u review this pls <code>.formal</code></p>
                  </div>
                  <div className="app-frame-line app-frame-after">
                    <span>In-place result</span>
                    <p>Could you please review this?</p>
                  </div>
                </div>
              </div>

              <div className="privacy-pill"><ShieldCheckIcon size={15} strokeWidth={1.85} /> DPAPI encrypted · Zero telemetry</div>
            </div>

            <div className="onboarding-content">
              <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
                {steps.map((_, index) => <span key={index} className={index <= step ? 'progress-active' : ''} />)}
              </div>
              <div key={step} className="onboarding-step">
                <span className="step-counter">Step {step + 1} of {steps.length}</span>
                <h1 id="onboarding-title">{steps[step].title}</h1>
                <p>{steps[step].copy}</p>

                {step === 0 ? (
                  <div className="onboarding-features">
                    <div><BoltInstantIcon size={18} strokeWidth={1.85} aria-hidden="true" /><span><strong>In-place</strong>Works inside any text box</span></div>
                    <div><ShieldCheckIcon size={18} strokeWidth={1.85} aria-hidden="true" /><span><strong>Private</strong>Local styles never use network</span></div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="onboarding-provider-grid">
                    {choices.map((item) => (
                      <button key={item.id} className={provider === item.id ? 'selected' : ''} type="button" onClick={() => setProvider(item.id)}>
                        <span className={`onboarding-provider-tile ${getProviderTileClass(item.id)}`}><ProviderLogo id={item.id} size={18} /></span>
                        <strong>{item.name}</strong>
                        <small>{item.local ? 'Runs on this PC' : item.freeTier ? 'Free tier ready' : item.description}</small>
                        {provider === item.id ? <i aria-hidden="true"><CheckMarkIcon size={12} strokeWidth={2.2} /></i> : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {step === 2 ? (
                  provider === 'ollama' ? (
                    <div className="onboarding-local-ready"><CheckMarkIcon size={18} strokeWidth={1.85} aria-hidden="true" /><div><strong>Ollama selected</strong><span>Default endpoint: http://127.0.0.1:11434</span></div></div>
                  ) : (
                    <div className="onboarding-key-field">
                      <div className="api-key-header">
                        <label htmlFor="onboarding-api-key-input">API key</label>
                        {selectedPortalUrl ? (
                          <button type="button" className="provider-key-inline" onClick={() => void openSelectedPortal()}>
                            <span>Get {selectedProvider?.name || provider} API key</span>
                            <ExternalLaunchIcon size={12} strokeWidth={1.85} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                      <SecretInput
                        id="onboarding-api-key-input"
                        value={key}
                        onChange={setKey}
                        placeholder="Paste your key…"
                      />
                      <small>You may skip this and use offline styles first.</small>
                    </div>
                  )
                ) : null}

                {step === 3 ? (
                  <div className="onboarding-commands">
                    <div><code>.fix</code><span>Fix grammar and spelling</span></div>
                    <div><code>.improve</code><span>Polish clarity and flow</span></div>
                    <div><code>.bold</code><span>Style text locally</span></div>
                  </div>
                ) : null}
              </div>

              {error ? <div className="inline-message inline-message-danger onboarding-error" role="alert">{error}</div> : null}
              <div className="onboarding-actions">
                {step > 0 ? <Button variant="ghost" icon={<ArrowLeftIcon size={16} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
                {step < steps.length - 1
                  ? <Button variant="primary" onClick={() => setStep(step + 1)}>Continue <ArrowRightIcon size={16} strokeWidth={1.85} aria-hidden="true" /></Button>
                  : <Button variant="primary" loading={completing} icon={<CommandsIcon size={16} strokeWidth={1.85} aria-hidden="true" />} onClick={finish}>Open SwiftSlate</Button>}
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
