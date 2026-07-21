import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, HardDrive, Ban, Trash2, Shield, RefreshCcw, AlertCircle, X, ShieldAlert, CheckCircle2
} from 'lucide-react';

interface User {
  username: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  quotaBytes: number;
  usedBytes: number;
  createdAt: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalUsedBytes: number;
  quotaTotalBytes: number;
  perServiceBytes: {
    files: number;
    notes: number;
    gallery: number;
    vault: number;
    bookmarks: number;
  };
}

interface AdminPanelProps {
  session: {
    username: string;
    role: 'admin' | 'user';
  };
}

export default function AdminPanel({ session }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Modals & form states
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newQuotaMB, setNewQuotaMB] = useState(100);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error fetching users', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching admin stats', err);
    }
  };

  const loadAll = async () => {
    await Promise.all([fetchUsers(), fetchStats()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newUsername.trim() || !newPassword.trim()) {
      setAddError('Username and password are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          quotaMB: Number(newQuotaMB),
          status: 'active',
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewRole('user');
        setNewQuotaMB(100);
        setIsOpenAddModal(false);
        await loadAll();
      } else {
        const data = await res.json();
        setAddError(data.error || 'Failed to create user.');
      }
    } catch (err) {
      setAddError('Network error during user creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        await loadAll();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user status.');
      }
    } catch (err) {
      console.error('Error toggling status', err);
    }
  };

  const handleDeleteUser = async (username: string) => {
    const confirmation = confirm(
      `⚠️ WARNING: Are you sure you want to permanently delete user "${username}"?\n\nThis action will immediately destroy this user's account and completely wipe all of their data (files, notes, pictures, passwords, bookmarks) from the server directory. This action is irreversible!`
    );
    if (!confirmation) return;

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await loadAll();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error('Error deleting user', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6 panel-enter">
      {/* Top statistics grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-surface-400 font-medium">Total Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
            <p className="text-[10px] text-surface-500 mt-1">{stats.activeUsers} active sessions</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-surface-400 font-medium">Global Disk Usage</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatBytes(stats.totalUsedBytes)}</p>
            <p className="text-[10px] text-surface-500 mt-1">Across all user directories</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-surface-400 font-medium">Server Capacity</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatBytes(stats.quotaTotalBytes)}</p>
            <p className="text-[10px] text-surface-500 mt-1">Sum of allocated quotas</p>
          </div>
          <div
            onClick={() => setIsOpenAddModal(true)}
            className="glass-card rounded-xl p-4 border border-dashed border-emerald-500/20 hover:border-emerald-500/40 flex flex-col items-center justify-center cursor-pointer transition-all"
          >
            <UserPlus className="w-6 h-6 text-emerald-400 mb-1" />
            <p className="text-xs font-semibold text-white">Create Account</p>
          </div>
        </div>
      )}

      {/* Stats details by services */}
      {stats && (
        <div className="glass-card rounded-2xl p-5">
          <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4">Storage allocation per microservice</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Files', bytes: stats.perServiceBytes.files, color: 'bg-violet-500' },
              { label: 'Notes', bytes: stats.perServiceBytes.notes, color: 'bg-amber-500' },
              { label: 'Gallery', bytes: stats.perServiceBytes.gallery, color: 'bg-pink-500' },
              { label: 'Vault', bytes: stats.perServiceBytes.vault, color: 'bg-red-500' },
              { label: 'Bookmarks', bytes: stats.perServiceBytes.bookmarks, color: 'bg-indigo-500' },
            ].map(srv => (
              <div key={srv.label} className="bg-surface-800/30 rounded-xl p-3 border border-surface-800/40">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${srv.color}`} />
                  <span className="text-[10px] text-surface-400 font-semibold">{srv.label}</span>
                </div>
                <p className="text-sm font-bold text-white">{formatBytes(srv.bytes)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-surface-700/30">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-white">Registered Accounts</h3>
          </div>
          <button
            onClick={loadAll}
            className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
            title="Refresh Users"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Users Table Header */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 text-[10px] text-surface-500 uppercase tracking-wider font-semibold border-b border-surface-800/40 bg-surface-900/30">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Disk Used</div>
          <div className="col-span-2">Quota</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Users Table Rows */}
        <div className="divide-y divide-surface-800/30">
          {users.map((u, i) => {
            const isSelf = u.username === session.username;
            return (
              <motion.div
                key={u.username}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-1 sm:grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-surface-800/20 transition-colors"
              >
                {/* Username */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center font-bold text-sm text-surface-300">
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {u.username} {isSelf && <span className="text-[10px] text-brand-400 font-medium">(you)</span>}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Created: {formatDate(u.createdAt)}</p>
                  </div>
                </div>

                {/* Role Badge */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                    u.role === 'admin'
                      ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                      : 'bg-surface-800 border-surface-700 text-surface-400'
                  }`}>
                    {u.role}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                    u.status === 'active'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {u.status}
                  </span>
                </div>

                {/* Disk Used */}
                <div className="col-span-2">
                  <p className="text-xs text-white font-medium">{formatBytes(u.usedBytes)}</p>
                  <p className="text-[9px] text-surface-500 mt-0.5">
                    {Math.min(100, Math.round((u.usedBytes / u.quotaBytes) * 100))}% of quota
                  </p>
                </div>

                {/* Quota limit */}
                <div className="col-span-2">
                  <span className="text-xs text-surface-300 font-medium">{formatBytes(u.quotaBytes)}</span>
                </div>

                {/* Action buttons */}
                <div className="col-span-1 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleToggleStatus(u)}
                    disabled={isSelf}
                    className={`p-1.5 rounded-lg transition-all ${
                      isSelf
                        ? 'opacity-30 cursor-not-allowed text-surface-600'
                        : u.status === 'active'
                        ? 'hover:bg-red-500/10 text-surface-500 hover:text-red-400'
                        : 'hover:bg-emerald-500/10 text-surface-500 hover:text-emerald-400'
                    }`}
                    title={isSelf ? 'Cannot suspend self' : u.status === 'active' ? 'Suspend Account' : 'Activate Account'}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.username)}
                    disabled={isSelf}
                    className={`p-1.5 rounded-lg transition-all ${
                      isSelf
                        ? 'opacity-30 cursor-not-allowed text-surface-600'
                        : 'hover:bg-red-500/10 text-surface-500 hover:text-red-400'
                    }`}
                    title={isSelf ? 'Cannot delete self' : 'Permanently Delete User'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isOpenAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-900 border border-surface-800/60 rounded-3xl w-full max-w-md p-6 relative overflow-hidden shadow-2xl"
            >
              <button
                onClick={() => setIsOpenAddModal(false)}
                className="absolute top-4 right-4 p-2 text-surface-400 hover:text-white rounded-lg hover:bg-surface-800"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> Create Member Account
              </h3>

              {addError && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="john_doe"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as 'admin' | 'user')}
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  >
                    <option value="user">Member (Default)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Storage Quota (MB)</label>
                  <input
                    type="number"
                    required
                    value={newQuotaMB}
                    onChange={e => setNewQuotaMB(Number(e.target.value))}
                    placeholder="100"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 font-bold text-white rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
