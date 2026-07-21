import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Menu, X, LogOut } from 'lucide-react';
import type { Page } from './Sidebar';

const pageLabels: Record<Page, string> = {
  overview: 'Dashboard Overview',
  services: 'Service Manager',
  logs: 'Live Logs',
  notes: 'Notes',
  files: 'File Storage',
  gallery: 'Photo Gallery',
  vault: 'Password Vault',
  bookmarks: 'Bookmarks',
  admin: 'Admin Panel',
  settings: 'Settings',
};

interface TopBarProps {
  currentPage: Page;
  onMobileMenu: () => void;
  mobileMenuOpen: boolean;
  onLogout: () => void;
}

export default function TopBar({ currentPage, onMobileMenu, mobileMenuOpen, onLogout }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-6 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/40">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenu}
          className="lg:hidden p-2 -ml-2 text-surface-400 hover:text-white transition-colors rounded-lg hover:bg-surface-800/50"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div>
          <h1 className="text-base lg:text-lg font-semibold text-white">{pageLabels[currentPage]}</h1>
          <p className="text-xs text-surface-500 hidden sm:block">minicloud-prod &middot; All systems operational</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <button
            onClick={() => { setSearchOpen(!searchOpen); setNotifOpen(false); }}
            className="p-2 text-surface-400 hover:text-white transition-colors rounded-lg hover:bg-surface-800/50"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-72 sm:w-80 glass-card rounded-xl p-3 shadow-2xl shadow-black/30"
              >
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/50 border border-surface-700/50">
                  <Search className="w-4 h-4 text-surface-500" />
                  <input
                    type="text"
                    placeholder="Search services, notes, files..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 outline-none"
                    autoFocus
                  />
                  <kbd className="hidden sm:inline text-[10px] text-surface-500 bg-surface-700/50 px-1.5 py-0.5 rounded">⌘K</kbd>
                </div>
                <div className="mt-2 p-2 text-xs text-surface-500 text-center">Type to search across all services</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setSearchOpen(false); }}
            className="p-2 text-surface-400 hover:text-white transition-colors rounded-lg hover:bg-surface-800/50 relative"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-72 sm:w-80 glass-card rounded-xl shadow-2xl shadow-black/30 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-surface-700/40">
                  <p className="text-sm font-semibold text-white">Notifications</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {[
                    { msg: 'mc-files restarted (auto-recovery)', time: '2m ago', type: 'warn' },
                    { msg: 'Backup completed successfully', time: '1h ago', type: 'success' },
                    { msg: 'Storage usage reached 78%', time: '3h ago', type: 'warn' },
                    { msg: 'SSL certificate renewed', time: '1d ago', type: 'success' },
                  ].map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-surface-800/30 transition-colors border-b border-surface-800/20 last:border-0">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${n.type === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div>
                          <p className="text-xs text-surface-300">{n.msg}</p>
                          <p className="text-[10px] text-surface-500 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-online" />
          <span className="text-xs font-medium text-emerald-400">8/8 Online</span>
        </div>

        {/* Mobile logout */}
        <button
          onClick={onLogout}
          className="lg:hidden p-2 text-surface-400 hover:text-red-400 transition-colors rounded-lg hover:bg-surface-800/50"
          title="Logout"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
