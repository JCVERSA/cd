import { Palette, Pause, Play, Search } from 'lucide-react'
import type { PageId } from '../types'
import { Button } from './ui'

const titles: Record<PageId, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Live engine telemetry and routing' },
  playground: { title: 'Playground', subtitle: 'Test commands safely in a split buffer' },
  providers: { title: 'Providers', subtitle: '16 cloud and local model backends' },
  commands: { title: 'Commands', subtitle: 'Inline triggers across Windows apps' },
  styles: { title: 'Local styles', subtitle: 'Zero-network Unicode type foundry' },
  settings: { title: 'Settings', subtitle: 'Trigger timing, startup, and theme' },
  diagnostics: { title: 'Diagnostics', subtitle: 'Local health matrix and debug stream' },
}

export function Topbar({
  page,
  paused,
  prefix = '.',
  onPause,
  onSearch,
  onTheme,
}: {
  page: PageId
  paused: boolean
  prefix?: string
  onPause: () => void
  onSearch: () => void
  onTheme: () => void
}) {
  const current = titles[page]
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1>{current.title}</h1>
        <span className="topbar-sep" aria-hidden="true" />
        <p>{current.subtitle}</p>
      </div>
      <div className="topbar-actions">
        <span className="prefix-pill" title={`Current inline trigger prefix (${prefix})`}>
          <span>Prefix</span>
          <code>{prefix}fix</code>
        </span>
        <button className="search-trigger" type="button" onClick={onSearch} aria-label="Search SwiftSlate (Ctrl+K)">
          <Search size={15} strokeWidth={1.85} aria-hidden="true" />
          <span>Jump or run…</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          icon={<Palette size={17} strokeWidth={1.85} aria-hidden="true" />}
          aria-label="Change color theme"
          onClick={onTheme}
        />
        <span className="topbar-divider" aria-hidden="true" />
        <Button
          variant={paused ? 'primary' : 'secondary'}
          size="sm"
          icon={paused ? <Play size={15} strokeWidth={1.85} aria-hidden="true" /> : <Pause size={15} strokeWidth={1.85} aria-hidden="true" />}
          onClick={onPause}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </header>
  )
}
