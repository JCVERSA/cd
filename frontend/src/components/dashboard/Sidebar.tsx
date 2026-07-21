import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';
import {
  Cloud, LayoutDashboard, Server, ScrollText, FileText, HardDrive, Image,
  Lock, Bookmark, Settings, ChevronLeft, ChevronRight, User, ShieldCheck, LogOut
} from 'lucide-react';

export type Page = 'overview' | 'services' | 'logs' | 'notes' | 'files' | 'gallery' | 'vault' | 'bookmarks' | 'settings' | 'admin';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  session: {
    username: string;
    role: 'admin' | 'user';
    quotaBytes: number;
    usedBytes: number;
  };
  onLogout: () => void;
}

export default function Sidebar({ currentPage, onNavigate, session, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems: { id: Page; label: string; icon: React.ElementType; color?: string; adminOnly?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'logs', label: 'Live Logs', icon: ScrollText },
    { id: 'notes', label: 'Notes', icon: FileText, color: 'text-amber-400' },
    { id: 'files', label: 'Files', icon: HardDrive, color: 'text-violet-400' },
    { id: 'gallery', label: 'Gallery', icon: Image, color: 'text-pink-400' },
    { id: 'vault', label: 'Vault', icon: Lock, color: 'text-red-400' },
    { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, color: 'text-indigo-400' },
    { id: 'admin', label: 'Admin Panel', icon: ShieldCheck, color: 'text-emerald-400', adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredItems = navItems.filter(item => !item.adminOnly || session.role === 'admin');

  // Convert bytes to MB/GB helpers
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const quotaPercent = Math.min(100, Math.round((session.usedBytes / session.quotaBytes) * 100)) || 0;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-surface-900/80 backdrop-blur-xl border-r border-surface-800/60"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-surface-800/60 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-500/20">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-lg font-bold text-white whitespace-nowrap overflow-hidden"
              >
                Mini<span className="text-brand-400">Cloud</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-1">
        {filteredItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                isActive
                  ? 'bg-brand-600/15 text-white'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              )}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-500 rounded-r-full"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <item.icon className={cn(
                'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                isActive ? 'text-brand-400' : (item.color || 'text-surface-500 group-hover:text-surface-300')
              )} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-surface-800/60 p-2.5 space-y-2 flex-shrink-0">
        {/* Dynamic Quota Indicator */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-1 space-y-1"
            >
              <div className="flex justify-between text-[10px] text-surface-400">
                <span>Storage Quota</span>
                <span>{quotaPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-purple-600 transition-all duration-300 rounded-full"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="text-[9px] text-surface-500 text-right">
                {formatBytes(session.usedBytes)} of {formatBytes(session.quotaBytes)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Card */}
        <div className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-800/30 border border-surface-800/20',
          collapsed ? 'justify-center' : ''
        )}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="text-xs font-semibold text-white truncate">{session.username}</p>
                <p className="text-[10px] text-surface-500 truncate capitalize">{session.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 transition-all text-xs"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
