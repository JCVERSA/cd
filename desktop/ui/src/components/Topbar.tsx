import { SearchIcon } from '../icons'
import type { PageId } from '../types'

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
  prefix = '.',
  onSearch,
}: {
  page: PageId
  prefix?: string
  onSearch: () => void
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
          <SearchIcon size={15} strokeWidth={1.85} aria-hidden="true" />
          <span>Jump or run…</span>
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
      </div>
    </header>
  )
}
