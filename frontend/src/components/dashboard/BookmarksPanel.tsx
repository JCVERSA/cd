import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, ExternalLink, Clock, Grid3X3, List, Trash2, X, AlertCircle } from 'lucide-react';

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  tags: string[];
  createdAt: number;
}

export default function BookmarksPanel() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Add modal states
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/bookmarks', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch (err) {
      console.error('Error fetching bookmarks', err);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete bookmark for "${title}"?`)) return;
    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchBookmarks();
      }
    } catch (err) {
      console.error('Error deleting bookmark', err);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    // Client-side URL validation as required
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      setAddError('URL must start with http:// or https://');
      return;
    }

    if (!newTitle.trim() || !newUrl.trim()) {
      setAddError('Title and URL fields are required.');
      return;
    }

    // Split tags by comma
    const tags = newTagsStr
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          url: newUrl,
          tags,
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setNewTitle('');
        setNewUrl('');
        setNewTagsStr('');
        setIsOpenAddModal(false);
        await fetchBookmarks();
      } else {
        const data = await res.json();
        setAddError(data.error || 'Failed to save bookmark.');
      }
    } catch (err) {
      setAddError('Network error while saving bookmark.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamically derive tags list from live database entries for cohesive filtering!
  const allTags = ['All', ...new Set(bookmarks.flatMap(b => b.tags || []))];

  const filtered = bookmarks.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = activeTag === 'All' || b.tags.includes(activeTag);

    return matchesSearch && matchesTag;
  });

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-4 panel-enter">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48 flex items-center gap-2 px-3 py-2 rounded-xl glass-card">
          <Search className="w-4 h-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all capitalize ${
                activeTag === tag
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsOpenAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Bookmark
          </button>
          <div className="flex items-center border border-surface-700/40 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 ${view === 'grid' ? 'bg-surface-700/50 text-white' : 'text-surface-500'} transition-colors`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 ${view === 'list' ? 'bg-surface-700/50 text-white' : 'text-surface-500'} transition-colors`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-surface-500">{filtered.length} bookmarks</p>

      {/* Bookmarks rendering */}
      {view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bm, i) => (
            <motion.div
              key={bm.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
              className="glass-card rounded-xl p-4 group hover:border-brand-500/20 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate group-hover:text-brand-400 transition-colors">{bm.title}</h4>
                    <a
                      href={bm.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-surface-500 flex items-center gap-1 mt-1 hover:underline"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> {bm.url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleDelete(bm.id, bm.title)}
                    className="p-1 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-800/40">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {bm.tags.map(tag => (
                    <span key={tag} className="text-[9px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
                <span className="text-[9px] text-surface-600 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-2.5 h-2.5" /> {formatDate(bm.createdAt)}
                </span>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-xs text-surface-500 py-12">No bookmarks saved yet.</p>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-surface-800/30">
          {filtered.map((bm, i) => (
            <motion.div
              key={bm.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-surface-800/20 transition-colors group"
            >
              <span className="text-xl flex-shrink-0">🔗</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{bm.title}</p>
                </div>
                <p className="text-[10px] text-surface-500 truncate">{bm.url}</p>
              </div>
              <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                {bm.tags.map(tag => (
                  <span key={tag} className="text-[9px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">#{tag}</span>
                ))}
              </div>
              <span className="text-[10px] text-surface-600 flex-shrink-0 hidden sm:block">{formatDate(bm.createdAt)}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={bm.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-500 hover:text-brand-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(bm.id, bm.title)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-surface-500 py-12">No bookmarks saved yet.</p>
          )}
        </div>
      )}

      {/* Add Bookmark Modal */}
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
                🔗 Add New Bookmark
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
                    placeholder="E.g. GitHub"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">URL (Link)</label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://github.com"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>
                <div>
                  <label className="block text-surface-300 mb-1.5 font-semibold">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={newTagsStr}
                    onChange={e => setNewTagsStr(e.target.value)}
                    placeholder="E.g. dev, git, documentation"
                    className="w-full bg-surface-950 border border-surface-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-brand-500/40"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 font-bold text-white rounded-xl shadow-lg transition-colors flex items-center justify-center"
                >
                  {isSubmitting ? 'Saving Bookmark...' : 'Save Bookmark'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
