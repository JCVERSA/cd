import type {
  AppEntry,
  AppSnapshot,
  BundleInspect,
  BundleInstallResult,
  DeGoogleStatus,
  Device,
  DeviceInfo,
  DirListing,
  PickResult,
  ScreenshotRef,
  Settings,
  TransferResult,
  WifiConnectResult,
  WifiIpResult,
  WifiTcpResult,
} from './types'

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

  // -- files ---------------------------------------------------------------

  async localDir(path: string): Promise<DirListing> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request(`/api/v1/files/local?path=${encodeURIComponent(path)}`)
  },

  async deviceDir(path: string): Promise<DirListing> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request(`/api/v1/files/device?path=${encodeURIComponent(path)}`)
  },

  async pushFile(localPath: string, devicePath: string): Promise<TransferResult> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/push', {
      method: 'POST',
      body: JSON.stringify({ localPath, devicePath }),
    })
  },

  async pullFile(devicePath: string, localPath: string): Promise<TransferResult> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/pull', {
      method: 'POST',
      body: JSON.stringify({ devicePath, localPath }),
    })
  },

  async pushPick(deviceDir: string): Promise<PickResult> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/push-pick', {
      method: 'POST',
      body: JSON.stringify({ deviceDir }),
    })
  },

  async saveAs(devicePath: string): Promise<PickResult & { path?: string }> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/save-as', {
      method: 'POST',
      body: JSON.stringify({ devicePath }),
    })
  },

  async deviceMkdir(path: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/device-mkdir', { method: 'POST', body: JSON.stringify({ path }) })
  },

  async deviceRename(from: string, to: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/device-rename', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    })
  },

  async deviceDelete(path: string): Promise<{ ok: boolean }> {
    if (!isDesktopHost) throw new Error('File Explorer is available in the desktop app.')
    return request('/api/v1/files/device-delete', { method: 'POST', body: JSON.stringify({ path }) })
  },

  // -- degoogle ------------------------------------------------------------

  async deGoogleStatus(): Promise<DeGoogleStatus> {
    if (!isDesktopHost) throw new Error('DeGoogle is available in the desktop app.')
    return request('/api/v1/degoogle')
  },

  async deGoogleRun(payload: {
    mode: 'simple' | 'custom'
    action: 'disable' | 'uninstall'
    includeRisky?: boolean
    packages?: string[]
  }): Promise<{ started: boolean; total: number }> {
    if (!isDesktopHost) throw new Error('DeGoogle is available in the desktop app.')
    return request('/api/v1/degoogle/run', { method: 'POST', body: JSON.stringify(payload) })
  },

  async deGoogleUndo(payload: { disabled?: string[]; uninstalled?: string[] }): Promise<{ started: boolean; total: number }> {
    if (!isDesktopHost) throw new Error('DeGoogle is available in the desktop app.')
    return request('/api/v1/degoogle/undo', { method: 'POST', body: JSON.stringify(payload) })
  },

  // -- wireless (WiFi) ------------------------------------------------------

  async wifiGetIp(): Promise<WifiIpResult> {
    if (!isDesktopHost) throw new Error('WiFi connect is available in the desktop app.')
    return request('/api/v1/wifi/get-ip', { method: 'POST', body: '{}' })
  },

  async wifiEnableTcp(port?: number): Promise<WifiTcpResult> {
    if (!isDesktopHost) throw new Error('WiFi connect is available in the desktop app.')
    return request('/api/v1/wifi/enable-tcp', { method: 'POST', body: JSON.stringify({ port }) })
  },

  async wifiConnect(ip: string, port?: number): Promise<WifiConnectResult> {
    if (!isDesktopHost) throw new Error('WiFi connect is available in the desktop app.')
    return request('/api/v1/wifi/connect', { method: 'POST', body: JSON.stringify({ ip, port }) })
  },

  async wifiDisconnect(ip: string, port?: number): Promise<WifiConnectResult> {
    if (!isDesktopHost) throw new Error('WiFi connect is available in the desktop app.')
    return request('/api/v1/wifi/disconnect', { method: 'POST', body: JSON.stringify({ ip, port }) })
  },

  // -- installer -------------------------------------------------------------

  async uploadBundle(file: File): Promise<{ name: string; size: number }> {
    if (!isDesktopHost) throw new Error('The Installer is available in the desktop app.')
    await sessionReady
    // The File body is streamed from disk by the browser — no arrayBuffer(),
    // so multi-gigabyte bundles never sit in JS memory.
    const response = await fetch(
      `/api/v1/installer/stage?name=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      },
    )
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: `Upload failed (${response.status})` }))
      throw new Error(body.error || `Upload failed (${response.status})`)
    }
    return response.json() as Promise<{ name: string; size: number }>
  },

  async inspectBundle(filename: string): Promise<BundleInspect> {
    if (!isDesktopHost) throw new Error('The Installer is available in the desktop app.')
    return request('/api/v1/installer/inspect', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    })
  },

  async installBundle(
    filename: string,
    options: { reinstall: boolean; downgrade: boolean; grant: boolean; obb: boolean },
  ): Promise<BundleInstallResult> {
    if (!isDesktopHost) throw new Error('The Installer is available in the desktop app.')
    return request('/api/v1/installer/install', {
      method: 'POST',
      body: JSON.stringify({ filename, options }),
    })
  },
}
