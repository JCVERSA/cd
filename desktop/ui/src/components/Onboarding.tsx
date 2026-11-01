import { ArrowLeft, ArrowRight, Bot, Check, Command, KeyRound, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { Provider, ProviderId } from '../types'
import { Button } from './ui'

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
  const choices = providers.filter((item) => ['gemini', 'groq', 'openai', 'ollama'].includes(item.id))

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

  const steps = [
    {
      eyebrow: 'Welcome to SwiftSlate',
      title: 'Write faster in every Windows app.',
      copy: 'Type a short command after your text. SwiftSlate transforms it in place, then gets out of your way.',
    },
    {
      eyebrow: 'Choose a provider',
      title: 'Connect the intelligence you prefer.',
      copy: 'You can add more providers and switch models at any time.',
    },
    {
      eyebrow: 'Protected credential',
      title: provider === 'ollama' ? 'Your local server needs no key.' : 'Add an API key securely.',
      copy: provider === 'ollama' ? 'SwiftSlate will connect only to the Ollama server on this computer.' : 'Your key is encrypted with Windows DPAPI and cannot be read by another user or machine.',
    },
    {
      eyebrow: 'Ready',
      title: 'Your fastest workflow starts now.',
      copy: 'SwiftSlate will stay in the tray and listen for inline commands. Start with the examples below.',
    },
  ]

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="onboarding-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.section className="onboarding-panel" initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
            <div className="onboarding-art" aria-hidden="true">
              <div className="onboarding-logo"><Sparkles size={27}/></div>
              <div className="onboarding-orbit orbit-one"/><div className="onboarding-orbit orbit-two"/>
              <div className="floating-command command-a"><span>Before</span><strong>can u review this pls .formal</strong></div>
              <motion.div className="transform-beam" animate={{ opacity: [0.25, 0.8, 0.25], scaleX: [0.7, 1, 0.7] }} transition={{ duration: 2.6, repeat: Infinity }}/>
              <div className="floating-command command-b"><span>After</span><strong>Could you please review this?</strong></div>
              <div className="privacy-pill"><ShieldCheck size={14}/> Private by design</div>
            </div>

            <div className="onboarding-content">
              <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
                {steps.map((_, index) => <span key={index} className={index <= step ? 'progress-active' : ''}/>) }
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={step} className="onboarding-step" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                  <span className="section-kicker">{steps[step].eyebrow}</span>
                  <h1>{steps[step].title}</h1>
                  <p>{steps[step].copy}</p>

                  {step === 0 ? (
                    <div className="onboarding-features">
                      <div><Zap size={17}/><span><strong>Instant</strong>System-wide triggers</span></div>
                      <div><ShieldCheck size={17}/><span><strong>Private</strong>Local-first behavior</span></div>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="onboarding-provider-grid">
                      {choices.map((item) => (
                        <button key={item.id} className={provider === item.id ? 'selected' : ''} type="button" onClick={() => setProvider(item.id)}>
                          <span><Bot size={17}/></span><strong>{item.name}</strong><small>{item.local ? 'Runs on this PC' : item.description}</small>{provider === item.id ? <i><Check size={12}/></i> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {step === 2 ? (
                    provider === 'ollama' ? (
                      <div className="onboarding-local-ready"><Check size={18}/><div><strong>Ollama selected</strong><span>Default endpoint: http://127.0.0.1:11434</span></div></div>
                    ) : (
                      <label className="onboarding-key-field"><span>API key</span><div><KeyRound size={16}/><input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Paste your key" autoComplete="off"/></div><small>You may skip this and use offline styles first.</small></label>
                    )
                  ) : null}

                  {step === 3 ? (
                    <div className="onboarding-commands">
                      <div><code>.fix</code><span>Fix grammar and spelling</span></div>
                      <div><code>.improve</code><span>Polish clarity and flow</span></div>
                      <div><code>.bold</code><span>Style text locally</span></div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              {error ? <div className="inline-message onboarding-error">{error}</div> : null}
              <div className="onboarding-actions">
                {step > 0 ? <Button variant="ghost" icon={<ArrowLeft size={15}/>} onClick={() => setStep(step - 1)}>Back</Button> : <span/>}
                {step < steps.length - 1
                  ? <Button variant="primary" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={15}/></Button>
                  : <Button variant="primary" loading={completing} icon={<Command size={15}/>} onClick={finish}>Open SwiftSlate</Button>}
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
