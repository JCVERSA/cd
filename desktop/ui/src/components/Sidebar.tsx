import {
  Activity,
  Bot,
  ChevronLeft,
  Command,
  Gauge,
  Palette,
  Settings,
  TerminalSquare,
} from 'lucide-react'
import { motion } from 'motion/react'
import type { PageId } from '../types'
import { BrandLogo } from './BrandLogo'
import { cn } from './ui'

const nav: Array<{ id: PageId; label: string; icon: typeof Gauge; section?: string }> = [
  { id: 'overview', label: 'Overview', icon: Gauge, section: 'Workspace' },
  { id: 'playground', label: 'Playground', icon: TerminalSquare },
  { id: 'providers', label: 'Providers', icon: Bot, section: 'Configure' },
  { id: 'commands', label: 'Commands', icon: Command },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'System' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
]

export function Sidebar({
  collapsed,
  active,
  onNavigate,
  onCollapse,
}: {
  collapsed: boolean
  active: PageId
  onNavigate: (page: PageId) => void
  onCollapse: () => void
}) {
  return (
    <motion.aside
      className={cn('sidebar', collapsed && 'sidebar-collapsed')}
      animate={{ width: collapsed ? 68 : 244 }}
      transition={{ type: 'spring', stiffness: 330, damping: 36 }}
    >
      <div className="brand">
        <span className="brand-mark">
          <BrandLogo size={34} />
        </span>
        <motion.div
          className="brand-copy"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          aria-hidden={collapsed}
        >
          <strong>SwiftSlate</strong>
          <span>Write at light speed</span>
        </motion.div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.id} className="nav-group-item">
              {item.section ? <span className={cn('nav-section', collapsed && 'sr-only')}>{item.section}</span> : null}
              <button
                type="button"
                className={cn('nav-item', active === item.id && 'nav-item-active')}
                onClick={() => onNavigate(item.id)}
                aria-current={active === item.id ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                {active === item.id ? <motion.span layoutId="active-nav" className="nav-active-pill" /> : null}
                <Icon size={18} strokeWidth={1.8} />
                <span className={cn('nav-label', collapsed && 'nav-label-hidden')}>{item.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-runtime">
        <div className="mini-status">
          <span className="status-orbit"><span /></span>
          <div className={cn('mini-status-copy', collapsed && 'nav-label-hidden')}>
            <strong>Engine active</strong>
            <span>Listening globally</span>
          </div>
        </div>
      </div>

      <button type="button" className="collapse-button" onClick={onCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
          <ChevronLeft size={16} />
        </motion.span>
        <span className={cn(collapsed && 'nav-label-hidden')}>Collapse</span>
      </button>
    </motion.aside>
  )
}
