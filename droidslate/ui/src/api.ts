import type { AppSnapshot, Device, DeviceInfo, Settings } from './types'

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
let bootstrapCapability = hashParams.get('session') || ''
const desktopMarker = new URLSearchParams(window.location.search).get('desktop') === '1'
const isDesktopHost = Boolean(bootstrapCapability || desktopMarker)

async function establishSession() {
  if (!bootstrapCapability) return
  const response = await fetch('/api/v1/session', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bootstrapCapability}`,
    },
    body: '{}',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Session setup failed (${response.status})` }))
    throw new Error(body.error || `Session setup failed (${response.status})`)
  }
  bootstrapCapability = ''
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

const sessionReady = isDesktopHost ? establishSession() : Promise.resolve()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await sessionReady
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

// Offline preview used only by `npm run dev` outside the packaged desktop host.
const previewSnapshot: AppSnapshot = {
  runtime: { version: '1.0.0-preview', adbPath: 'adb', adbFound: true, uptimeSeconds: 0, theme: 'dark' },
  devices: [],
  selectedDevice: '',
  settings: { adbPath: '', theme: 'dark' },
  logcat: { running: false, serial: null },
  logs: [],
}

export const api = {
  isDesktopHost,

  async snapshot(): Promise<AppSnapshot> {
    if (!isDesktopHost) return structuredClone(previewSnapshot)
    return request<AppSnapshot>('/api/v1/snapshot')
  },

  async refreshDevices(): Promise<Device[]> {
    if (!isDesktopHost) return []
    return request<Device[]>('/api/v1/devices')
  },

  async selectDevice(serial: string): Promise<{ selectedDevice: string }> {
    if (!isDesktopHost) return { selectedDevice: serial }
    return request('/api/v1/devices/select', { method: 'POST', body: JSON.stringify({ serial }) })
  },

  async deviceInfo(serial: string): Promise<DeviceInfo> {
    if (!isDesktopHost) throw new Error('Device details are available in the desktop app.')
    return request<DeviceInfo>('/api/v1/devices/info', { method: 'POST', body: JSON.stringify({ serial }) })
  },

  async runShell(command: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('Shell is available in the desktop app.')
    return request('/api/v1/shell/run', { method: 'POST', body: JSON.stringify({ command }) })
  },

  async startLogcat(): Promise<{ running: boolean }> {
    if (!isDesktopHost) return { running: false }
    return request('/api/v1/logcat/start', { method: 'POST', body: '{}' })
  },

  async stopLogcat(): Promise<{ running: boolean }> {
    if (!isDesktopHost) return { running: false }
    return request('/api/v1/logcat/stop', { method: 'POST', body: '{}' })
  },

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    if (!isDesktopHost) return { ...previewSnapshot.settings, ...patch }
    return request<Settings>('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(patch) })
  },
}
