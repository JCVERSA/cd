import { MoonStar, Pause, Play, Search } from 'lucide-react'
import type { PageId } from '../types'
import { Button } from './ui'

const titles: Record<PageId, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Runtime and recent activity' },
  playground: { title: 'Playground', subtitle: 'Try a command without changing another app' },
  providers: { title: 'Providers', subtitle: 'Models, endpoints, and protected credentials' },
  commands: { title: 'Commands', subtitle: 'Create and organize inline triggers' },
  styles: { title: 'Local styles', subtitle: 'Preview offline Unicode transformations' },
  settings: { title: 'Settings', subtitle: 'Startup, behavior, and appearance' },
  diagnostics: { title: 'Diagnostics', subtitle: 'Health checks and local logs' },
}

export function Topbar({
  page,
  paused,
  onPause,
  onSearch,
  onTheme,
}: {
  page: PageId
  paused: boolean
  onPause: () => void
  onSearch: () => void
  onTheme: () => void
}) {
  const current = titles[page]
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>SwiftSlate</span>
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <div>
          <h1>{current.title}</h1>
          <p>{current.subtitle}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="search-trigger" type="button" onClick={onSearch} aria-label="Search SwiftSlate (Ctrl+K)">
          <Search size={16} strokeWidth={1.85} aria-hidden="true" />
          <span>Search</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon"
          icon={<MoonStar size={18} strokeWidth={1.85} aria-hidden="true" />}
          aria-label="Change color theme"
          onClick={onTheme}
        />
        <span className="topbar-divider" aria-hidden="true" />
        <Button
          variant={paused ? 'primary' : 'secondary'}
          size="sm"
          icon={paused ? <Play size={16} strokeWidth={1.85} aria-hidden="true" /> : <Pause size={16} strokeWidth={1.85} aria-hidden="true" />}
          onClick={onPause}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </header>
  )
}
