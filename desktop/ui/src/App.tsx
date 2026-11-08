import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { api } from './api'
import { BrandLogo } from './components/BrandLogo'
import { LiquidGlass } from './components/LiquidGlass'
import { Onboarding } from './components/Onboarding'
import { ProviderLogo, getProviderTileClass } from './components/ProviderLogo'
import { Sidebar } from './components/Sidebar'
import { ThemeBackground } from './components/ThemeBackground'
import { Topbar } from './components/Topbar'
import { Button, Modal, Skeleton, Toasts, cn, type ToastItem } from './components/ui'
import {
  ArrowUpRightIcon,
  CommandsIcon,
  DiagnosticsIcon,
  EyeToggleIcon,
  OverviewIcon,
  PlaygroundIcon,
  ProvidersIcon,
  SearchIcon,
  SettingsIcon,
  StylesIcon,
} from './icons'
import { CommandsScreen } from './screens/Commands'
import { DiagnosticsScreen } from './screens/Diagnostics'
import { Overview } from './screens/Overview'
import { Playground } from './screens/Playground'
import { ProvidersScreen } from './screens/Providers'
import { SettingsScreen } from './screens/Settings'
import { StylesScreen } from './screens/Styles'
import type { AppSnapshot, PageId, Provider, ProviderId } from './types'

const pages: Array<{ id: PageId; label: string; description: string; icon: typeof OverviewIcon }> = [
  { id: 'overview', label: 'Overview', description: 'Runtime telemetry and routing', icon: OverviewIcon },
  { id: 'playground', label: 'Playground', description: 'Test a trigger in a safe split buffer', icon: PlaygroundIcon },
  { id: 'providers', label: 'Providers', description: 'Models, endpoints, and credentials', icon: ProvidersIcon },
  { id: 'commands', label: 'Commands', description: 'Inline trigger library', icon: CommandsIcon },
  { id: 'styles', label: 'Styles', description: 'Offline Unicode text foundry', icon: StylesIcon },
  { id: 'settings', label: 'Settings', description: 'Behavior, startup, and theme', icon: SettingsIcon },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Health matrix and debug logs', icon: DiagnosticsIcon },
]

type PaletteAction = {
  key: string
  group: 'Screens' | 'Commands' | 'Providers'
  title: string
  subtitle: string
  run: () => void
  icon?: typeof OverviewIcon
  providerId?: ProviderId
}

function LoadingShell() {
  return (
    <div className="loading-screen">
      <Skeleton className="loading-hero" />
      <div className="loading-columns"><Skeleton /><Skeleton /></div>
    </div>
  )
}

const BACKDROP_STORAGE_KEY = 'swiftslate.backdropIntensity'

function readStoredBackdropIntensity(): number {
  try {
    const raw = Number(window.localStorage.getItem(BACKDROP_STORAGE_KEY))
    if (Number.isFinite(raw) && raw >= 20 && raw <= 100) return Math.round(raw)
  } catch {
    // ignore storage errors
  }
  return 90
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<PageId>('overview')
  const [playgroundPreset, setPlaygroundPreset] = useState<string | undefined>(undefined)
  const [collapsed, setCollapsed] = useState(false)
  const [panelsHidden, setPanelsHidden] = useState(false)
  const [backdropIntensity, setBackdropIntensityState] = useState<number>(readStoredBackdropIntensity)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [error, setError] = useState('')
  const mainRef = useRef<HTMLElement>(null)
  const hidePanelsBtnRef = useRef<HTMLButtonElement>(null)
  const showPanelsBtnRef = useRef<HTMLButtonElement>(null)
  const toastId = useRef(0)

  const setBackdropIntensity = useCallback((next: number) => {
    const clamped = Math.min(100, Math.max(20, Math.round(next)))
    setBackdropIntensityState(clamped)
    try {
      window.localStorage.setItem(BACKDROP_STORAGE_KEY, String(clamped))
    } catch {
      // ignore storage errors
    }
  }, [])

  const hidePanels = useCallback(() => {
    setSearchOpen(false)
    setPanelsHidden(true)
    window.requestAnimationFrame(() => {
      showPanelsBtnRef.current?.focus()
    })
  }, [])

  const restorePanels = useCallback(() => {
    setPanelsHidden(false)
    window.requestAnimationFrame(() => {
      hidePanelsBtnRef.current?.focus()
    })
  }, [])

  const notify = useCallback((message: string, tone: 'success' | 'danger' | 'neutral' = 'neutral') => {
    const id = ++toastId.current
    setToasts((items) => [...items, { id, message, tone }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600)
  }, [])

  useEffect(() => {
    api.snapshot().then(setSnapshot).catch((reason) => setError(reason instanceof Error ? reason.message : 'SwiftSlate could not load.'))
  }, [])

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPanelsHidden(false)
        setSearchOpen(true)
        setPaletteIndex(0)
      }
      if (event.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false)
        } else if (panelsHidden) {
          event.preventDefault()
          restorePanels()
        }
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [panelsHidden, restorePanels, searchOpen])

  const navigate = useCallback((next: PageId) => {
    setPage(next)
    setSearchOpen(false)
    setSearch('')
    setPaletteIndex(0)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [])

  const openPlaygroundWith = useCallback((trigger: string) => {
    setPlaygroundPreset(trigger)
    setPage('playground')
    setSearchOpen(false)
    setSearch('')
    setPaletteIndex(0)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [])

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const normalized = search.toLowerCase().trim()
    const prefix = snapshot?.runtime.prefix || '.'
    const screenItems: PaletteAction[] = pages
      .filter((item) => !normalized || `${item.label} ${item.description}`.toLowerCase().includes(normalized))
      .map((item) => ({
        key: `page-${item.id}`,
        group: 'Screens',
        title: item.label,
        subtitle: item.description,
        icon: item.icon,
        run: () => navigate(item.id),
      }))

    const commandItems: PaletteAction[] = (snapshot?.commands || [])
      .filter((item) => normalized && `${item.trigger} ${item.prompt} ${item.value}`.toLowerCase().includes(normalized))
      .slice(0, 5)
      .map((item) => ({
        key: `cmd-${item.id}`,
        group: 'Commands',
        title: `${prefix}${item.trigger}`,
        subtitle: item.prompt || item.value || 'Built-in command',
        icon: CommandsIcon,
        run: () => (item.type === 'ai' || item.type === 'style' ? openPlaygroundWith(item.trigger) : navigate('commands')),
      }))

    const providerItems: PaletteAction[] = (snapshot?.providers || [])
      .filter((item) => normalized && `${item.name} ${item.id} ${item.model} ${item.description}`.toLowerCase().includes(normalized))
      .slice(0, 4)
      .map((item) => ({
        key: `prov-${item.id}`,
        group: 'Providers',
        title: item.name,
        subtitle: `${item.model} · ${item.local ? 'Local runtime' : item.freeTier ? 'Free tier ready' : 'Cloud API'}`,
        providerId: item.id,
        run: () => navigate('providers'),
      }))

    return [...screenItems, ...commandItems, ...providerItems]
  }, [navigate, openPlaygroundWith, search, snapshot])

  function handlePaletteKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!paletteActions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setPaletteIndex((prev) => (prev + 1) % paletteActions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setPaletteIndex((prev) => (prev - 1 + paletteActions.length) % paletteActions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = paletteActions[Math.min(paletteIndex, paletteActions.length - 1)]
      chosen?.run()
    }
  }

  async function togglePause() {
    if (!snapshot) return
    const previous = snapshot
    const paused = !snapshot.runtime.paused
    setSnapshot({ ...snapshot, runtime: { ...snapshot.runtime, paused } })
    try {
      const runtime = await api.setPaused(paused)
      setSnapshot((current) => current ? { ...current, runtime } : current)
      notify(paused ? 'Inline commands paused.' : 'Inline commands resumed.', 'success')
    } catch (reason) {
      setSnapshot(previous)
      notify(reason instanceof Error ? reason.message : 'Runtime state could not be changed.', 'danger')
    }
  }

  function changeProvider(provider: Provider, activated: boolean) {
    if (!snapshot) return
    setSnapshot({
      ...snapshot,
      runtime: activated ? { ...snapshot.runtime, provider: provider.id, model: provider.model } : snapshot.runtime,
      providers: snapshot.providers.map((item) => item.id === provider.id
        ? { ...provider, connected: activated || provider.connected }
        : activated ? { ...item, connected: false } : item),
    })
  }

  async function completeOnboarding(providerId: ProviderId, apiKey: string) {
    if (!snapshot) return
    const selected = snapshot.providers.find((provider) => provider.id === providerId)
    if (!selected) throw new Error('The selected provider is unavailable.')
    const saved = await api.saveProvider(selected, apiKey || undefined, true)
    const runtime = await api.saveRuntime({ firstRun: false })
    setSnapshot({
      ...snapshot,
      runtime,
      providers: snapshot.providers.map((provider) => provider.id === providerId
        ? { ...saved, connected: saved.local || saved.keyConfigured }
        : { ...provider, connected: false }),
    })
  }

  if (error) {
    return <div className="fatal-state"><BrandFallback /><h1>SwiftSlate could not open</h1><p>{error}</p><Button variant="primary" onClick={() => window.location.reload()}>Try again</Button></div>
  }

  const theme = snapshot?.runtime.theme || 'lavender'
  const reducedMotion = snapshot?.runtime.reducedMotion || false
  const activeProviderRecord = snapshot?.providers.find((item) => item.id === snapshot.runtime.provider)
  const clampedPaletteIndex = paletteActions.length ? Math.min(paletteIndex, paletteActions.length - 1) : -1

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div
        className="app"
        data-theme={theme}
        data-reduced-motion={reducedMotion || undefined}
        data-panels-hidden={panelsHidden || undefined}
        style={
          {
            '--backdrop-opacity': (backdropIntensity / 100).toFixed(2),
            '--glass-lens-opacity': Math.min(1, 0.35 + (backdropIntensity / 100) * 0.65).toFixed(2),
          } as CSSProperties
        }
      >
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ThemeBackground theme={theme} reducedMotion={reducedMotion} />
        <LiquidGlass
          theme={theme}
          intensity={backdropIntensity / 100}
          hidden={panelsHidden}
          reducedMotion={reducedMotion}
        />
        <Sidebar
          collapsed={collapsed}
          paused={snapshot?.runtime.paused || false}
          hidden={panelsHidden}
          active={page}
          activeProvider={snapshot?.runtime.provider}
          activeProviderName={activeProviderRecord?.name || snapshot?.runtime.provider}
          activeModel={snapshot?.runtime.model}
          onNavigate={navigate}
          onCollapse={() => setCollapsed(!collapsed)}
        />
        <div className="app-main" inert={panelsHidden || undefined}>
          <Topbar
            page={page}
            prefix={snapshot?.runtime.prefix || '.'}
            onSearch={() => { setSearchOpen(true); setPaletteIndex(0) }}
            onHidePanels={hidePanels}
            hideButtonRef={hidePanelsBtnRef}
          />
          <main ref={mainRef} className="content" id="main-content" tabIndex={-1}>
            {!snapshot ? <LoadingShell /> : (
              <div key={page} className="page-motion">
                {page === 'overview' ? <Overview snapshot={snapshot} onTryCommand={openPlaygroundWith} onPause={togglePause} /> : null}
                {page === 'playground' ? <Playground commands={snapshot.commands} prefix={snapshot.runtime.prefix} initialTrigger={playgroundPreset} notify={notify} /> : null}
                {page === 'providers' ? <ProvidersScreen providers={snapshot.providers} activeProvider={snapshot.runtime.provider} onChange={changeProvider} notify={notify} /> : null}
                {page === 'commands' ? <CommandsScreen commands={snapshot.commands} prefix={snapshot.runtime.prefix} onChange={(commands) => setSnapshot({ ...snapshot, commands })} onTryCommand={openPlaygroundWith} notify={notify} /> : null}
                {page === 'styles' ? <StylesScreen prefix={snapshot.runtime.prefix} notify={notify} /> : null}
                {page === 'settings' ? (
                  <SettingsScreen
                    runtime={snapshot.runtime}
                    backdropIntensity={backdropIntensity}
                    onBackdropIntensityChange={setBackdropIntensity}
                    onChange={(runtime) => setSnapshot({ ...snapshot, runtime })}
                    notify={notify}
                  />
                ) : null}
                {page === 'diagnostics' ? <DiagnosticsScreen initial={snapshot.diagnostics} initialLogs={snapshot.logs} notify={notify} /> : null}
              </div>
            )}
          </main>
        </div>

        {panelsHidden ? (
          <button
            ref={showPanelsBtnRef}
            type="button"
            className="backdrop-peek-pill"
            data-glass=""
            data-glass-hot=""
            data-glass-strength="0.48"
            onClick={restorePanels}
            aria-label="Show panels"
          >
            <EyeToggleIcon size={15} strokeWidth={1.85} morphed aria-hidden="true" />
            <span>Show panels</span>
            <kbd aria-hidden="true">Esc</kbd>
          </button>
        ) : null}

        <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search SwiftSlate" description="Jump to a screen, switch providers, or launch a command." size="md">
          <div className="command-palette">
            <div className="palette-search">
              <SearchIcon size={16} strokeWidth={1.85} morphed={Boolean(search)} aria-hidden="true" />
              <input
                data-autofocus=""
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPaletteIndex(0) }}
                onKeyDown={handlePaletteKeyDown}
                placeholder="Search screens and commands…"
              />
              <kbd aria-hidden="true">↵</kbd>
            </div>
            <div className="palette-results">
              {(['Screens', 'Commands', 'Providers'] as const).map((group) => {
                const groupItems = paletteActions
                  .map((item, idx) => ({ item, idx }))
                  .filter(({ item }) => item.group === group)
                if (!groupItems.length) return null
                return (
                  <div key={group} className="palette-group">
                    <span className="palette-heading">{group}</span>
                    {groupItems.map(({ item, idx }) => {
                      const Icon = item.icon
                      const isActive = idx === clampedPaletteIndex
                      return (
                        <button
                          type="button"
                          key={item.key}
                          className={cn(isActive && 'palette-item-active')}
                          onMouseEnter={() => setPaletteIndex(idx)}
                          onClick={item.run}
                        >
                          {item.providerId ? (
                            <span className={cn('palette-provider-tile', getProviderTileClass(item.providerId))} aria-hidden="true">
                              <ProviderLogo id={item.providerId} size={15} />
                            </span>
                          ) : Icon ? (
                            <span className="palette-icon-tile" aria-hidden="true"><Icon size={16} strokeWidth={1.85} morphed={isActive} /></span>
                          ) : null}
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.subtitle}</small>
                          </div>
                          <ArrowUpRightIcon size={14} strokeWidth={1.85} morphed={isActive} className="palette-enter-icon" aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
              {!paletteActions.length ? <div className="palette-empty">No results for “{search}”</div> : null}
            </div>
          </div>
        </Modal>

        {snapshot ? <Onboarding open={snapshot.runtime.firstRun || new URLSearchParams(window.location.search).has('onboarding')} providers={snapshot.providers} onComplete={completeOnboarding} /> : null}
        <Toasts items={toasts} />
      </div>
    </MotionConfig>
  )
}

function BrandFallback() {
  return <span className="brand-mark brand-mark-large"><BrandLogo size={52} /></span>
}
