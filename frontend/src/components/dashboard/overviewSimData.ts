/**
 * Locally-scoped, self-contained simulation data for the Overview dashboard.
 *
 * Per the integration plan (§5.1/§5.2): request volume, CPU/memory trends,
 * and the service grid are explicitly-approved simulations meant to feel
 * alive — they are NOT real telemetry (the gateway does not expose internal
 * service metrics to the browser). Real figures (file/note/vault/bookmark
 * counts, quota usage) come from the API and are computed in Overview.tsx
 * itself, not here.
 *
 * This file has no dependency on any removed mockData module — it is
 * self-sufficient so Overview.tsx compiles standalone.
 */

export interface OverviewService {
  id: string;
  name: string;
  gradient: string;
  cpu: number;
  memoryMB: number;
  restarts: number;
}

// Mirrors the 8 real MiniCloud processes (gateway + 7 services) declared in
// ecosystem.config.js — kept in sync with ServicesPanel.tsx's service list.
export const services: OverviewService[] = [
  { id: 'mc-gateway', name: 'Gateway', gradient: 'from-blue-500 to-blue-700', cpu: 3, memoryMB: 42, restarts: 0 },
  { id: 'mc-auth', name: 'Auth', gradient: 'from-emerald-500 to-emerald-700', cpu: 2, memoryMB: 38, restarts: 0 },
  { id: 'mc-files', name: 'Files', gradient: 'from-violet-500 to-violet-700', cpu: 5, memoryMB: 51, restarts: 0 },
  { id: 'mc-notes', name: 'Notes', gradient: 'from-amber-500 to-amber-700', cpu: 1, memoryMB: 33, restarts: 0 },
  { id: 'mc-gallery', name: 'Gallery', gradient: 'from-pink-500 to-pink-700', cpu: 4, memoryMB: 47, restarts: 0 },
  { id: 'mc-vault', name: 'Vault', gradient: 'from-red-500 to-red-700', cpu: 2, memoryMB: 36, restarts: 0 },
  { id: 'mc-bookmarks', name: 'Bookmarks', gradient: 'from-indigo-500 to-indigo-700', cpu: 1, memoryMB: 31, restarts: 0 },
  { id: 'mc-admin', name: 'Admin', gradient: 'from-teal-500 to-teal-700', cpu: 1, memoryMB: 29, restarts: 0 },
];

export const systemMetrics = {
  cpuUsage: 14,
  loadAvg: [0.42, 0.38, 0.35],
  memoryUsed: 1.8,
  memoryUsage: 62,
  memoryTotal: 2.9,
  temperature: 48,
  uptimeSystem: '14d 6h',
  networkOut: 2.1,
  networkIn: 4.3,
  hostname: 'minicloud',
  os: 'Linux (Debian-based)',
  kernel: '6.6.31',
  nodeVersion: '20.x',
  pm2Version: '5.4',
};

export function generateRequestData(): { time: string; requests: number; errors: number; latency: number }[] {
  const points = [];
  for (let h = 0; h < 24; h++) {
    const base = 40 + Math.sin(h / 3) * 20 + Math.random() * 15;
    points.push({
      time: `${String(h).padStart(2, '0')}:00`,
      requests: Math.max(0, Math.round(base)),
      errors: Math.round(Math.random() * 3),
      latency: Math.round(35 + Math.random() * 40),
    });
  }
  return points;
}

export function generateTimeSeriesData(points: number, base: number, variance: number): { time: string; value: number }[] {
  const out = [];
  for (let i = 0; i < points; i++) {
    const value = Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance * 2));
    out.push({ time: `${i}h`, value: Math.round(value * 10) / 10 });
  }
  return out;
}
