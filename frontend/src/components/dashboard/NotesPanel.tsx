import { useState, useEffect } from 'react';
import { Search, Plus, Clock, FileText, Trash2, Save, PenTool } from 'lucide-react';

interface NoteMeta {
  id: string;
  title: string;
  updatedAt: number;
}

interface NoteDetails {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export default function NotesPanel() {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [selectedNote, setSelectedNote] = useState<NoteDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all notes (metadata only)
  const fetchNotes = async (selectId?: string) => {
    try {
      const res = await fetch('/api/notes', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list: NoteMeta[] = data.notes || [];
        setNotes(list);

        if (list.length > 0) {
          const targetId = selectId || list[0].id;
          const found = list.find(n => n.id === targetId);
          if (found) {
            fetchNoteDetails(found.id);
          } else {
            fetchNoteDetails(list[0].id);
          }
        } else {
          setSelectedNote(null);
          setIsEditing(false);
        }
      }
    } catch (err) {
      console.error('Error fetching notes', err);
    }
  };

  // Fetch single note details (including body)
  const fetchNoteDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSelectedNote(data.note);
        setEditTitle(data.note.title);
        setEditBody(data.note.body);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error fetching note details', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCreateNote = async () => {
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Note', body: 'Write something here...' }),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        await fetchNotes(data.note.id);
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Error creating note', err);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody }),
        credentials: 'include'
      });
      if (res.ok) {
        await fetchNotes(selectedNote.id);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error saving note', err);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchNotes();
      }
    } catch (err) {
      console.error('Error deleting note', err);
    }
  };

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 panel-enter" style={{ height: 'calc(100vh - 130px)' }}>
      {/* Notes list */}
      <div className="lg:w-80 flex-shrink-0 flex flex-col glass-card rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-surface-700/30 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" /> Notes
              <span className="text-xs text-surface-500 font-normal">{notes.length}</span>
            </h3>
            <button
              onClick={handleCreateNote}
              className="p-1.5 rounded-lg bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-800/50 border border-surface-700/40">
            <Search className="w-3.5 h-3.5 text-surface-500" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white placeholder-surface-500 outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filtered.map(note => (
            <button
              key={note.id}
              onClick={() => fetchNoteDetails(note.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${
                selectedNote?.id === note.id
                  ? 'bg-brand-600/10 border border-brand-500/20'
                  : 'hover:bg-surface-800/40 border border-transparent'
              }`}
            >
              <p className="text-xs font-semibold text-white truncate mb-1">{note.title}</p>
              <span className="text-[9px] text-surface-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {formatDate(note.updatedAt)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-surface-500 py-8">No notes found</p>
          )}
        </div>
      </div>

      {/* Note editor/viewer */}
      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col min-w-0">
        {selectedNote ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-700/30 flex-shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-transparent text-lg font-bold text-white outline-none border-b border-surface-700/50 pb-1"
                  />
                ) : (
                  <h2 className="text-lg font-bold text-white truncate">{selectedNote.title}</h2>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isEditing ? (
                  <button
                    onClick={handleSaveNote}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors"
                  >
                    <PenTool className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                <button
                  onClick={handleDeleteNote}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Delete Note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Note Metadata Banner */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-surface-800/30 bg-surface-900/20 text-[10px] text-surface-500 flex-shrink-0">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Created: {formatDate(selectedNote.createdAt)}
              </span>
              <span>Updated: {formatDate(selectedNote.updatedAt)}</span>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isEditing ? (
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  placeholder="Note body (Markdown supported)..."
                  className="w-full h-full bg-transparent text-sm text-surface-300 placeholder-surface-600 outline-none resize-none"
                />
              ) : (
                <div className="prose prose-invert prose-sm max-w-none text-surface-300 whitespace-pre-wrap leading-relaxed">
                  {selectedNote.body}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-surface-500">
            <FileText className="w-12 h-12 text-surface-700 mb-3 animate-pulse" />
            <h3 className="font-semibold text-white mb-1">No note selected</h3>
            <p className="text-xs max-w-xs">Select an existing note from the sidebar or create a new one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
