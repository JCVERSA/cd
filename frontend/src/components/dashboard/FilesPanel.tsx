import { useState, useEffect, useRef } from 'react';
import {
  Upload, Grid3X3, List, Download, Trash2, HardDrive, AlertCircle, FileText
} from 'lucide-react';

interface FileItem {
  name: string;
  size: number;
  modified: number;
}

interface FilesPanelProps {
  onQuotaUpdate: () => void;
  session: {
    username: string;
    role: 'admin' | 'user';
    quotaBytes: number;
    usedBytes: number;
  };
}

export default function FilesPanel({ onQuotaUpdate, session }: FilesPanelProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [selectedFileName, setSelectedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error fetching files', err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileDownload = (name: string) => {
    // Standard secure way to trigger direct browser download
    window.location.href = `/api/files/download/${encodeURIComponent(name)}`;
  };

  const handleFileDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        if (selectedFileName === name) setSelectedName(null);
        await fetchFiles();
        onQuotaUpdate(); // Refresh the parent's quota state!
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete file.');
      }
    } catch (err) {
      console.error('Error deleting file', err);
    }
  };

  // Real upload using XMLHttpRequest to track progress
  const performUpload = (fileList: FileList) => {
    if (fileList.length === 0) return;

    setUploadProgress(0);
    setUploadError(null);

    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // The backend expects field "files", accepts up to 50 files
    for (let i = 0; i < Math.min(50, fileList.length); i++) {
      formData.append('files', fileList[i]);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        setUploadProgress(null);
        fetchFiles();
        onQuotaUpdate(); // Refresh user storage quota!
      } else {
        try {
          const resp = JSON.parse(xhr.responseText);
          setUploadError(resp.error || 'Upload failed.');
        } catch {
          setUploadError('An error occurred during upload.');
        }
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => {
      setUploadError('Network error during file upload.');
      setUploadProgress(null);
    };

    xhr.open('POST', '/api/files/upload');
    // Ensure cookie session is included
    xhr.withCredentials = true;
    xhr.send(formData);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      performUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      performUpload(e.target.files);
    }
  };

  // Filtered files
  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // File size formatter
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine standard file icons visually
  const getFileIcon = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📕';
      case 'doc':
      case 'docx': return '📘';
      case 'xls':
      case 'xlsx': return '📗';
      case 'ppt':
      case 'pptx': return '📙';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp': return '🖼️';
      case 'mp3':
      case 'wav': return '🎵';
      case 'mp4':
      case 'mov': return '🎬';
      case 'zip':
      case 'rar':
      case '7z': return '🗜️';
      case 'json': return '🧾';
      case 'js':
      case 'html': return '📜';
      case 'css': return '🎨';
      case 'md': return '📝';
      default: return '📄';
    }
  };

  const quotaPercent = Math.min(100, Math.round((session.usedBytes / session.quotaBytes) * 100)) || 0;

  return (
    <div className="space-y-4 panel-enter">
      {/* Storage and Upload Overview */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Dynamic Quota Card */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-medium text-surface-400">Quota Used</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatBytes(session.usedBytes)} <span className="text-xs text-surface-500">used</span>
          </p>
          <div className="mt-2 w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full" style={{ width: `${quotaPercent}%` }} />
          </div>
          <p className="text-[10px] text-surface-500 mt-1">{quotaPercent}% of {formatBytes(session.quotaBytes)}</p>
        </div>

        {/* File Count Card */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-surface-400">Total Files</span>
          </div>
          <p className="text-2xl font-bold text-white">{files.length}</p>
          <p className="text-[10px] text-surface-500 mt-1">Directly hosted files</p>
        </div>

        {/* Upload Zone Card */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`glass-card rounded-xl p-4 border border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-brand-500 bg-brand-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
              : 'border-surface-700/50 hover:border-surface-600'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={handleFileSelectChange}
            className="hidden"
          />
          <Upload className={`w-6 h-6 mb-2 ${isDragging ? 'text-brand-400 animate-bounce' : 'text-surface-400'}`} />
          <p className="text-xs font-semibold text-white">Upload Files</p>
          <p className="text-[10px] text-surface-500 mt-1 text-center">Drag & drop or click to upload</p>
        </div>
      </div>

      {/* Progress Bars and Errors */}
      {uploadProgress !== null && (
        <div className="glass-card rounded-xl p-3 border border-brand-500/20">
          <div className="flex justify-between text-xs text-brand-400 mb-1 font-medium">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* File browser */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-surface-700/30 gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">Files list</span>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-surface-800/40 border border-surface-700/40 text-xs text-white rounded-lg px-2.5 py-1.5 ml-2 outline-none focus:border-brand-500/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-surface-700/40 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`p-1.5 ${view === 'list' ? 'bg-surface-700/50 text-white' : 'text-surface-500 hover:text-white'} transition-colors`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 ${view === 'grid' ? 'bg-surface-700/50 text-white' : 'text-surface-500 hover:text-white'} transition-colors`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {view === 'list' ? (
          <div className="p-2 space-y-0.5 max-h-[420px] overflow-y-auto">
            {filtered.map(f => {
              const isSelected = selectedFileName === f.name;
              return (
                <button
                  key={f.name}
                  onClick={() => setSelectedName(f.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-surface-800/40 ${
                    isSelected ? 'bg-brand-600/10 border border-brand-500/20' : 'border border-transparent'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{getFileIcon(f.name)}</span>
                  <span className="text-sm text-white flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-surface-400 flex-shrink-0 mr-4">{formatBytes(f.size)}</span>
                  <span className="text-[10px] text-surface-500 flex-shrink-0 hidden sm:block">{formatDate(f.modified)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-surface-500 py-12">No files uploaded yet.</p>
            )}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[420px] overflow-y-auto">
            {filtered.map(f => {
              const isSelected = selectedFileName === f.name;
              return (
                <button
                  key={f.name}
                  onClick={() => setSelectedName(f.name)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:bg-surface-800/40 ${
                    isSelected ? 'bg-brand-600/10 border border-brand-500/20' : 'border border-transparent'
                  }`}
                >
                  <span className="text-3xl">{getFileIcon(f.name)}</span>
                  <span className="text-xs text-white text-center truncate w-full">{f.name}</span>
                  <span className="text-[10px] text-surface-500">{formatBytes(f.size)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-xs text-surface-500 py-12">No files uploaded yet.</p>
            )}
          </div>
        )}

        {/* Action bar */}
        {selectedFileName && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-surface-700/30 bg-surface-900/30">
            <span className="text-xs text-surface-400 mr-2 truncate max-w-xs font-semibold">
              Selected: {selectedFileName}
            </span>
            <button
              onClick={() => handleFileDownload(selectedFileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-400 text-xs font-medium hover:bg-brand-600/30 transition-colors"
            >
              <Download className="w-3 h-3" /> Download
            </button>
            <button
              onClick={() => handleFileDelete(selectedFileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors ml-auto"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
