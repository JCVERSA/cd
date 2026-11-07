import { useMemo, useState } from 'react'
import { api } from '../api'
import { ProviderLogo, getProviderPortalUrl, getProviderTileClass } from '../components/ProviderLogo'
import { Badge, Button, Field, Modal, SecretInput, Select, SpotlightCard } from '../components/ui'
import {
  AlertCircleIcon,
  CheckMarkIcon,
  ExternalLaunchIcon,
  KeyVaultIcon,
  ProbeFlaskIcon,
  SearchIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SpinnerRingIcon,
  SyncArrowsIcon,
  TuneSlidersIcon,
} from '../icons'
import type { Provider } from '../types'

type ProviderFilter = 'all' | 'free' | 'cloud' | 'local'

const filterOptions: Array<{ id: ProviderFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free tier' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'local', label: 'Local' },
]

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
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProviderFilter>('all')
  const [editing, setEditing] = useState<Provider | null>(null)
  const [draft, setDraft] = useState<Provider | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'models' | 'test' | null>(null)
  const [testFeedback, setTestFeedback] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null)

  const activeRecord = useMemo(
    () => providers.find((provider) => provider.id === activeProvider) || providers[0],
    [activeProvider, providers],
  )
  const connected = useMemo(() => providers.filter((provider) => provider.connected || provider.keyConfigured || provider.local).length, [providers])
  const freeCount = useMemo(
    () => providers.filter((provider) => provider.freeTier || provider.local).length,
    [providers],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return providers.filter((provider) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'free' && Boolean(provider.freeTier || provider.local)) ||
        (filter === 'cloud' && !provider.local) ||
        (filter === 'local' && provider.local)
      if (!matchesFilter) return false
      if (!q) return true
      return (
        provider.name.toLowerCase().includes(q) ||
        provider.description.toLowerCase().includes(q) ||
        provider.model.toLowerCase().includes(q) ||
        provider.endpoint.toLowerCase().includes(q)
      )
    })
  }, [providers, filter, query])

  function open(provider: Provider) {
    setEditing(provider)
    setDraft({ ...provider })
    setApiKey('')
    setTestFeedback(null)
  }

  async function openPortal(provider: Provider) {
    const portalUrl = getProviderPortalUrl(provider.id, provider.portalAvailable)
    if (!portalUrl) return
    try {
      await api.openProviderPortal(provider.id, portalUrl)
      notify(
        provider.local
          ? `Opened ${provider.name} download page in your browser.`
          : `Opened ${provider.name} API keys page in your browser.`,
      )
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not open provider page.', 'danger')
    }
  }

  async function fetchModels() {
    if (!draft) return
    setBusy('models')
    setTestFeedback(null)
    try {
      const result = await api.fetchModels(draft, apiKey || undefined)
      setDraft({
        ...draft,
        models: result.models,
        model: result.models.includes(draft.model) ? draft.model : (result.models[0] || draft.model),
      })
      setTestFeedback({
        text: `Found ${result.models.length} available model${result.models.length === 1 ? '' : 's'}.`,
        tone: 'success',
      })
    } catch (error) {
      setTestFeedback({
        text: error instanceof Error ? error.message : 'Could not fetch models.',
        tone: 'danger',
      })
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    if (!draft) return
    setBusy('test')
    setTestFeedback(null)
    try {
      const result = await api.testProvider(draft, apiKey || undefined)
      setTestFeedback({ text: `${result.message} ${result.latencyMs} ms.`, tone: 'success' })
    } catch (error) {
      setTestFeedback({
        text: error instanceof Error ? error.message : 'Connection test failed.',
        tone: 'danger',
      })
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

  const draftPortalUrl = draft ? getProviderPortalUrl(draft.id, draft.portalAvailable) : ''

  return (
    <div className="screen providers-screen">
      <section className="provider-summary-row">
        <div>
          <h2>Choose where SwiftSlate thinks</h2>
          <p>Credentials are encrypted with Windows DPAPI and never returned to this interface.</p>
        </div>
        <div className="provider-summary-stats">
          <div><strong>{connected}</strong><span>ready</span></div>
          <div><strong>{freeCount}</strong><span>free-tier</span></div>
          <div><ShieldCheckIcon size={17} strokeWidth={1.85} aria-hidden="true" /><span>DPAPI bound</span></div>
        </div>
      </section>

      {activeRecord ? (
        <SpotlightCard className="active-routing-banner">
          <div className="active-routing-main">
            <span className={`provider-mark ${getProviderTileClass(activeRecord.id)}`}>
              <ProviderLogo id={activeRecord.id} size={21} />
            </span>
            <div className="active-routing-copy">
              <div className="active-routing-title">
                <strong>{activeRecord.name}</strong>
                <Badge tone="accent">Active routing</Badge>
              </div>
              <span>
                Model <code>{activeRecord.model || 'default'}</code> ·{' '}
                {activeRecord.local
                  ? 'Local loopback'
                  : activeRecord.endpoint.replace(/^https?:\/\//, '').split('/')[0] || 'Custom HTTPS'}
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<TuneSlidersIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
            onClick={() => open(activeRecord)}
          >
            Edit active routing
          </Button>
        </SpotlightCard>
      ) : null}

      <div className="provider-toolbar">
        <div className="filter-search">
          <SearchIcon size={16} strokeWidth={1.85} morphed={Boolean(query)} aria-hidden="true" />
          <input
            aria-label="Search providers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search providers or models…"
          />
        </div>
        <div className="segmented-control" role="group" aria-label="Provider filter">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={filter === option.id ? 'segment-active' : ''}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="table-count">
          {filtered.length === providers.length
            ? `${providers.length} providers`
            : `${filtered.length} of ${providers.length} providers`}
        </span>
      </div>

      {filtered.length ? (
        <section className="provider-grid">
          {filtered.map((provider, index) => {
            const active = provider.id === activeProvider
            const portalUrl = getProviderPortalUrl(provider.id, provider.portalAvailable)
            const portalActionLabel = provider.local ? 'Get app' : 'Get key'
            const portalAriaLabel = provider.local
              ? `Get ${provider.name}`
              : `Get ${provider.name} API key`
            return (
              <SpotlightCard
                key={provider.id}
                interactive
                className={`provider-card ${active ? 'provider-card-active' : ''}`}
                delay={Math.min(index * 0.02, 0.14)}
              >
                <div className="provider-card-top">
                  <span className={`provider-mark ${getProviderTileClass(provider.id)}`}>
                    <ProviderLogo id={provider.id} size={21} />
                  </span>
                  <div className="provider-state">
                    {portalUrl ? (
                      <button
                        type="button"
                        className="provider-key-button"
                        aria-label={portalAriaLabel}
                        title={portalAriaLabel}
                        onClick={() => void openPortal(provider)}
                      >
                        <span>{portalActionLabel}</span>
                        <ExternalLaunchIcon size={12} strokeWidth={1.85} aria-hidden="true" />
                      </button>
                    ) : null}
                    {active ? (
                      <Badge tone="accent">Active</Badge>
                    ) : provider.connected || provider.keyConfigured ? (
                      <Badge tone="success">Ready</Badge>
                    ) : provider.freeTier && !provider.local ? (
                      <Badge tone="success"><SparkleIcon size={12} strokeWidth={1.85} aria-hidden="true" />Free tier</Badge>
                    ) : (
                      <Badge>Not configured</Badge>
                    )}
                  </div>
                </div>
                <h3>{provider.name}</h3>
                <p>{provider.description}</p>
                <div className="provider-details">
                  <div>
                    <span>Model</span>
                    <strong title={provider.model}>{provider.model || 'Not selected'}</strong>
                  </div>
                  <div>
                    <span>Host</span>
                    <strong title={provider.endpoint}>
                      {provider.local
                        ? 'Local machine'
                        : provider.endpoint.replace(/^https?:\/\//, '').split('/')[0] || 'Custom'}
                    </strong>
                  </div>
                </div>
                <div className="provider-card-footer">
                  <span className="credential-state">
                    {provider.local ? (
                      <><ServerStackIcon size={15} strokeWidth={1.85} aria-hidden="true" /> No key required</>
                    ) : provider.keyConfigured ? (
                      <><KeyVaultIcon size={15} strokeWidth={1.85} aria-hidden="true" /> Key protected</>
                    ) : (
                      <><KeyVaultIcon size={15} strokeWidth={1.85} aria-hidden="true" /> Add a key</>
                    )}
                  </span>
                  <Button
                    variant={active ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<TuneSlidersIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
                    onClick={() => open(provider)}
                  >
                    Configure
                  </Button>
                </div>
              </SpotlightCard>
            )
          })}
        </section>
      ) : (
        <SpotlightCard className="provider-empty">
          <SearchIcon size={24} strokeWidth={1.85} aria-hidden="true" />
          <strong>No matching providers</strong>
          <span>Try another search term or switch back to all providers.</span>
          <Button size="sm" onClick={() => { setQuery(''); setFilter('all') }}>Clear filters</Button>
        </SpotlightCard>
      )}

      <Modal
        open={Boolean(editing && draft)}
        onClose={() => setEditing(null)}
        title={draft ? `Configure ${draft.name}` : 'Configure provider'}
        description={draft?.description}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {draft?.id !== activeProvider ? (
              <Button variant="secondary" disabled={Boolean(busy)} onClick={() => save(false)}>Save only</Button>
            ) : null}
            <Button
              variant="primary"
              loading={busy === 'save'}
              onClick={() => save(true)}
              icon={<CheckMarkIcon size={16} aria-hidden="true" />}
            >
              {draft?.id === activeProvider ? 'Save changes' : 'Save & use provider'}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="provider-form">
            <div className="form-grid-two">
              <Field
                label="Endpoint"
                hint={draft.local ? 'The server must be running on this computer.' : 'HTTPS is required for remote credentials.'}
              >
                <input
                  value={draft.endpoint}
                  onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
                  disabled={!draft.local && draft.id !== 'custom'}
                />
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
                  <input
                    value={draft.model}
                    onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                    placeholder="Model identifier"
                  />
                )}
              </Field>
            </div>
            {!draft.local ? (
              <div className="field api-key-block">
                <div className="api-key-header">
                  <label htmlFor="provider-api-key-input" className="field-label">API key</label>
                  {draftPortalUrl ? (
                    <button
                      type="button"
                      className="provider-key-inline"
                      onClick={() => void openPortal(draft)}
                    >
                      <span>Get {draft.name} API key</span>
                      <ExternalLaunchIcon size={12} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <SecretInput
                  id="provider-api-key-input"
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder={draft.keyConfigured ? '••••••••••••••••' : 'Paste a key…'}
                />
                <span className="field-hint">
                  {draft.keyConfigured
                    ? 'Leave blank to keep the protected key already on this device.'
                    : 'Saved with current-user DPAPI encryption.'}
                </span>
              </div>
            ) : null}
            <div className="provider-test-panel">
              <div>
                <strong>Validate this connection</strong>
                <p>Fetch models checks availability. Test provider sends a fixed probe to the selected model.</p>
              </div>
              <div className="provider-test-actions">
                <Button
                  size="sm"
                  icon={busy === 'models' ? <SpinnerRingIcon size={15} strokeWidth={1.85} className="spin" aria-hidden="true" /> : <SyncArrowsIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
                  disabled={Boolean(busy)}
                  onClick={fetchModels}
                >
                  Fetch models
                </Button>
                <Button
                  size="sm"
                  icon={busy === 'test' ? <SpinnerRingIcon size={15} strokeWidth={1.85} className="spin" aria-hidden="true" /> : <ProbeFlaskIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
                  disabled={Boolean(busy)}
                  onClick={test}
                >
                  Test provider
                </Button>
              </div>
            </div>
            {testFeedback ? (
              <div
                className={`inline-message ${testFeedback.tone === 'danger' ? 'inline-message-danger' : ''}`}
                role={testFeedback.tone === 'danger' ? 'alert' : 'status'}
              >
                {testFeedback.tone === 'danger'
                  ? <AlertCircleIcon size={16} strokeWidth={1.85} aria-hidden="true" />
                  : <CheckMarkIcon size={16} strokeWidth={1.85} aria-hidden="true" />}
                {testFeedback.text}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
