import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon, Grid3X3, LayoutGrid, Upload, X, Trash2, AlertCircle, Maximize2
} from 'lucide-react';

interface GalleryFile {
  name: string;
  size: number;
  modified: number;
  url: string;
}

interface GalleryPanelProps {
  onQuotaUpdate: () => void;
  session: {
    username: string;
    role: 'admin' | 'user';
    quotaBytes: number;
    usedBytes: number;
  };
}

export default function GalleryPanel({ onQuotaUpdate, session }: GalleryPanelProps) {
  const [images, setImages] = useState<GalleryFile[]>([]);
  const [selectedImg, setSelectedImg] = useState<GalleryFile | null>(null);
  const [gridSize, setGridSize] = useState<'sm' | 'lg'>('sm');

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/gallery', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setImages(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching images', err);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('files', e.target.files[0]); // The backend gallery upload endpoint expects field 'files'

    try {
      const res = await fetch('/api/gallery/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (res.ok) {
        await fetchImages();
        onQuotaUpdate(); // Refresh user quota dynamically!
      } else {
        const data = await res.json();
        setUploadError(data.error || 'Failed to upload photo.');
      }
    } catch (err) {
      setUploadError('Network error during photo upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/gallery/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setSelectedImg(null);
        await fetchImages();
        onQuotaUpdate(); // Refresh user storage quota!
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete photo.');
      }
    } catch (err) {
      console.error('Error deleting photo', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4 panel-enter">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3">
          <p className="text-[10px] text-surface-500 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Total Photos</p>
          <p className="text-xl font-bold text-white mt-1">{images.length}</p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <p className="text-[10px] text-surface-500 flex items-center gap-1"><Upload className="w-3 h-3" /> Storage Used</p>
          <p className="text-xl font-bold text-white mt-1">{formatBytes(session.usedBytes)}</p>
        </div>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="glass-card rounded-xl p-3 border border-dashed border-pink-500/20 hover:border-pink-500/40 flex flex-col items-center justify-center cursor-pointer transition-all"
        >
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          <Upload className="w-4 h-4 text-pink-400 mb-1" />
          <p className="text-[10px] font-semibold text-white">Upload Photo</p>
        </div>
      </div>

      {/* Progress & Error indicators */}
      {uploading && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold">
          <div className="w-4 h-4 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
          <span>Uploading photo to secure vault...</span>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-surface-500 font-semibold">Media Library</p>
        <div className="flex items-center border border-surface-700/40 rounded-lg overflow-hidden flex-shrink-0">
          <button
            onClick={() => setGridSize('sm')}
            className={`p-1.5 ${gridSize === 'sm' ? 'bg-surface-700/50 text-white' : 'text-surface-500'} transition-colors`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setGridSize('lg')}
            className={`p-1.5 ${gridSize === 'lg' ? 'bg-surface-700/50 text-white' : 'text-surface-500'} transition-colors`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Gallery grid */}
      <div className={`grid gap-2.5 ${
        gridSize === 'sm'
          ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}>
        {images.map((img, i) => (
          <motion.button
            key={img.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02, duration: 0.3 }}
            onClick={() => setSelectedImg(img)}
            className="group relative aspect-square rounded-xl overflow-hidden border border-surface-700/30 hover:border-brand-500/30 bg-surface-900/40 transition-all"
          >
            <img
              src={img.url}
              alt={img.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-0 left-0 right-0 p-2 text-left opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[9px] text-white font-medium truncate">{img.name}</p>
              <p className="text-[8px] text-surface-400 truncate mt-0.5">{formatBytes(img.size)}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3.5 h-3.5 text-white/80" />
            </div>
          </motion.button>
        ))}
        {images.length === 0 && (
          <p className="col-span-full text-center text-xs text-surface-500 py-12">No photos in the gallery yet.</p>
        )}
      </div>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selectedImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedImg(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full flex flex-col lg:flex-row gap-6 bg-surface-950/80 p-4 rounded-3xl border border-surface-800/60"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex-1 flex items-center justify-center overflow-hidden max-h-[75vh] rounded-2xl bg-black/40">
                <img
                  src={selectedImg.url}
                  alt={selectedImg.name}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              <div className="lg:w-72 glass-card rounded-2xl p-5 flex flex-col justify-between h-auto gap-4 flex-shrink-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white truncate flex-1">{selectedImg.name}</h3>
                    <button onClick={() => setSelectedImg(null)} className="p-1 rounded-lg hover:bg-surface-700/50 text-surface-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-surface-500 w-16">Size</span>
                      <span className="text-surface-300 font-medium">{formatBytes(selectedImg.size)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-surface-500 w-16">Modified</span>
                      <span className="text-surface-300 font-medium">{formatDate(selectedImg.modified)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(selectedImg.name)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Photo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
