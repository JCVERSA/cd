import { motion } from 'motion/react'
import {
  ChevronRightIcon,
  CommandsIcon,
  DiagnosticsIcon,
  OverviewIcon,
  PlaygroundIcon,
  ProvidersIcon,
  SettingsIcon,
  SidebarToggleIcon,
  StylesIcon,
} from '../icons'
import type { PageId, ProviderId } from '../types'
import { BrandLogo } from './BrandLogo'
import { ProviderLogo, getProviderTileClass } from './ProviderLogo'
import { cn } from './ui'

const nav: Array<{ id: PageId; label: string; icon: typeof OverviewIcon; dividerBefore?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: OverviewIcon },
  { id: 'playground', label: 'Playground', icon: PlaygroundIcon },
  { id: 'providers', label: 'Providers', icon: ProvidersIcon, dividerBefore: true },
  { id: 'commands', label: 'Commands', icon: CommandsIcon },
  { id: 'styles', label: 'Styles', icon: StylesIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, dividerBefore: true },
  { id: 'diagnostics', label: 'Diagnostics', icon: DiagnosticsIcon },
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
          const isCurrent = active === item.id
          return (
            <div key={item.id} className="nav-group-item">
              {item.dividerBefore ? <span className="nav-divider" aria-hidden="true" /> : null}
              <button
                type="button"
                className={cn('nav-item', isCurrent && 'nav-item-active')}
                onClick={() => onNavigate(item.id)}
                aria-current={isCurrent ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                {isCurrent ? (
                  <motion.span
                    layoutId="active-nav"
                    className="nav-active-pill"
                    transition={{ type: 'spring', duration: 0.26, bounce: 0.08 }}
                  />
                ) : null}
                <Icon size={18} strokeWidth={1.85} morphed={isCurrent} aria-hidden="true" />
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
          <ChevronRightIcon size={14} strokeWidth={1.85} className={cn('sidebar-pod-arrow', collapsed && 'nav-label-hidden')} aria-hidden="true" />
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
        <span className="collapse-chevron" aria-hidden="true">
          <SidebarToggleIcon size={17} strokeWidth={1.85} morphed={collapsed} />
        </span>
        <span className={cn(collapsed && 'nav-label-hidden')}>Collapse rail</span>
      </button>
    </aside>
  )
}
