import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, Trash2, Filter, ArrowDown } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  message: string;
}

const levelColors: Record<string, string> = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
  debug: 'text-surface-500',
};

const levelBg: Record<string, string> = {
  info: 'bg-blue-500/10',
  warn: 'bg-amber-500/10',
  error: 'bg-red-500/10',
  debug: 'bg-surface-700/30',
};

const services = ['gateway', 'auth', 'files', 'notes', 'gallery', 'vault', 'bookmarks', 'admin'];

// Predefined set of highly realistic MiniCloud backend routes & operational log messages
const logScenarios = [
  { service: 'gateway', level: 'info', message: 'GET /api/auth/me 200 3ms' },
  { service: 'gateway', level: 'info', message: 'POST /api/auth/login 200 138ms' },
  { service: 'gateway', level: 'info', message: 'GET /api/files 200 6ms' },
  { service: 'gateway', level: 'info', message: 'POST /api/files/upload 200 48ms' },
  { service: 'gateway', level: 'info', message: 'GET /api/gallery 200 12ms' },
  { service: 'gateway', level: 'info', message: 'GET /api/notes 200 4ms' },
  { service: 'gateway', level: 'info', message: 'GET /api/vault 200 8ms' },
  { service: 'gateway', level: 'info', message: 'GET /api/bookmarks 200 4ms' },
  { service: 'gateway', level: 'warn', message: 'POST /api/auth/login 401 144ms - Invalid credentials' },
  { service: 'gateway', level: 'error', message: 'DELETE /api/files/unauthorized.zip 403 2ms - CSRF check failed' },

  { service: 'auth', level: 'info', message: 'Token verification passed: stateless JWT parsed successfully' },
  { service: 'auth', level: 'info', message: 'Session validated for user "admin" - role: admin' },
  { service: 'auth', level: 'info', message: 'Bcrypt comparison matching completed in 132ms' },
  { service: 'auth', level: 'warn', message: 'Rate limiter warning: 12 attempts from IP 192.168.1.55' },
  { service: 'auth', level: 'info', message: 'Successful user logout. Cleared HTTPOnly cookie.' },

  { service: 'files', level: 'info', message: 'Multer parsed 1 file(s) for user "admin" successfully' },
  { service: 'files', level: 'info', message: 'Wrote file contract_2024.pdf (2.4 MB) atomically to disk' },
  { service: 'files', level: 'info', message: 'Storage check: home/admin/ occupies 12.4 MB out of 100.0 MB quota' },
  { service: 'files', level: 'error', message: 'Upload aborted: quota exceeded limit of 100.0 MB' },
  { service: 'files', level: 'info', message: 'Deleted file report.docx from user disk storage' },

  { service: 'notes', level: 'info', message: 'User notes catalog queried - fetched 3 notes' },
  { service: 'notes', level: 'info', message: 'Saved note "MiniCloud ToDo" (ID: 3) to users.json store' },
  { service: 'notes', level: 'info', message: 'Atomic write successful: serialized mutation to raw disk' },
  { service: 'notes', level: 'info', message: 'Note ID 2 deleted cleanly' },

  { service: 'gallery', level: 'info', message: 'Serving photo photo_vacances.jpg inline' },
  { service: 'gallery', level: 'info', message: 'Parsed media file upload - verified signature: image/jpeg' },
  { service: 'gallery', level: 'info', message: 'Image optimized successfully' },

  { service: 'vault', level: 'info', message: 'Decrypt request received for vault ID: 1' },
  { service: 'vault', level: 'info', message: 'Key derived via PBKDF2 with user salt' },
  { service: 'vault', level: 'info', message: 'AES-256-GCM authentication tag verified. Payload decrypted.' },
  { service: 'vault', level: 'info', message: 'Saved new encrypted credentials entry' },

  { service: 'bookmarks', level: 'info', message: 'Bookmarks listing requested - returning 12 items' },
  { service: 'bookmarks', level: 'info', message: 'Bookmark URL validation passed for "https://github.com"' },
  { service: 'bookmarks', level: 'error', message: 'Bookmark rejected: URL does not start with http(s)://' },

  { service: 'admin', level: 'info', message: 'Admin requested total statistics aggregates' },
  { service: 'admin', level: 'info', message: 'Calculated global disk metrics across all user directories' },
  { service: 'admin', level: 'info', message: 'Loaded 5 active accounts from data/users.json' },
  { service: 'admin', level: 'warn', message: 'Self-lockout guard blocked demotion of user "admin"' },
];

let logIdCounter = 1;

function generatePlausibleLog(): LogEntry {
  const scenario = logScenarios[Math.floor(Math.random() * logScenarios.length)];
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return {
    id: String(logIdCounter++),
    timestamp: timeStr,
    level: scenario.level as LogEntry['level'],
    service: scenario.service,
    message: scenario.message,
  };
}

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filterService, setFilterService] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial logs
  useEffect(() => {
    const initial: LogEntry[] = [];
    for (let i = 0; i < 40; i++) {
      initial.push(generatePlausibleLog());
    }
    setLogs(initial);
  }, []);

  // Irregular interval scheduling (500ms to 3s)
  useEffect(() => {
    if (paused) return;

    let timerId: NodeJS.Timeout;

    const scheduleNextLog = () => {
      const delay = 500 + Math.random() * 2500; // Between 500ms and 3000ms
      timerId = setTimeout(() => {
        const entry = generatePlausibleLog();
        setLogs(prev => [...prev.slice(-250), entry]);
        scheduleNextLog();
      }, delay);
    };

    scheduleNextLog();

    return () => clearTimeout(timerId);
  }, [paused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = logs.filter(l =>
    (filterService === 'all' || l.service === filterService) &&
    (filterLevel === 'all' || l.level === filterLevel)
  );

  return (
    <div className="space-y-4 panel-enter h-full flex flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setPaused(!paused)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            paused ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
          }`}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          {paused ? 'Resume' : 'Pause'}
        </button>

        <button
          onClick={() => setLogs([])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800/50 border border-surface-700/40 text-surface-400 hover:text-white transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Clear
        </button>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            autoScroll ? 'bg-brand-500/10 border border-brand-500/20 text-brand-400' : 'bg-surface-800/50 border border-surface-700/40 text-surface-400'
          }`}
        >
          <ArrowDown className="w-3 h-3" /> Auto-scroll
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <select
            value={filterService}
            onChange={e => setFilterService(e.target.value)}
            className="bg-surface-800/50 border border-surface-700/40 text-xs text-surface-300 rounded-lg px-2 py-1.5 outline-none focus:border-brand-500/40"
          >
            <option value="all">All Services</option>
            {services.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value)}
            className="bg-surface-800/50 border border-surface-700/40 text-xs text-surface-300 rounded-lg px-2 py-1.5 outline-none focus:border-brand-500/40"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>

      {/* Log count */}
      <div className="flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-surface-500">
          {filtered.length} entries {filterService !== 'all' || filterLevel !== 'all' ? '(filtered)' : ''}
        </p>
        {!paused && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live Stream
          </span>
        )}
      </div>

      {/* Log stream */}
      <div
        ref={containerRef}
        className="glass-card rounded-2xl flex-1 min-h-0 overflow-auto font-mono text-xs"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <div className="p-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-surface-500">No log entries</div>
          ) : (
            filtered.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="log-line flex items-start gap-2 px-3 py-1.5 rounded-lg group"
              >
                <span className="text-surface-600 flex-shrink-0 w-16">{log.timestamp}</span>
                <span className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase flex-shrink-0 w-12 text-center ${levelColors[log.level]} ${levelBg[log.level]}`}>
                  {log.level}
                </span>
                <span className="text-brand-400 flex-shrink-0 w-28 truncate">mc-{log.service}</span>
                <span className="text-surface-300 break-all">{log.message}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
