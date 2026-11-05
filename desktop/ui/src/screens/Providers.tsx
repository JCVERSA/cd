import {
  Bot,
  Check,
  Cloud,
  Cpu,
  Database,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Wind,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { api } from '../api'
import type { Provider, ProviderId } from '../types'
import { Badge, Button, Field, Modal, Select, SpotlightCard } from '../components/ui'

const marks: Record<ProviderId, { letters: string; className: string; icon?: ComponentType<{ size?: number }> }> = {
  gemini: { letters: 'G', className: 'provider-gemini', icon: Sparkles },
  groq: { letters: 'GQ', className: 'provider-groq', icon: Zap },
  openai: { letters: 'OA', className: 'provider-openai', icon: Bot },
  openrouter: { letters: 'OR', className: 'provider-openrouter', icon: Cloud },
  mistral: { letters: 'M', className: 'provider-mistral', icon: Wind },
  deepseek: { letters: 'DS', className: 'provider-deepseek', icon: Database },
  nvidia: { letters: 'NV', className: 'provider-nvidia', icon: Cpu },
  ollama: { letters: 'OL', className: 'provider-ollama', icon: Server },
  lmstudio: { letters: 'LM', className: 'provider-lmstudio', icon: Cpu },
  custom: { letters: '+', className: 'provider-custom', icon: Plus },
}

export function ProvidersScreen({
  providers,
  activeProvider,
  onChange,
  notify,
}: {
  providers: Provider[]
  activeProvider: string
  onChange: (provider: Provider, activated: boolean) => void
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [editing, setEditing] = useState<Provider | null>(null)
  const [draft, setDraft] = useState<Provider | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'models' | 'test' | null>(null)
  const [testMessage, setTestMessage] = useState('')

  const connected = useMemo(() => providers.filter((provider) => provider.connected).length, [providers])

  function open(provider: Provider) {
    setEditing(provider)
    setDraft({ ...provider })
    setApiKey('')
    setTestMessage('')
  }

  async function fetchModels() {
    if (!draft) return
    setBusy('models')
    setTestMessage('')
    try {
      const result = await api.fetchModels(draft, apiKey || undefined)
      setDraft({ ...draft, models: result.models, model: result.models.includes(draft.model) ? draft.model : (result.models[0] || draft.model) })
      setTestMessage(`Found ${result.models.length} available model${result.models.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : 'Could not fetch models.')
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    if (!draft) return
    setBusy('test')
    setTestMessage('')
    try {
      const result = await api.testProvider(draft, apiKey || undefined)
      setTestMessage(`${result.message} ${result.latencyMs} ms.`)
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : 'Connection test failed.')
    } finally {
      setBusy(null)
    }
  }

  async function save(activate: boolean) {
    if (!draft) return
    setBusy('save')
    try {
      const saved = await api.saveProvider(draft, apiKey || undefined, activate)
      onChange(saved, activate)
      notify(activate ? `${saved.name} is now active.` : `${saved.name} settings saved.`, 'success')
      setEditing(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Provider settings could not be saved.', 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="screen providers-screen">
      <section className="provider-summary-row">
        <div>
          <span className="section-kicker">Model connections</span>
          <h2>Choose where SwiftSlate thinks</h2>
          <p>Credentials are encrypted with Windows DPAPI and never returned to this interface.</p>
        </div>
        <div className="provider-summary-stats">
          <div><strong>{connected}</strong><span>connected</span></div>
          <div><strong>{providers.length}</strong><span>available</span></div>
          <div><ShieldCheck size={18}/><span>keys protected</span></div>
        </div>
      </section>

      <section className="provider-grid">
        {providers.map((provider, index) => {
          const mark = marks[provider.id]
          const Icon = mark.icon
          const active = provider.id === activeProvider
          return (
            <SpotlightCard key={provider.id} className={`provider-card ${active ? 'provider-card-active' : ''}`} delay={Math.min(index * 0.025, 0.2)}>
              <div className="provider-card-top">
                <span className={`provider-mark ${mark.className}`}>{Icon ? <Icon size={19} /> : mark.letters}</span>
                <div className="provider-state">
                  {active ? <Badge tone="accent">Active</Badge> : provider.connected ? <Badge tone="success">Ready</Badge> : <Badge>Not configured</Badge>}
                </div>
              </div>
              <h3>{provider.name}</h3>
              <p>{provider.description}</p>
              <div className="provider-details">
                <div><span>Model</span><strong title={provider.model}>{provider.model || 'Not selected'}</strong></div>
                <div><span>Endpoint</span><strong title={provider.endpoint}>{provider.local ? 'Local machine' : provider.endpoint.replace(/^https?:\/\//, '').split('/')[0] || 'Custom'}</strong></div>
              </div>
              <div className="provider-card-footer">
                <span className="credential-state">
                  {provider.local ? <><Server size={14}/> No key required</> : provider.keyConfigured ? <><KeyRound size={14}/> Key protected</> : <><KeyRound size={14}/> Add a key</>}
                </span>
                <Button variant={active ? 'ghost' : 'secondary'} size="sm" icon={<Settings2 size={14} />} onClick={() => open(provider)}>Configure</Button>
              </div>
            </SpotlightCard>
          )
        })}
      </section>

      <Modal
        open={Boolean(editing && draft)}
        onClose={() => setEditing(null)}
        title={draft ? `Configure ${draft.name}` : 'Configure provider'}
        description={draft?.description}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {draft?.id !== activeProvider ? <Button variant="secondary" disabled={Boolean(busy)} onClick={() => save(false)}>Save only</Button> : null}
            <Button variant="primary" loading={busy === 'save'} onClick={() => save(true)} icon={<Check size={16} />}>{draft?.id === activeProvider ? 'Save changes' : 'Save & use provider'}</Button>
          </>
        }
      >
        {draft ? (
          <div className="provider-form">
            <div className="form-grid-two">
              <Field label="Endpoint" hint={draft.local ? 'The server must be running on this computer.' : 'HTTPS is required for remote credentials.'}>
                <input value={draft.endpoint} onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })} disabled={!draft.local && draft.id !== 'custom'} />
              </Field>
              <Field label="Model">
                {draft.models?.length ? (
                  <Select
                    label="Model"
                    value={draft.model}
                    options={draft.models.map((model) => ({ value: model, label: model, mono: true }))}
                    onChange={(model) => setDraft({ ...draft, model })}
                  />
                ) : (
                  <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="Model identifier" />
                )}
              </Field>
            </div>
            {!draft.local ? (
              <Field label="API key" hint={draft.keyConfigured ? 'Leave blank to keep the protected key already on this device.' : 'Saved with current-user DPAPI encryption.'}>
                <div className="input-with-icon"><KeyRound size={16}/><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={draft.keyConfigured ? '••••••••••••••••' : 'Paste a key'} autoComplete="off" /></div>
              </Field>
            ) : null}
            <div className="provider-test-panel">
              <div>
                <strong>Validate this connection</strong>
                <p>Fetch models checks availability. Test provider sends a tiny request to the selected model.</p>
              </div>
              <div className="provider-test-actions">
                <Button size="sm" icon={busy === 'models' ? <LoaderCircle size={14} className="spin"/> : <RefreshCw size={14}/>} disabled={Boolean(busy)} onClick={fetchModels}>Fetch models</Button>
                <Button size="sm" icon={busy === 'test' ? <LoaderCircle size={14} className="spin"/> : <TestTube2 size={14}/>} disabled={Boolean(busy)} onClick={test}>Test provider</Button>
              </div>
            </div>
            {testMessage ? <div className="inline-message"><Check size={15}/>{testMessage}</div> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
