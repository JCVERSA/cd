import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, LayoutDashboard, Server, ScrollText, FileText, HardDrive, Image,
  Lock, Bookmark, Settings, X, User, ShieldCheck, LogOut
} from 'lucide-react';
import type { Page } from './Sidebar';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function MobileSidebar({ isOpen, onClose, currentPage, onNavigate, session, onLogout }: MobileSidebarProps) {
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-surface-900 border-r border-surface-800/60 flex flex-col lg:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-surface-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">
                  Mini<span className="text-brand-400">Cloud</span>
                </span>
              </div>
              <button onClick={onClose} className="p-2 text-surface-400 hover:text-white rounded-lg hover:bg-surface-800/50">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quota bar */}
            <div className="px-5 py-3 border-b border-surface-800/40 space-y-1.5">
              <div className="flex justify-between text-[10px] text-surface-400">
                <span>Storage Quota</span>
                <span>{quotaPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-purple-600 rounded-full"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <div className="text-[9px] text-surface-500 text-right">
                {formatBytes(session.usedBytes)} of {formatBytes(session.quotaBytes)}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {filteredItems.map((item, i) => {
                const isActive = currentPage === item.id;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-600/15 text-white'
                        : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-brand-400' : (item.color || 'text-surface-500')}`} />
                    {item.label}
                  </motion.button>
                );
              })}
            </nav>

            {/* User card with logout */}
            <div className="border-t border-surface-800/60 p-3">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-surface-800/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{session.username}</p>
                    <p className="text-[10px] text-surface-500 truncate capitalize">{session.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => { onLogout(); onClose(); }}
                  title="Logout"
                  className="p-1.5 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
