import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Square, RefreshCcw, Terminal, ChevronDown, ChevronUp, Server,
  Clock, Cpu, MemoryStick, Activity, Hash
} from 'lucide-react';

interface Service {
  id: string;
  name: string;
  pmId: number;
  pid: number;
  cpu: number;
  memoryMB: number;
  memoryUsage: number;
  uptime: string;
  restarts: number;
  version: string;
  description: string;
  gradient: string;
  status: 'online' | 'stopped' | 'errored';
}

const initialServices: Service[] = [
  { id: 'gateway', name: 'Gateway', pmId: 0, pid: 41201, cpu: 0.5, memoryMB: 45, memoryUsage: 12, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'Express API gateway & reverse proxy (port 3000)', gradient: 'from-blue-500 to-indigo-600', status: 'online' },
  { id: 'auth', name: 'Auth Service', pmId: 1, pid: 41202, cpu: 0.1, memoryMB: 38, memoryUsage: 10, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'Registration, authentication & session management (port 4001)', gradient: 'from-emerald-500 to-teal-600', status: 'online' },
  { id: 'files', name: 'Files Service', pmId: 2, pid: 41203, cpu: 0.2, memoryMB: 52, memoryUsage: 14, uptime: '12d 4h 32m', restarts: 1, version: '2.0.0', description: 'Disk storage manager with multer and size validations (port 4002)', gradient: 'from-violet-500 to-purple-600', status: 'online' },
  { id: 'notes', name: 'Notes Service', pmId: 3, pid: 41204, cpu: 0.1, memoryMB: 40, memoryUsage: 11, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'Raw/Markdown user notes database (port 4003)', gradient: 'from-amber-500 to-orange-600', status: 'online' },
  { id: 'gallery', name: 'Gallery Service', pmId: 4, pid: 41205, cpu: 0.3, memoryMB: 61, memoryUsage: 17, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'Image optimization and delivery engine (port 4004)', gradient: 'from-pink-500 to-rose-600', status: 'online' },
  { id: 'vault', name: 'Vault Service', pmId: 5, pid: 41206, cpu: 0.1, memoryMB: 44, memoryUsage: 12, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'AES-256-GCM hardware key-wrapped password vault (port 4005)', gradient: 'from-red-500 to-rose-600', status: 'online' },
  { id: 'bookmarks', name: 'Bookmarks Service', pmId: 6, pid: 41207, cpu: 0.1, memoryMB: 36, memoryUsage: 9, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'URL filtering and user bookmarks manager (port 4006)', gradient: 'from-indigo-500 to-blue-600', status: 'online' },
  { id: 'admin', name: 'Admin Service', pmId: 7, pid: 41208, cpu: 0.1, memoryMB: 39, memoryUsage: 10, uptime: '12d 4h 32m', restarts: 0, version: '2.0.0', description: 'Quotas, suspension, statistics and user master (port 4007)', gradient: 'from-cyan-500 to-blue-600', status: 'online' },
];

export default function ServicesPanel() {
  const [servicesList, setServicesList] = useState<Service[]>(initialServices);
  const [expandedId, setExpandedId] = useState<string | null>('gateway');
  const [filter, setFilter] = useState<'all' | 'online' | 'stopped'>('all');

  // Fluctuating values logic to simulate a real living PM2 daemon perfectly
  useEffect(() => {
    const interval = setInterval(() => {
      setServicesList(prev =>
        prev.map(s => {
          if (s.status === 'stopped') return s;

          // Random slight fluctuation
          const cpuDelta = (Math.random() - 0.5) * 0.4;
          const memDelta = Math.floor((Math.random() - 0.5) * 4);

          const newCpu = Math.max(0.1, parseFloat((s.cpu + cpuDelta).toFixed(1)));
          const newMem = Math.max(25, s.memoryMB + memDelta);

          return {
            ...s,
            cpu: newCpu,
            memoryMB: newMem,
          };
        })
      );
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleAction = (id: string, action: 'restart' | 'stop') => {
    setServicesList(prev =>
      prev.map(s => {
        if (s.id !== id) return s;
        if (action === 'restart') {
          return { ...s, status: 'online', restarts: s.restarts + 1, cpu: 0.8, memoryMB: 40 };
        } else {
          return { ...s, status: 'stopped', cpu: 0, memoryMB: 0 };
        }
      })
    );
  };

  const filtered = servicesList.filter(s =>
    filter === 'all' ? true : s.status === filter
  );

  return (
    <div className="space-y-6 panel-enter">
      {/* PM2 process table header */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-surface-700/30">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-white">PM2 Process List</h3>
            <span className="text-xs text-surface-500 bg-surface-800/60 px-2 py-0.5 rounded-md">{servicesList.length} processes</span>
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'online', 'stopped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                  filter === f
                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                    : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table header - desktop */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2.5 text-[10px] text-surface-500 uppercase tracking-wider font-semibold border-b border-surface-800/40 bg-surface-900/30">
          <div className="col-span-3">Service</div>
          <div className="col-span-1">PID</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">CPU</div>
          <div className="col-span-1">Memory</div>
          <div className="col-span-2">Uptime</div>
          <div className="col-span-1">Restarts</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Service rows */}
        <div className="divide-y divide-surface-800/30">
          {filtered.map((service, i) => {
            const isOnline = service.status === 'online';
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                {/* Desktop row */}
                <div
                  className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-surface-800/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Server className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{service.name}</p>
                      <code className="text-[10px] text-surface-500">{service.id}</code>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <code className="text-xs text-surface-400">{isOnline ? service.pid : '-'}</code>
                  </div>
                  <div className="col-span-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      isOnline
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-surface-800 border-surface-700 text-surface-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 status-online' : 'bg-surface-600'}`} />
                      <span>{service.status}</span>
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-sm text-white font-medium">{isOnline ? `${service.cpu}%` : '-'}</span>
                  </div>
                  <div className="col-span-1">
                    <span className="text-sm text-white font-medium">{isOnline ? `${service.memoryMB}MB` : '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-surface-400">{isOnline ? service.uptime : '-'}</span>
                  </div>
                  <div className="col-span-1">
                    <span className={`text-sm font-medium ${service.restarts > 0 ? 'text-amber-400' : 'text-surface-400'}`}>
                      {service.restarts}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleAction(service.id, 'restart')}
                      className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-400 hover:text-emerald-400 transition-colors"
                      title="Restart"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleAction(service.id, 'stop')}
                      disabled={!isOnline}
                      className="p-1.5 rounded-lg hover:bg-surface-700/50 text-surface-400 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Stop"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1.5 text-surface-500 cursor-pointer" onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}>
                      {expandedId === service.id ? (
                        <ChevronUp className="w-4 h-4 text-surface-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-surface-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile card */}
                <div
                  className="lg:hidden p-4 hover:bg-surface-800/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                        <Server className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{service.name}</p>
                        <code className="text-[10px] text-surface-500">{service.id}</code>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-surface-800 border-surface-700 text-surface-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-surface-600'}`} />
                      <span>{service.status}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-surface-800/30 rounded-lg py-1.5">
                      <p className="text-[9px] text-surface-500">CPU</p>
                      <p className="text-xs font-bold text-white">{isOnline ? `${service.cpu}%` : '-'}</p>
                    </div>
                    <div className="bg-surface-800/30 rounded-lg py-1.5">
                      <p className="text-[9px] text-surface-500">MEM</p>
                      <p className="text-xs font-bold text-white">{isOnline ? `${service.memoryMB}MB` : '-'}</p>
                    </div>
                    <div className="bg-surface-800/30 rounded-lg py-1.5">
                      <p className="text-[9px] text-surface-500">PID</p>
                      <p className="text-xs font-bold text-white">{isOnline ? service.pid : '-'}</p>
                    </div>
                    <div className="bg-surface-800/30 rounded-lg py-1.5">
                      <p className="text-[9px] text-surface-500">↻</p>
                      <p className="text-xs font-bold text-white">{service.restarts}</p>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expandedId === service.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t border-surface-800/30 bg-surface-900/30"
                    >
                      <div className="p-4 lg:px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <DetailItem icon={Hash} label="PM2 ID" value={`${service.pmId}`} />
                        <DetailItem icon={Cpu} label="CPU Usage" value={isOnline ? `${service.cpu}%` : '0%'} />
                        <DetailItem icon={MemoryStick} label="Memory" value={isOnline ? `${service.memoryMB} MB (${service.memoryUsage}%)` : '0 MB'} />
                        <DetailItem icon={Clock} label="Uptime" value={isOnline ? service.uptime : '-'} />
                        <DetailItem icon={Activity} label="Version" value={`v${service.version}`} />
                        <DetailItem icon={RefreshCcw} label="Restarts" value={`${service.restarts}`} />
                        <DetailItem icon={Server} label="Description" value={service.description} />
                        <DetailItem icon={Terminal} label="PID" value={isOnline ? `${service.pid}` : '-'} />
                      </div>
                      <div className="px-4 lg:px-6 pb-4 flex gap-2">
                        <button
                          onClick={() => handleAction(service.id, 'restart')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          <RefreshCcw className="w-3 h-3" /> Restart
                        </button>
                        <button
                          onClick={() => handleAction(service.id, 'stop')}
                          disabled={!isOnline}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Square className="w-3 h-3" /> Stop
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* PM2 Terminal preview */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/30 bg-surface-900/30">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[10px] text-surface-500 font-mono ml-1">pm2 ls</span>
        </div>
        <div className="p-4 font-mono text-xs space-y-0.5 overflow-x-auto">
          <p className="text-surface-500">┌─────┬────────────────┬───────┬────────┬───────┬──────────┬──────────┐</p>
          <p className="text-surface-500">│ id  │ name           │ mode  │ status │ cpu   │ memory   │ uptime   │</p>
          <p className="text-surface-500">├─────┼────────────────┼───────┼────────┼───────┼──────────┼──────────┤</p>
          {servicesList.map(s => {
            const isOnline = s.status === 'online';
            return (
              <p key={s.id}>
                <span className="text-surface-500">│ </span>
                <span className="text-surface-400">{String(s.pmId).padEnd(4)}</span>
                <span className="text-surface-500">│ </span>
                <span className="text-brand-400">{s.id.padEnd(15)}</span>
                <span className="text-surface-500">│ </span>
                <span className="text-surface-400">{'fork'.padEnd(6)}</span>
                <span className="text-surface-500">│ </span>
                <span className={isOnline ? 'text-emerald-400' : 'text-red-400'}>{s.status.padEnd(7)}</span>
                <span className="text-surface-500">│ </span>
                <span className="text-white">{isOnline ? (s.cpu + '%').padEnd(6) : '0%'.padEnd(6)}</span>
                <span className="text-surface-500">│ </span>
                <span className="text-white">{isOnline ? (s.memoryMB + 'MB').padEnd(9) : '0MB'.padEnd(9)}</span>
                <span className="text-surface-500">│ </span>
                <span className="text-surface-400">{isOnline ? s.uptime.padEnd(9) : '-'.padEnd(9)}</span>
                <span className="text-surface-500">│</span>
              </p>
            );
          })}
          <p className="text-surface-500">└─────┴────────────────┴───────┴────────┴───────┴──────────┴──────────┘</p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-surface-500">{label}</p>
        <p className="text-xs font-medium text-surface-300">{value}</p>
      </div>
    </div>
  );
}
