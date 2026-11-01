import {
  Activity,
  Bot,
  Command,
  Gauge,
  Palette,
  Search,
  Settings,
  TerminalSquare,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Onboarding } from './components/Onboarding'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Button, Modal, Skeleton, Toasts, type ToastItem } from './components/ui'
import { CommandsScreen } from './screens/Commands'
import { DiagnosticsScreen } from './screens/Diagnostics'
import { Overview } from './screens/Overview'
import { Playground } from './screens/Playground'
import { ProvidersScreen } from './screens/Providers'
import { SettingsScreen } from './screens/Settings'
import { StylesScreen } from './screens/Styles'
import type { AppSnapshot, PageId, Provider, ProviderId, ThemeId } from './types'

const pages: Array<{ id: PageId; label: string; description: string; icon: typeof Gauge }> = [
  { id: 'overview', label: 'Overview', description: 'Runtime and activity', icon: Gauge },
  { id: 'playground', label: 'Playground', description: 'Try a command', icon: TerminalSquare },
  { id: 'providers', label: 'Providers', description: 'Models and credentials', icon: Bot },
  { id: 'commands', label: 'Commands', description: 'Inline trigger library', icon: Command },
  { id: 'styles', label: 'Styles', description: 'Offline text styles', icon: Palette },
  { id: 'settings', label: 'Settings', description: 'Behavior and appearance', icon: Settings },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Health checks and logs', icon: Activity },
]

const themeOptions: Array<{ id: ThemeId; name: string; color: string }> = [
  { id: 'lavender', name: 'Sparkle Lavender', color: '#d9c7ff' },
  { id: 'amber', name: 'Cyber Amber', color: '#ffc76b' },
  { id: 'sapphire', name: 'Sapphire', color: '#88b8ff' },
  { id: 'emerald', name: 'Emerald', color: '#75e5bc' },
  { id: 'rose', name: 'Rose', color: '#ffafc8' },
]

function LoadingShell() {
  return (
    <div className="loading-screen">
      <Skeleton className="loading-hero" />
      <div className="loading-row"><Skeleton/><Skeleton/><Skeleton/><Skeleton/></div>
      <div className="loading-columns"><Skeleton/><Skeleton/></div>
    </div>
  )
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<PageId>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [error, setError] = useState('')
  const toastId = useRef(0)

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
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setThemeOpen(false)
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [])

  const navigate = useCallback((next: PageId) => {
    setPage(next)
    setSearchOpen(false)
    setSearch('')
  }, [])

  const searchResults = useMemo(() => {
    const normalized = search.toLowerCase().trim()
    const pageItems = pages.filter((item) => !normalized || `${item.label} ${item.description}`.toLowerCase().includes(normalized))
    const commandItems = (snapshot?.commands || []).filter((item) => normalized && `${item.trigger} ${item.prompt}`.toLowerCase().includes(normalized)).slice(0, 5)
    return { pageItems, commandItems }
  }, [search, snapshot])

  async function togglePause() {
    if (!snapshot) return
    const paused = !snapshot.runtime.paused
    setSnapshot({ ...snapshot, runtime: { ...snapshot.runtime, paused } })
    try {
      const runtime = await api.setPaused(paused)
      setSnapshot((current) => current ? { ...current, runtime } : current)
      notify(paused ? 'Inline commands paused.' : 'Inline commands resumed.', 'success')
    } catch (reason) {
      setSnapshot({ ...snapshot })
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

  function changeTheme(theme: ThemeId) {
    if (!snapshot) return
    const runtime = { ...snapshot.runtime, theme }
    setSnapshot({ ...snapshot, runtime })
    setThemeOpen(false)
    void api.saveRuntime({ theme }).catch(() => undefined)
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
    return <div className="fatal-state"><SparklesFallback/><h1>SwiftSlate could not open</h1><p>{error}</p><Button variant="primary" onClick={() => window.location.reload()}>Try again</Button></div>
  }

  const theme = snapshot?.runtime.theme || 'lavender'
  const reducedMotion = snapshot?.runtime.reducedMotion || false

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className="app" data-theme={theme} data-reduced-motion={reducedMotion || undefined}>
        <div className="ambient" aria-hidden="true"><span className="blob blob-one"/><span className="blob blob-two"/><span className="blob blob-three"/></div>
        <Sidebar collapsed={collapsed} active={page} onNavigate={navigate} onCollapse={() => setCollapsed(!collapsed)} />
        <div className="app-main">
          <Topbar page={page} paused={snapshot?.runtime.paused || false} onPause={togglePause} onSearch={() => setSearchOpen(true)} onTheme={() => setThemeOpen(true)} />
          <main className="content" id="main-content">
            {!snapshot ? <LoadingShell/> : (
              <AnimatePresence mode="wait">
                <motion.div key={page} className="page-motion" initial={{ opacity: 0, y: 12, scale: 0.995 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ type: 'spring', stiffness: 310, damping: 31 }}>
                  {page === 'overview' ? <Overview snapshot={snapshot} onNavigate={navigate} onPause={togglePause}/> : null}
                  {page === 'playground' ? <Playground commands={snapshot.commands} notify={notify}/> : null}
                  {page === 'providers' ? <ProvidersScreen providers={snapshot.providers} activeProvider={snapshot.runtime.provider} onChange={changeProvider} notify={notify}/> : null}
                  {page === 'commands' ? <CommandsScreen commands={snapshot.commands} prefix={snapshot.runtime.prefix} onChange={(commands) => setSnapshot({ ...snapshot, commands })} notify={notify}/> : null}
                  {page === 'styles' ? <StylesScreen prefix={snapshot.runtime.prefix} notify={notify}/> : null}
                  {page === 'settings' ? <SettingsScreen runtime={snapshot.runtime} onChange={(runtime) => setSnapshot({ ...snapshot, runtime })} notify={notify}/> : null}
                  {page === 'diagnostics' ? <DiagnosticsScreen initial={snapshot.diagnostics} initialLogs={snapshot.logs} notify={notify}/> : null}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search SwiftSlate" description="Jump to a screen or find a command." size="md">
          <div className="command-palette">
            <div className="palette-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search screens and commands…" autoFocus/></div>
            <div className="palette-results">
              {searchResults.pageItems.length ? <span className="palette-heading">Screens</span> : null}
              {searchResults.pageItems.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} onClick={() => navigate(item.id)}><span><Icon size={16}/></span><div><strong>{item.label}</strong><small>{item.description}</small></div></button> })}
              {searchResults.commandItems.length ? <span className="palette-heading">Commands</span> : null}
              {searchResults.commandItems.map((item) => <button type="button" key={item.id} onClick={() => navigate('commands')}><span><Command size={16}/></span><div><strong>.{item.trigger}</strong><small>{item.prompt || item.value}</small></div></button>)}
              {!searchResults.pageItems.length && !searchResults.commandItems.length ? <div className="palette-empty">No results for “{search}”</div> : null}
            </div>
          </div>
        </Modal>

        <Modal open={themeOpen} onClose={() => setThemeOpen(false)} title="Choose a theme" description="The dark surfaces stay consistent; only the product accent changes." size="sm">
          <div className="theme-modal-list">
            {themeOptions.map((item) => <button key={item.id} type="button" className={theme === item.id ? 'active' : ''} onClick={() => changeTheme(item.id)}><i style={{ background: item.color }}/><strong>{item.name}</strong>{theme === item.id ? <span>Active</span> : null}</button>)}
          </div>
        </Modal>

        {snapshot ? <Onboarding open={snapshot.runtime.firstRun || new URLSearchParams(window.location.search).has('onboarding')} providers={snapshot.providers} onComplete={completeOnboarding}/> : null}
        <Toasts items={toasts}/>
      </div>
    </MotionConfig>
  )
}

function SparklesFallback() {
  return <span className="brand-mark"><Gauge size={20}/></span>
}
