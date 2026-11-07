import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Command,
  Gauge,
  Palette,
  Settings,
  TerminalSquare,
} from 'lucide-react'
import { motion } from 'motion/react'
import type { PageId, ProviderId } from '../types'
import { BrandLogo } from './BrandLogo'
import { ProviderLogo, getProviderTileClass } from './ProviderLogo'
import { cn } from './ui'

const nav: Array<{ id: PageId; label: string; icon: typeof Gauge; dividerBefore?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'playground', label: 'Playground', icon: TerminalSquare },
  { id: 'providers', label: 'Providers', icon: Bot, dividerBefore: true },
  { id: 'commands', label: 'Commands', icon: Command },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'settings', label: 'Settings', icon: Settings, dividerBefore: true },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
]

export function Sidebar({
  collapsed,
  paused = false,
  active,
  activeProvider = 'gemini',
  activeProviderName = 'Google Gemini',
  activeModel = 'gemini-2.5-flash',
  onNavigate,
  onCollapse,
}: {
  collapsed: boolean
  paused?: boolean
  active: PageId
  activeProvider?: ProviderId | string
  activeProviderName?: string
  activeModel?: string
  onNavigate: (page: PageId) => void
  onCollapse: () => void
}) {
  return (
    <aside className={cn('sidebar', collapsed && 'sidebar-collapsed')} aria-label="Workspace sidebar">
      <div className="brand">
        <span className="brand-mark">
          <BrandLogo size={34} />
        </span>
        <div className={cn('brand-copy', collapsed && 'nav-label-hidden')} aria-hidden={collapsed}>
          <strong>SwiftSlate</strong>
          <span>Inline writing engine</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.id} className="nav-group-item">
              {item.dividerBefore ? <span className="nav-divider" aria-hidden="true" /> : null}
              <button
                type="button"
                className={cn('nav-item', active === item.id && 'nav-item-active')}
                onClick={() => onNavigate(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                {active === item.id ? (
                  <motion.span
                    layoutId="active-nav"
                    className="nav-active-pill"
                    transition={{ type: 'spring', duration: 0.26, bounce: 0.08 }}
                  />
                ) : null}
                <Icon size={18} strokeWidth={1.85} aria-hidden="true" />
                <span className={cn('nav-label', collapsed && 'nav-label-hidden')}>{item.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-dock">
        <button
          type="button"
          className="sidebar-provider-pod"
          onClick={() => onNavigate('providers')}
          aria-label={`Active model: ${activeProviderName} (${activeModel}). Switch engine`}
          title={collapsed ? `${activeProviderName} · ${activeModel}` : undefined}
        >
          <span className={cn('sidebar-provider-mark', getProviderTileClass(activeProvider))}>
            <ProviderLogo id={activeProvider} size={15} />
          </span>
          <span className={cn('sidebar-provider-copy', collapsed && 'nav-label-hidden')}>
            <strong>{activeProviderName}</strong>
            <span>{activeModel || 'Select model'}</span>
          </span>
          <ChevronRight size={14} strokeWidth={1.85} className={cn('sidebar-pod-arrow', collapsed && 'nav-label-hidden')} aria-hidden="true" />
        </button>

        <div className="sidebar-runtime">
          <div className="mini-status">
            <span className={cn('status-orbit', paused && 'status-orbit-paused')} aria-hidden="true">
              <span />
            </span>
            <div className={cn('mini-status-copy', collapsed && 'nav-label-hidden')}>
              <strong>{paused ? 'Engine paused' : 'Engine active'}</strong>
              <span>{paused ? 'Triggers suspended' : 'Listening globally'}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="collapse-button"
        onClick={onCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className={cn('collapse-chevron', collapsed && 'collapse-chevron-rotated')} aria-hidden="true">
          <ChevronLeft size={16} strokeWidth={1.85} />
        </span>
        <span className={cn(collapsed && 'nav-label-hidden')}>Collapse rail</span>
      </button>
    </aside>
  )
}
