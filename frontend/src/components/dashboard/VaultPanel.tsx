import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Search, Plus, Copy, Eye, EyeOff, Shield, Key, CheckCircle2, ExternalLink, Trash2, X, AlertCircle
} from 'lucide-react';

interface VaultEntry {
  id: string;
  title: string;
  site: string;
  username: string;
  createdAt: number;
  updatedAt: number;
}

export default function VaultPanel() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Real reveal states
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [revealedNotes, setRevealedNotes] = useState<string | null>(null);
  const [loadingRevealId, setLoadingRevealId] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New entry modal states
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSite, setNewSite] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEntries = async () => {
    try {
      const res = await fetch('/api/vault', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching vault entries', err);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleReveal = async (id: string) => {
    if (revealedId === id) {
      // Already revealed, close it
      setRevealedId(null);
      setRevealedSecret(null);
      setRevealedNotes(null);
      return;
    }

    setLoadingRevealId(id);
    try {
      const res = await fetch(`/api/vault/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRevealedId(id);
        setRevealedSecret(data.entry.secret);
        setRevealedNotes(data.entry.notes || '');
      } else {
        alert('Failed to reveal password.');
      }
    } catch (err) {
      console.error('Error revealing vault secret', err);
    } finally {
      setLoadingRevealId(null);
    }
  };

  const handleCopy = (id: string, secret: string | null) => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete password entry for "${title}"?`)) return;
    try {
      const res = await fetch(`/api/vault/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        if (revealedId === id) {
          setRevealedId(null);
          setRevealedSecret(null);
          setRevealedNotes(null);
        }
        await fetchEntries();
      }
    } catch (err) {
      console.error('Error deleting vault entry', err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newTitle.trim() || !newSite.trim() || !newUsername.trim() || !newSecret.trim()) {
      setAddError('All fields except notes are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          site: newSite,
          username: newUsername,
          secret: newSecret,
          notes: newNotes,
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setNewTitle('');
        setNewSite('');
        setNewUsername('');
        setNewSecret('');
        setNewNotes('');
        setIsOpenAddModal(false);
        await fetchEntries();
      } else {
        const data = await res.json();
        setAddError(data.error || 'Failed to save password.');
      }
    } catch (err) {
      setAddError('Network error while saving vault entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 panel-enter">
      {/* Security overview */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-red-400" />
            <span className="text-xs text-surface-400 font-medium">Total Entries</span>
          </div>
          <p className="text-2xl font-bold text-white">{entries.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-brand-400" />
            <span className="text-xs text-surface-400 font-medium">Encryption Strength</span>
          </div>
          <p className="text-base font-bold text-white mt-1">AES-256-GCM / rest</p>
        </div>
        <div
          onClick={() => setIsOpenAddModal(true)}
          className="glass-card rounded-xl p-4 border border-dashed border-red-500/20 hover:border-red-500/40 flex flex-col items-center justify-center cursor-pointer transition-all"
        >
          <Plus className="w-6 h-6 text-red-400 mb-1" />
          <p className="text-xs font-semibold text-white">Add Entry</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 flex items-center gap-2 px-3 py-2 rounded-xl glass-card">
          <Search className="w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search credentials..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 outline-none"
          />
        </div>
      </div>

      {/* Entries list */}
      <div className="glass-card rounded-2xl overflow-hidden divide-y divide-surface-800/30">
        {filtered.map((entry, i) => {
          const isRevealed = revealedId === entry.id;
          const isLoading = loadingRevealId === entry.id;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex flex-col px-4 py-3.5 hover:bg-surface-800/10 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Icon placeholder */}
                <span className="text-xl flex-shrink-0">🔐</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{entry.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-surface-400 truncate">User: {entry.username}</span>
                    <span className="text-[10px] text-surface-600 truncate">{entry.site}</span>
                  </div>
                </div>

                {/* Password reveal visual */}
                <div className="hidden sm:flex items-center gap-1 min-w-36 font-mono text-xs text-surface-500">
                  {isLoading ? (
                    <span className="text-[10px] animate-pulse">Decrypting...</span>
                  ) : isRevealed ? (
                    <code className="text-brand-400">{revealedSecret}</code>
                  ) : (
                    <code>••••••••••••</code>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleReveal(entry.id)}
                    className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-white transition-colors"
                    title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                  >
                    {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(entry.id, revealedSecret)}
                    disabled={!isRevealed}
                    className={`p-1.5 rounded-lg text-surface-500 transition-colors ${
                      isRevealed
                        ? 'hover:bg-surface-700/50 hover:text-white cursor-pointer'
                        : 'opacity-30 cursor-not-allowed'
                    }`}
                    title={isRevealed ? 'Copy password' : 'Reveal first to copy'}
                  >
                    {copiedId === entry.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={entry.site.startsWith('http') ? entry.site : `https://${entry.site}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-white transition-colors hidden sm:block"
                    title="Open site"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(entry.id, entry.title)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Revealed Notes section if present */}
              {isRevealed && revealedNotes && (
                <div className="mt-3 ml-11 p-3 rounded-lg bg-surface-950/40 border border-surface-800/50">
                  <p className="text-[10px] text-surface-500 font-semibold uppercase mb-1">Notes</p>
                  <p className="text-xs text-surface-400 whitespace-pre-wrap">{revealedNotes}</p>
                </div>
              )}
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-surface-500 py-12">No secrets found in this vault.</p>
        )}
      </div>

      {/* Add Entry Modal */}
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
                <Lock className="w-5 h-5 text-red-400" /> New Vault Entry
              </h3>

              {addError && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-medium">
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="My Main Account"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Website (URL)</label>
                  <input
                    type="text"
                    required
                    value={newSite}
                    onChange={e => setNewSite(e.target.value)}
                    placeholder="proton.me"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Username / Email</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="admin@proton.me"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Secret Password</label>
                  <input
                    type="password"
                    required
                    value={newSecret}
                    onChange={e => setNewSecret(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Notes (Optional)</label>
                  <textarea
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Backup recovery codes..."
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2 text-white outline-none h-20 resize-none focus:border-brand-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 font-bold text-white rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Saving to Vault...' : 'Encrypt & Save'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
