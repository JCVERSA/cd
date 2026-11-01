import { Bell, Command, MoonStar, Pause, Play, Search } from 'lucide-react'
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
        <span className="breadcrumb-separator">/</span>
        <div>
          <h1>{current.title}</h1>
          <p>{current.subtitle}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="search-trigger" type="button" onClick={onSearch}>
          <Search size={16} />
          <span>Search</span>
          <kbd><Command size={11} />K</kbd>
        </button>
        <Button variant="ghost" size="icon" icon={<MoonStar size={18} />} aria-label="Change color theme" onClick={onTheme} />
        <Button variant="ghost" size="icon" icon={<Bell size={18} />} aria-label="Notifications" />
        <span className="topbar-divider" />
        <Button
          variant={paused ? 'primary' : 'secondary'}
          size="sm"
          icon={paused ? <Play size={15} /> : <Pause size={15} />}
          onClick={onPause}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
    </header>
  )
}
