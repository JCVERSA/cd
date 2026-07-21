import { useState, useEffect } from 'react';
import {
  Shield, Bell, Palette, Database, Server, Key, Globe, Clock, Save, User as UserIcon
} from 'lucide-react';

interface ToggleProps {
  label: string;
  description: string;
  storageKey: string;
  defaultChecked?: boolean;
}

function LocalToggle({ label, description, storageKey, defaultChecked = false }: ToggleProps) {
  const [on, setOn] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) return stored === 'true';
    return defaultChecked;
  });

  const handleToggle = () => {
    const nextValue = !on;
    setOn(nextValue);
    localStorage.setItem(storageKey, String(nextValue));
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-surface-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={handleToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-surface-700'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

const tabs = [
  { id: 'profile', label: 'My Profile', icon: UserIcon },
  { id: 'general', label: 'General', icon: Server },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

interface SettingsPanelProps {
  session: {
    username: string;
    role: 'admin' | 'user';
    quotaBytes: number;
    usedBytes: number;
  };
  onQuotaUpdate: () => void;
}

export default function SettingsPanel({ session, onQuotaUpdate }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState('profile');

  // Real database metrics counters from API for the consumption overview
  const [counts, setCounts] = useState({
    files: 0,
    notes: 0,
    gallery: 0,
    vault: 0,
    bookmarks: 0,
  });

  const [sizes, setSizes] = useState({
    files: 0,
    notes: 0,
    gallery: 0,
    vault: 0,
    bookmarks: 0,
  });

  useEffect(() => {
    // Fetch user details for consumption aggregation in parallel
    const endpoints = [
      { key: 'files', url: '/api/files', arrayField: 'files', sizeField: 'size' },
      { key: 'notes', url: '/api/notes', arrayField: 'notes', sizeField: null },
      { key: 'gallery', url: '/api/gallery', arrayField: 'files', sizeField: 'size' },
      { key: 'vault', url: '/api/vault', arrayField: 'entries', sizeField: null },
      { key: 'bookmarks', url: '/api/bookmarks', arrayField: 'bookmarks', sizeField: null },
    ];

    Promise.all(
      endpoints.map(ep =>
        fetch(ep.url, { credentials: 'include' })
          .then(res => (res.ok ? res.json() : null))
          .then(data => {
            const list = data && data[ep.arrayField] ? data[ep.arrayField] : [];
            const count = list.length;
            let sizeSum = 0;
            if (ep.sizeField) {
              list.forEach((item: any) => {
                sizeSum += Number(item[ep.sizeField]) || 0;
              });
            }
            return { key: ep.key, count, size: sizeSum };
          })
          .catch(() => ({ key: ep.key, count: 0, size: 0 }))
      )
    ).then(results => {
      const newCounts = { ...counts };
      const newSizes = { ...sizes };
      results.forEach(r => {
        // @ts-ignore
        newCounts[r.key] = r.count;
        // @ts-ignore
        newSizes[r.key] = r.size;
      });
      setCounts(newCounts);
      setSizes(newSizes);
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
    <div className="flex flex-col lg:flex-row gap-4 panel-enter">
      {/* Settings nav */}
      <div className="lg:w-56 flex-shrink-0">
        <div className="glass-card rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-600/15 text-white'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-400' : 'text-surface-500'}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 glass-card rounded-2xl p-6 min-w-0">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">My Profile</h3>
              <p className="text-xs text-surface-500">Overview of your MiniCloud session and space allocation</p>
            </div>

            {/* Profile info rows */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-surface-400 mb-1.5">Username</p>
                <div className="px-3 py-2.5 rounded-xl bg-surface-800/30 border border-surface-700/30 text-sm text-white font-semibold">
                  {session.username}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-surface-400 mb-1.5">System Role</p>
                <div className="px-3 py-2.5 rounded-xl bg-surface-800/30 border border-surface-700/30 text-xs font-bold text-brand-400 uppercase tracking-wide">
                  {session.role}
                </div>
              </div>
            </div>

            {/* Consumption Aggregator Table */}
            <div className="border-t border-surface-700/30 pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-white mb-3">Resource Consumption Summary</h4>
              <div className="space-y-2">
                {[
                  { label: 'Files Storage', count: counts.files, desc: 'direct uploads', bytes: sizes.files },
                  { label: 'Notes Database', count: counts.notes, desc: 'written notes', bytes: null },
                  { label: 'Photo Gallery', count: counts.gallery, desc: 'secured media files', bytes: sizes.gallery },
                  { label: 'Passwords Vault', count: counts.vault, desc: 'credentials records', bytes: null },
                  { label: 'User Bookmarks', count: counts.bookmarks, desc: 'categorized links', bytes: null },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3.5 rounded-xl bg-surface-800/20 border border-surface-800/40 text-xs">
                    <div>
                      <span className="font-semibold text-white">{item.label}</span>
                      <span className="text-[10px] text-surface-500 ml-2">({item.count} {item.desc})</span>
                    </div>
                    {item.bytes !== null ? (
                      <span className="font-mono text-surface-300 font-bold">{formatBytes(item.bytes)}</span>
                    ) : (
                      <span className="text-[10px] text-surface-500 font-medium">Database store</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress dynamic meter */}
              <div className="p-4 rounded-xl bg-surface-800/10 border border-surface-800/30 space-y-2">
                <div className="flex justify-between text-xs text-surface-300 font-medium">
                  <span>Storage Quota Used</span>
                  <span>{quotaPercent}%</span>
                </div>
                <div className="w-full h-2 bg-surface-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-purple-600 rounded-full"
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-surface-500">
                  <span>{formatBytes(session.usedBytes)} used</span>
                  <span>Limit: {formatBytes(session.quotaBytes)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">General Instance Settings</h3>
              <p className="text-xs text-surface-500">Review infrastructure properties</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-surface-400 mb-1.5 block">Hostname</label>
                <div className="px-3 py-2.5 rounded-xl bg-surface-800/30 border border-surface-700/30 text-sm text-surface-400 font-mono select-all">
                  {systemMetrics.hostname}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-surface-400 mb-1.5 block">API Port Mapping</label>
                <div className="px-3 py-2.5 rounded-xl bg-surface-800/30 border border-surface-700/30 text-sm text-surface-400 font-mono">
                  3000 (Gateway)
                </div>
              </div>
            </div>

            <div className="border-t border-surface-700/30 pt-4">
              <h4 className="text-sm font-semibold text-white mb-3">Host Environment Details</h4>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <InfoRow label="Operating System" value={systemMetrics.os} />
                <InfoRow label="Kernel Version" value={systemMetrics.kernel} />
                <InfoRow label="NodeJS Version" value={systemMetrics.nodeVersion} />
                <InfoRow label="PM2 Daemon" value={`v${systemMetrics.pm2Version}`} />
                <InfoRow label="System Uptime" value={systemMetrics.uptimeSystem} />
                <InfoRow label="CPU Temperature" value={`${systemMetrics.temperature}°C`} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Notification Preferences</h3>
              <p className="text-xs text-surface-500">Choose what notifications to receive locally</p>
            </div>
            <LocalToggle label="Service Restart Alerts" description="Notify when a service is restarted by PM2 daemon" storageKey="notif_restart" defaultChecked />
            <LocalToggle label="Storage Warnings" description="Alert when disk usage exceeds 80%" storageKey="notif_storage" defaultChecked />
            <LocalToggle label="Security Alerts" description="Notify on failed login attempts or suspicious activity" storageKey="notif_security" defaultChecked />
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Appearance</h3>
              <p className="text-xs text-surface-500">Customize the look and feel of your local browser</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-3">Theme Selection</p>
              <div className="flex gap-3">
                {[
                  { name: 'Dark', bg: 'bg-surface-900', active: true },
                ].map(theme => (
                  <button
                    key={theme.name}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-brand-500/40 bg-brand-500/5 transition-all"
                  >
                    <div className={`w-16 h-10 ${theme.bg} rounded-lg border border-surface-700/30`} />
                    <span className="text-xs text-surface-300 font-semibold">{theme.name} (Active)</span>
                  </button>
                ))}
              </div>
            </div>
            <LocalToggle label="Compact Mode" description="Reduce spacing for more content density" storageKey="appearance_compact" />
            <LocalToggle label="Animations" description="Enable smooth transitions and animations" storageKey="appearance_animations" defaultChecked />
          </div>
        )}

        {/* Save button */}
        <div className="mt-8 pt-4 border-t border-surface-700/30 flex justify-end">
          <button
            onClick={() => {
              onQuotaUpdate();
              alert('Preferences saved successfully to local storage.');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 hover:-translate-y-0.5"
          >
            <Save className="w-4 h-4" /> Save Local Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-800/20">
      <span className="text-surface-500 font-medium">{label}</span>
      <span className="text-surface-300 font-semibold">{value}</span>
    </div>
  );
}
