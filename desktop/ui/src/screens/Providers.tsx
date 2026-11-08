import { useMemo, useState } from 'react'
import { api } from '../api'
import { ChromaGrid } from '../components/ChromaGrid'
import { GlideSelect } from '../components/GlideSelect'
import { JellyRadio } from '../components/JellyRadio'
import { ProviderLogo, getProviderAccentColor, getProviderPortalUrl, getProviderTileClass } from '../components/ProviderLogo'
import { SlideCommit } from '../components/SlideCommit'
import { Badge, Button, Field, Modal, SecretInput, Select, SpotlightCard } from '../components/ui'
import {
  AlertCircleIcon,
  CheckMarkIcon,
  ExternalLaunchIcon,
  KeyVaultIcon,
  OfflineCloudIcon,
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
type ProviderSort = 'recommended' | 'ready' | 'name' | 'local'

const sortOptions: Array<{ value: ProviderSort; label: string; tag: string }> = [
  { value: 'recommended', label: 'Recommended', tag: 'Default' },
  { value: 'ready', label: 'Ready first', tag: 'Connected' },
  { value: 'name', label: 'Alphabetical', tag: 'A–Z' },
  { value: 'local', label: 'Local first', tag: 'Offline' },
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
  const [sortBy, setSortBy] = useState<ProviderSort>('recommended')
  const [editing, setEditing] = useState<Provider | null>(null)
  const [draft, setDraft] = useState<Provider | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'models' | 'test' | null>(null)
  const [testFeedback, setTestFeedback] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null)

  const connected = useMemo(() => providers.filter((provider) => provider.connected || provider.keyConfigured || provider.local).length, [providers])
  const freeCount = useMemo(
    () => providers.filter((provider) => provider.freeTier || provider.local).length,
    [providers],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = providers.filter((provider) => {
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
    if (sortBy === 'recommended') return matched
    const copy = [...matched]
    if (sortBy === 'name') {
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    }
    if (sortBy === 'ready') {
      const rank = (p: Provider) =>
        p.id === activeProvider ? 0 : (p.connected || p.keyConfigured || p.local) ? 1 : p.freeTier ? 2 : 3
      return copy.sort((a, b) => rank(a) - rank(b))
    }
    return copy.sort((a, b) => Number(Boolean(b.local)) - Number(Boolean(a.local)))
  }, [activeProvider, providers, filter, query, sortBy])

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

  async function commitActivateSlide() {
    if (!draft) return
    const saved = await api.saveProvider(draft, apiKey || undefined, true)
    onChange(saved, true)
    notify(`${saved.name} is now active.`, 'success')
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
        <JellyRadio
          ariaLabel="Provider filter"
          value={filter}
          onChange={(val) => setFilter(val as ProviderFilter)}
          chipColor="var(--surface-2)"
          activeColor="var(--accent)"
          textColor="var(--text-soft)"
          activeTextColor="#110d18"
          size="sm"
          gap={6}
          radius={14}
          swell={0.14}
          barge={4}
          shrink={0.04}
          jelly={1}
          bounce={0.25}
          stagger={20}
          stiffness={580}
          items={[
            { value: 'all', label: 'All' },
            { value: 'free', label: 'Free tier', icon: <SparkleIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
            { value: 'cloud', label: 'Cloud', icon: <ServerStackIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
            { value: 'local', label: 'Local', icon: <OfflineCloudIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
          ]}
        />
        <GlideSelect
          ariaLabel="Sort providers"
          options={sortOptions}
          value={sortBy}
          onChange={(val) => setSortBy(val as ProviderSort)}
          showTags
          size="md"
          radius={11}
          menuWidth={198}
          placement="bottom"
          align="left"
        />
        <span className="table-count">
          {filtered.length === providers.length
            ? `${providers.length} providers`
            : `${filtered.length} of ${providers.length} providers`}
        </span>
      </div>

      {filtered.length ? (
        <ChromaGrid
          as="section"
          className="provider-grid"
          columns={3}
          minCardWidth={248}
          gap={12}
          radius={290}
          softness={0.62}
          damping={0.42}
          fadeOut={0.55}
          glow={0.62}
          borderGlow={0.95}
          cardRadius={14}
          items={filtered.map((provider) => {
            const active = provider.id === activeProvider
            const portalUrl = getProviderPortalUrl(provider.id, provider.portalAvailable)
            const portalActionLabel = provider.local ? 'Get app' : 'Get key'
            const portalAriaLabel = provider.local
              ? `Get ${provider.name}`
              : `Get ${provider.name} API key`
            return {
              id: provider.id,
              accent: getProviderAccentColor(provider.id),
              className: `provider-card${active ? ' provider-card-active' : ''}`,
              children: (
                <>
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
                </>
              ),
            }
          })}
        />
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
              <>
                <Button variant="secondary" disabled={Boolean(busy)} onClick={() => save(false)}>Save only</Button>
                <SlideCommit
                  label="Slide to activate"
                  doneLabel="Provider active"
                  errorLabel="Activation failed"
                  width={216}
                  height={38}
                  radius={19}
                  holdMs={500}
                  disabled={busy === 'models' || busy === 'test'}
                  trackColor="var(--surface-2)"
                  handleColor="var(--accent)"
                  successColor="#22c55e"
                  dangerColor="#e5484d"
                  onConfirm={commitActivateSlide}
                  onDone={() => {
                    window.setTimeout(() => setEditing(null), 420)
                  }}
                  onError={(reason) => {
                    notify(reason instanceof Error ? reason.message : 'Provider settings could not be saved.', 'danger')
                  }}
                />
              </>
            ) : (
              <Button
                variant="primary"
                loading={busy === 'save'}
                onClick={() => save(true)}
                icon={<CheckMarkIcon size={16} aria-hidden="true" />}
              >
                Save changes
              </Button>
            )}
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
