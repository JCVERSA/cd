import type { AppEntry, AppSnapshot, Device, DeviceInfo, ScreenshotRef, Settings } from './types'

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

// Raw-body variant for APK uploads (the shared request() helper is JSON-only).
async function rawRequest(path: string, body: BodyInit, contentType: string): Promise<unknown> {
  await sessionReady
  const response = await fetch(path, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': contentType,
    },
    body,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `Upload failed (${response.status})` }))
    throw new Error(payload.error || `Upload failed (${response.status})`)
  }
  return response.json()
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

  async listApps(): Promise<{ apps: AppEntry[]; device: string }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return request('/api/v1/apps')
  },

  async stageApk(file: File): Promise<{ name: string; size: number }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return rawRequest(
      `/api/v1/apps/stage?name=${encodeURIComponent(file.name)}`,
      await file.arrayBuffer(),
      'application/octet-stream',
    ) as Promise<{ name: string; size: number }>
  },

  async installStaged(files: string[]): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return request('/api/v1/apps/install', { method: 'POST', body: JSON.stringify({ files }) })
  },

  async uninstallApp(pkg: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return request('/api/v1/apps/uninstall', { method: 'POST', body: JSON.stringify({ package: pkg }) })
  },

  async reinstallApp(pkg: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return request('/api/v1/apps/reinstall', { method: 'POST', body: JSON.stringify({ package: pkg }) })
  },

  async setAppEnabled(pkg: string, enabled: boolean): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('App management is available in the desktop app.')
    return request('/api/v1/apps/enable', {
      method: 'POST',
      body: JSON.stringify({ package: pkg, enabled }),
    })
  },

  async takeScreenshot(): Promise<ScreenshotRef> {
    if (!isDesktopHost) throw new Error('Screenshots are available in the desktop app.')
    return request('/api/v1/screenshot', { method: 'POST', body: '{}' })
  },

  async latestScreenshot(): Promise<ScreenshotRef | { none: true }> {
    if (!isDesktopHost) return { none: true }
    return request('/api/v1/screenshots/latest')
  },

  async openScreenshotsFolder(): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('This is available in the desktop app.')
    return request('/api/v1/screenshots/open-folder', { method: 'POST', body: '{}' })
  },

  async reboot(mode: 'normal' | 'recovery' | 'bootloader'): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('Reboot is available in the desktop app.')
    return request('/api/v1/reboot', { method: 'POST', body: JSON.stringify({ mode }) })
  },
}
