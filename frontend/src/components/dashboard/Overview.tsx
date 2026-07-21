import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Cpu, MemoryStick, HardDrive, Thermometer, Activity, ArrowUpRight,
  ArrowDownRight, Clock, Server, Wifi, TrendingUp, FileText, Lock, Bookmark, Image as ImageIcon
} from 'lucide-react';
import { services, systemMetrics, generateRequestData, generateTimeSeriesData } from './overviewSimData';
import type { Page } from './Sidebar';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-surface-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

interface OverviewProps {
  onNavigate: (page: Page) => void;
  session: {
    username: string;
    role: 'admin' | 'user';
    quotaBytes: number;
    usedBytes: number;
  };
}

export default function Overview({ onNavigate, session }: OverviewProps) {
  const requestData = useMemo(() => generateRequestData(), []);
  const cpuData = useMemo(() => generateTimeSeriesData(24, 14, 8), []);
  const memData = useMemo(() => generateTimeSeriesData(24, 62, 12), []);

  const totalRequests = requestData.reduce((s, d) => s + d.requests, 0);
  const totalErrors = requestData.reduce((s, d) => s + d.errors, 0);
  const avgLatency = Math.round(requestData.reduce((s, d) => s + d.latency, 0) / requestData.length);

  // Real database metrics counters from API
  const [counts, setCounts] = useState({
    files: 0,
    notes: 0,
    gallery: 0,
    vault: 0,
    bookmarks: 0,
  });

  useEffect(() => {
    // Fetch counts from all entities in parallel safely
    const endpoints = [
      { key: 'files', url: '/api/files', field: 'files' },
      { key: 'notes', url: '/api/notes', field: 'notes' },
      { key: 'gallery', url: '/api/gallery', field: 'files' },
      { key: 'vault', url: '/api/vault', field: 'entries' },
      { key: 'bookmarks', url: '/api/bookmarks', field: 'bookmarks' },
    ];

    Promise.all(
      endpoints.map(ep =>
        fetch(ep.url, { credentials: 'include' })
          .then(res => (res.ok ? res.json() : null))
          .then(data => ({ key: ep.key, count: data && data[ep.field] ? data[ep.field].length : 0 }))
          .catch(() => ({ key: ep.key, count: 0 }))
      )
    ).then(results => {
      const newCounts = { ...counts };
      results.forEach(r => {
        // @ts-ignore
        newCounts[r.key] = r.count;
      });
      setCounts(newCounts);
    });
  }, []);

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
    <div className="space-y-6 panel-enter">
      {/* Real stats row (Fles, Notes, Gallery, Vault, Bookmarks) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniCardStat icon={HardDrive} label="Files" value={counts.files} color="text-violet-400" bg="bg-violet-500/10" onClick={() => onNavigate('files')} />
        <MiniCardStat icon={FileText} label="Notes" value={counts.notes} color="text-amber-400" bg="bg-amber-500/10" onClick={() => onNavigate('notes')} />
        <MiniCardStat icon={ImageIcon} label="Photos" value={counts.gallery} color="text-pink-400" bg="bg-pink-500/10" onClick={() => onNavigate('gallery')} />
        <MiniCardStat icon={Lock} label="Passwords" value={counts.vault} color="text-red-400" bg="bg-red-500/10" onClick={() => onNavigate('vault')} />
        <MiniCardStat icon={Bookmark} label="Bookmarks" value={counts.bookmarks} color="text-indigo-400" bg="bg-indigo-500/10" onClick={() => onNavigate('bookmarks')} />
      </div>

      {/* System metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Cpu} label="CPU Usage" value={`${systemMetrics.cpuUsage}%`}
          sub={`Load: ${systemMetrics.loadAvg[0]}`} trend={-2.3} color="text-blue-400" bg="bg-blue-500/10" borderColor="border-blue-500/20"
        />
        <MetricCard
          icon={MemoryStick} label="Memory" value={`${systemMetrics.memoryUsed} GB`}
          sub={`${systemMetrics.memoryUsage}% of ${systemMetrics.memoryTotal} GB`} trend={1.4} color="text-violet-400" bg="bg-violet-500/10" borderColor="border-violet-500/20"
        />
        <MetricCard
          icon={HardDrive} label="Disk Used (Session)" value={formatBytes(session.usedBytes)}
          sub={`${quotaPercent}% of ${formatBytes(session.quotaBytes)}`} trend={3.1} color="text-brand-400" bg="bg-brand-500/10" borderColor="border-brand-500/20"
        />
        <MetricCard
          icon={Thermometer} label="Temperature" value={`${systemMetrics.temperature}°C`}
          sub="Normal operating range" trend={-0.8} color="text-emerald-400" bg="bg-emerald-500/10" borderColor="border-emerald-500/20"
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Request chart - large */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Request Volume</h3>
              <p className="text-xs text-surface-500 mt-0.5">Last 24 hours</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-400" />Requests</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Errors</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={requestData}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="requests" stroke="#818cf8" fill="url(#reqGrad)" strokeWidth={2} name="Requests" />
              <Area type="monotone" dataKey="errors" stroke="#f87171" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quick stats panel */}
        <div className="glass-card rounded-2xl p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-4 flex-1">
            <QuickStat icon={TrendingUp} label="Total Requests" value={totalRequests.toLocaleString()} color="text-brand-400" />
            <QuickStat icon={Activity} label="Avg Latency" value={`${avgLatency}ms`} color="text-emerald-400" />
            <QuickStat icon={Server} label="Active Services" value="8/8" color="text-blue-400" />
            <QuickStat icon={Clock} label="System Uptime" value={systemMetrics.uptimeSystem} color="text-amber-400" />
            <QuickStat icon={Wifi} label="Network I/O" value={`↑${systemMetrics.networkOut} ↓${systemMetrics.networkIn} MB/s`} color="text-violet-400" />
          </div>
          <div className="mt-4 pt-3 border-t border-surface-700/30">
            <p className="text-[10px] text-surface-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              Total errors: {totalErrors} ({(totalErrors / totalRequests * 100).toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>

      {/* CPU & Memory charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">CPU Usage</h3>
          <p className="text-xs text-surface-500 mb-4">24-hour trend</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={cpuData}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#cpuGrad)" strokeWidth={2} name="CPU %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Memory Usage</h3>
          <p className="text-xs text-surface-500 mb-4">24-hour trend</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={memData}>
              <defs>
                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#memGrad)" strokeWidth={2} name="Memory %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service status cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Service Status</h3>
          <button onClick={() => onNavigate('services')} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">View all →</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {services.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => onNavigate('services')}
              className="glass-card rounded-xl p-4 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                    <Server className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{service.name}</p>
                    <code className="text-[10px] text-surface-500">{service.id}</code>
                  </div>
                </div>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-online" />
                  <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-800/30 rounded-lg py-1.5 px-1">
                  <p className="text-[10px] text-surface-500">CPU</p>
                  <p className="text-xs font-semibold text-white">{service.cpu}%</p>
                </div>
                <div className="bg-surface-800/30 rounded-lg py-1.5 px-1">
                  <p className="text-[10px] text-surface-500">MEM</p>
                  <p className="text-xs font-semibold text-white">{service.memoryMB}MB</p>
                </div>
                <div className="bg-surface-800/30 rounded-lg py-1.5 px-1">
                  <p className="text-[10px] text-surface-500">↻</p>
                  <p className="text-xs font-semibold text-white">{service.restarts}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* System info footer */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Hostname', value: systemMetrics.hostname },
            { label: 'OS', value: systemMetrics.os },
            { label: 'Kernel', value: systemMetrics.kernel },
            { label: 'Node.js', value: systemMetrics.nodeVersion },
            { label: 'PM2', value: `v${systemMetrics.pm2Version}` },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] text-surface-500 uppercase tracking-wider">{item.label}</p>
              <p className="text-xs font-medium text-surface-300 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniCardStat({ icon: Icon, label, value, color, bg, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string; onClick: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="glass-card rounded-xl p-4 flex items-center gap-3 cursor-pointer border border-surface-800/40 hover:border-brand-500/20 transition-all"
    >
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-[10px] text-surface-500 font-semibold uppercase">{label}</p>
        <p className="text-lg font-bold text-white mt-0.5">{value}</p>
      </div>
    </motion.div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, trend, color, bg, borderColor }: {
  icon: React.ElementType; label: string; value: string; sub: string; trend: number;
  color: string; bg: string; borderColor: string;
}) {
  const isPositive = trend > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl p-4 border ${borderColor}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${color}`} />
        </div>
        <div className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-red-400' : 'text-emerald-400'}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}%
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-surface-500 mt-0.5">{label} &middot; {sub}</p>
    </motion.div>
  );
}

function QuickStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-surface-500">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}
