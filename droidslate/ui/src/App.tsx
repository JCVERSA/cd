import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import type {
  AppEntry,
  AppSnapshot,
  DeGoogleStatus,
  Device,
  DeviceInfo,
  DirListing,
  FileEntry,
  LogRecord,
  ScreenshotRef,
} from './types'

type Page = 'devices' | 'apps' | 'files' | 'shell' | 'logcat' | 'degoogle' | 'settings'

const NAV: { id: Page; label: string; glyph: string }[] = [
  { id: 'devices', label: 'Devices', glyph: '▣' },
  { id: 'apps', label: 'Apps', glyph: '▦' },
  { id: 'files', label: 'Files', glyph: '◫' },
  { id: 'shell', label: 'Shell', glyph: '>_' },
  { id: 'logcat', label: 'Logcat', glyph: '≡' },
  { id: 'degoogle', label: 'DeGoogle', glyph: '⊘' },
  { id: 'settings', label: 'Settings', glyph: '⚙' },
]

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<Page>('devices')
  const [error, setError] = useState('')

  const applySnapshot = useCallback((next: AppSnapshot) => {
    setSnapshot(next)
    document.documentElement.dataset.theme = next.runtime.theme
  }, [])

  const refresh = useCallback(async () => {
    try {
      applySnapshot(await api.snapshot())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [applySnapshot])

  useEffect(() => {
    void refresh()
    // Shell/logcat output streams through the snapshot poll, so keep it snappy.
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selected = snapshot?.selectedDevice || ''
  const selectedDevice = useMemo(
    () => snapshot?.devices.find((item) => item.id === selected) || null,
    [snapshot, selected],
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="./droidslate-logo.png" alt="" />
          DroidSlate
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-btn${page === item.id ? ' active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="glyph">{item.glyph}</span>
            {item.label}
          </button>
        ))}
        <div className="spacer" />
        <div
          className={`status-chip${selectedDevice && selectedDevice.status === 'device' ? ' on' : ''}`}
          title={selected ? `Selected device: ${selected}` : 'No device selected'}
        >
          <span className="dot" />
          {selected
            ? selectedDevice?.model || selected
            : snapshot?.devices.length
              ? `${snapshot.devices.length} device(s)`
              : 'No device'}
        </div>
        <div className="status-chip" title={`ADB: ${snapshot?.runtime.adbPath || '…'} · uptime ${snapshot ? formatUptime(snapshot.runtime.uptimeSeconds) : '…'}`}>
          <span className={`dot${snapshot?.runtime.adbFound ? ' on' : ''}`} style={{ background: snapshot?.runtime.adbFound ? 'var(--accent)' : undefined }} />
          ADB {snapshot?.runtime.adbFound ? 'ready' : 'missing'}
        </div>
      </aside>

      <main className="main">
        {error ? (
          <div className="page-header">
            <div className="error">Connection error: {error}</div>
            <button className="btn small" onClick={() => void refresh()}>Retry</button>
          </div>
        ) : null}
        {!snapshot && !error ? (
          <div className="page-header">
            <div className="sub">Connecting to DroidSlate…</div>
          </div>
        ) : null}
        {snapshot ? (
          page === 'devices' ? (
            <DevicesPage snapshot={snapshot} onChanged={refresh} />
          ) : page === 'apps' ? (
            <AppsPage snapshot={snapshot} />
          ) : page === 'files' ? (
            <FilesPage snapshot={snapshot} />
          ) : page === 'shell' ? (
            <ShellPage snapshot={snapshot} />
          ) : page === 'logcat' ? (
            <LogcatPage snapshot={snapshot} onChanged={refresh} />
          ) : page === 'degoogle' ? (
            <DeGooglePage />
          ) : (
            <SettingsPage snapshot={snapshot} onChanged={refresh} />
          )
        ) : null}
      </main>
    </div>
  )
}

/* ---------------- Devices ---------------- */

function DevicesPage({ snapshot, onChanged }: { snapshot: AppSnapshot; onChanged: () => Promise<void> }) {
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [shot, setShot] = useState<ScreenshotRef | null>(null)
  const [rebootMode, setRebootMode] = useState<'normal' | 'recovery' | 'bootloader'>('normal')
  const [actionBusy, setActionBusy] = useState('')
  const [wifiIp, setWifiIp] = useState('')
  const [wifiBusy, setWifiBusy] = useState('')
  const [wifiStatus, setWifiStatus] = useState('')
  const [wifiStatusKind, setWifiStatusKind] = useState<'ok' | 'error'>('ok')
  const selected = snapshot.selectedDevice

  useEffect(() => {
    let cancelled = false
    api
      .latestScreenshot()
      .then((value) => {
        if (!cancelled && !('none' in value)) setShot(value)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setInfo(null)
    if (!selected) return
    let cancelled = false
    api
      .deviceInfo(selected)
      .then((value) => {
        if (!cancelled) setInfo(value)
      })
      .catch((err) => {
        if (!cancelled) setMessage(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  const select = async (device: Device) => {
    setBusy(true)
    setMessage('')
    try {
      await api.selectDevice(device.id === selected ? '' : device.id)
      await onChanged()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const wifiAction = async (action: 'get-ip' | 'enable-tcp' | 'connect' | 'disconnect') => {
    setWifiBusy(action)
    setWifiStatus('')
    try {
      if (action === 'get-ip') {
        const result = await api.wifiGetIp()
        setWifiIp(result.ip)
        setWifiStatusKind('ok')
        setWifiStatus(`Found device IP: ${result.ip} — now click Enable TCP/IP.`)
      } else if (action === 'enable-tcp') {
        const result = await api.wifiEnableTcp()
        setWifiStatusKind('ok')
        setWifiStatus(
          `Wi-Fi mode enabled on port ${result.port} — you can unplug USB now, then Connect.`,
        )
      } else if (action === 'connect') {
        const ip = wifiIp.trim()
        if (!ip) throw new Error('Enter the device IP first (Get IP fills it automatically).')
        const result = await api.wifiConnect(ip)
        setWifiStatusKind('ok')
        setWifiStatus(`Connected to ${result.target} — it now appears in the device list above.`)
        await onChanged()
      } else {
        const ip = wifiIp.trim()
        if (!ip) throw new Error('Enter the device IP to disconnect.')
        const result = await api.wifiDisconnect(ip)
        setWifiStatusKind('ok')
        setWifiStatus(`Disconnected ${result.target}.`)
        await onChanged()
      }
    } catch (err) {
      setWifiStatusKind('error')
      setWifiStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setWifiBusy('')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Devices</h1>
          <div className="sub">Refreshed automatically every 2.5 seconds</div>
        </div>
        <button
          className="btn"
          onClick={async () => {
            setBusy(true)
            try {
              await api.refreshDevices()
              await onChanged()
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      <div className="page-body">
        {message ? <div className="error" style={{ marginBottom: 10 }}>{message}</div> : null}
        {snapshot.devices.length === 0 ? (
          <div className="empty">
            No Android device detected.
            <br />
            Enable USB debugging, connect the device, then approve the RSA prompt.
          </div>
        ) : (
          <div className="device-list">
            {snapshot.devices.map((device) => (
              <div
                key={device.id}
                className={`device-card${device.id === selected ? ' selected' : ''}`}
                onClick={() => void select(device)}
              >
                <div className="device-glyph">▣</div>
                <div className="device-meta">
                  <div className="name">{device.model || device.product || 'Android device'}</div>
                  <div className="id">{device.id}</div>
                </div>
                <span className={`badge${device.status === 'device' ? ' ok' : ' warn'}`}>
                  {device.status === 'device' ? 'Connected' : device.status}
                </span>
              </div>
            ))}
          </div>
        )}
        {info ? (
          <div className="info-grid">
            {Object.entries(info).map(([key, value]) => (
              <div className="info-cell" key={key}>
                <div className="k">{key}</div>
                <div className="v">{value}</div>
              </div>
            ))}
          </div>
        ) : null}
        {selected ? (
          <div className="settings-card" style={{ marginTop: 16 }}>
            <h2>Device actions</h2>
            <div className="row">
              <button
                className="btn"
                disabled={Boolean(actionBusy)}
                onClick={async () => {
                  setActionBusy('shot')
                  setMessage('')
                  try {
                    setShot(await api.takeScreenshot())
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : String(err))
                  } finally {
                    setActionBusy('')
                  }
                }}
              >
                {actionBusy === 'shot' ? 'Capturing…' : 'Take screenshot'}
              </button>
              <select
                className="select"
                style={{ maxWidth: 190 }}
                value={rebootMode}
                onChange={(event) => setRebootMode(event.target.value as typeof rebootMode)}
              >
                <option value="normal">Reboot: system</option>
                <option value="recovery">Reboot: recovery</option>
                <option value="bootloader">Reboot: bootloader</option>
              </select>
              <button
                className="btn danger"
                disabled={Boolean(actionBusy)}
                onClick={async () => {
                  const label =
                    rebootMode === 'normal' ? 'reboot normally' : `boot into ${rebootMode}`
                  if (!window.confirm(`Really ${label}?`)) return
                  setActionBusy('reboot')
                  setMessage('')
                  try {
                    await api.reboot(rebootMode)
                    setMessage(`Reboot command sent (${rebootMode}).`)
                    await onChanged()
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : String(err))
                  } finally {
                    setActionBusy('')
                  }
                }}
              >
                {actionBusy === 'reboot' ? 'Rebooting…' : 'Reboot'}
              </button>
            </div>
            {shot ? (
              <div className="shot-result">
                <img src={shot.url} alt="Latest screenshot" />
                <div className="shot-meta">
                  <div className="hint">{shot.path}</div>
                  <button
                    className="btn small"
                    onClick={async () => {
                      try {
                        await api.openScreenshotsFolder()
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : String(err))
                      }
                    }}
                  >
                    Open folder
                  </button>
                </div>
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 10 }}>
                No screenshot yet — capture the current screen to save it as a PNG.
              </div>
            )}
          </div>
        ) : null}
        {selected ? (
          <div className="settings-card" style={{ marginTop: 16 }}>
            <h2>WiFi (no cable)</h2>
            <div className="desc">
              One-time USB flow: <strong>Get IP</strong> → <strong>Enable TCP/IP</strong> →
              unplug the cable → <strong>Connect</strong>. Phone and computer must share the
              same Wi-Fi network.
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                value={wifiIp}
                placeholder="192.168.1.25"
                aria-label="Device IP"
                onChange={(event) => setWifiIp(event.target.value)}
              />
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('get-ip')}
              >
                {wifiBusy === 'get-ip' ? 'Reading…' : 'Get IP'}
              </button>
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('enable-tcp')}
              >
                {wifiBusy === 'enable-tcp' ? 'Enabling…' : 'Enable TCP/IP'}
              </button>
              <button
                className="btn primary"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('connect')}
              >
                {wifiBusy === 'connect' ? 'Connecting…' : 'Connect'}
              </button>
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('disconnect')}
              >
                {wifiBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
            {wifiStatus ? (
              <div className={wifiStatusKind === 'error' ? 'error' : 'hint'}>{wifiStatus}</div>
            ) : (
              <div className="hint">
                TCP/IP mode lasts until the phone reboots. Legacy ADB over TCP is
                unencrypted — only use it on a trusted network.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

/* ---------------- Apps ---------------- */

type AppFilter = 'all' | 'user' | 'system'

function AppsPage({ snapshot }: { snapshot: AppSnapshot }) {
  const [apps, setApps] = useState<AppEntry[] | null>(null)
  const [filter, setFilter] = useState<AppFilter>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [installPhase, setInstallPhase] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = snapshot.selectedDevice

  const load = useCallback(async () => {
    if (!selected) {
      setApps(null)
      return
    }
    setBusy('load')
    try {
      const result = await api.listApps()
      setApps(result.apps)
      setMessage('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [selected])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (phase: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(phase)
    setMessage('')
    try {
      await action()
      if (done) setMessage(done)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const installFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    setBusy('install')
    setMessage('')
    try {
      setInstallPhase(`Uploading 1/${list.length}…`)
      const staged: string[] = []
      for (let index = 0; index < list.length; index += 1) {
        setInstallPhase(`Uploading ${index + 1}/${list.length}…`)
        const stagedFile = await api.stageApk(list[index])
        staged.push(stagedFile.name)
      }
      setInstallPhase(staged.length > 1 ? `Installing ${staged.length} split APKs…` : 'Installing…')
      await api.installStaged(staged)
      setMessage(`Installed ${staged.length === 1 ? staged[0] : `${staged.length} split APKs`}.`)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setInstallPhase('')
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const visible = useMemo(() => {
    if (!apps) return []
    const needle = search.trim().toLowerCase()
    return apps.filter((app) => {
      if (filter === 'user' && app.system) return false
      if (filter === 'system' && !app.system) return false
      if (needle && !app.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [apps, filter, search])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Apps</h1>
          <div className="sub">
            {selected ? `${apps ? apps.length : '…'} packages on ${selected}` : 'Select a device first'}
          </div>
        </div>
        <div className="row">
          <input
            ref={fileRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            multiple
            hidden
            onChange={(event) => void installFiles(event.target.files)}
          />
          <button
            className="btn primary"
            disabled={!selected || Boolean(busy)}
            onClick={() => fileRef.current?.click()}
          >
            Install APK…
          </button>
          <button className="btn" disabled={!selected || Boolean(busy)} onClick={() => void load()}>
            {busy === 'load' ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="page-body">
        {message ? (
          <div className={message.startsWith('Installed') ? 'saved' : 'error'} style={{ marginBottom: 10 }}>
            {message}
          </div>
        ) : null}
        {installPhase ? <div className="hint" style={{ marginBottom: 10 }}>{installPhase}</div> : null}
        {!selected ? (
          <div className="empty">Select a connected device to manage its apps.</div>
        ) : !apps ? (
          <div className="empty">{busy === 'load' ? 'Loading packages…' : 'No package list yet.'}</div>
        ) : (
          <>
            <div className="logcat-toolbar">
              <input
                className="input"
                style={{ maxWidth: 320 }}
                placeholder="Search packages…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="seg">
                {(['all', 'user', 'system'] as AppFilter[]).map((value) => (
                  <button
                    key={value}
                    className={filter === value ? 'active' : ''}
                    onClick={() => setFilter(value)}
                  >
                    {value === 'all' ? 'All' : value === 'user' ? 'User' : 'System'}
                  </button>
                ))}
              </div>
              <span className="hint">{visible.length} shown</span>
            </div>
            <div className="device-list">
              {visible.length === 0 ? (
                <div className="empty">No packages match this filter.</div>
              ) : (
                visible.map((app) => (
                  <div className="app-row" key={app.name}>
                    <div className="device-meta">
                      <div className="name mono">{app.name}</div>
                      <div className="badges">
                        <span className="badge">{app.system ? 'System' : 'User'}</span>
                        {app.disabled ? <span className="badge warn">Disabled</span> : null}
                        {!app.installed ? <span className="badge warn">Uninstalled</span> : null}
                      </div>
                    </div>
                    <div className="row">
                      {app.installed ? (
                        <>
                          <button
                            className="btn small"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void runAction(
                                `enable-${app.name}`,
                                () => api.setAppEnabled(app.name, app.disabled),
                                `${app.disabled ? 'Enabled' : 'Disabled'} ${app.name}.`,
                              )
                            }
                          >
                            {busy === `enable-${app.name}` ? '…' : app.disabled ? 'Enable' : 'Disable'}
                          </button>
                          <button
                            className="btn small danger"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void runAction(
                                `uninstall-${app.name}`,
                                () => api.uninstallApp(app.name),
                                `Uninstalled ${app.name}.`,
                              )
                            }
                          >
                            {busy === `uninstall-${app.name}` ? '…' : 'Uninstall'}
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn small"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void runAction(
                              `reinstall-${app.name}`,
                              () => api.reinstallApp(app.name),
                              `Restored ${app.name}.`,
                            )
                          }
                        >
                          {busy === `reinstall-${app.name}` ? '…' : 'Reinstall'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ---------------- Files ---------------- */

type SortKey = 'name' | 'size' | 'modified'
type PaneKind = 'local' | 'device'

interface PaneData {
  path: string
  parent: string | null
  entries: FileEntry[]
  drives: string[] | null
  selected: string | null
  sortKey: SortKey
  sortAsc: boolean
}

const EMPTY_PANE: PaneData = {
  path: '', parent: null, entries: [], drives: null,
  selected: null, sortKey: 'name', sortAsc: true,
}

function pathSep(dir: string): string {
  return /^[A-Za-z]:[\\/]/.test(dir) ? '\\' : '/'
}

function joinPath(dir: string, name: string): string {
  if (!dir) return name
  const sep = pathSep(dir)
  return dir.endsWith('\\') || dir.endsWith('/') ? dir + name : dir + sep + name
}

function sortEntries(entries: FileEntry[], key: SortKey, asc: boolean): FileEntry[] {
  const factor = asc ? 1 : -1
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    let value = 0
    if (key === 'name') value = a.name.localeCompare(b.name, undefined, { numeric: true })
    else if (key === 'size') value = a.size - b.size
    else value = a.modified.localeCompare(b.modified)
    return factor * value
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

// Display names the original tool special-cases, else .capitalize() per part.
const FRIENDLY_NAMES: Record<string, string> = {
  'com.google.android.carlink': 'Android Auto',
}

function friendlyName(pkg: string): string {
  if (FRIENDLY_NAMES[pkg]) return FRIENDLY_NAMES[pkg]
  return pkg.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

interface DragPayload {
  kind: PaneKind
  entry: FileEntry
  fullPath: string
}

function FilePane({
  title,
  kind,
  data,
  loading,
  disabled,
  quickPaths,
  dragPayload,
  onNavigate,
  onSelect,
  onSort,
  onOpen,
  onDropEntry,
  onDragStateChange,
  headerExtra,
  emptyMessage,
}: {
  title: string
  kind: PaneKind
  data: PaneData
  loading: boolean
  disabled?: boolean
  quickPaths?: { label: string; path: string }[]
  dragPayload: DragPayload | null
  onNavigate: (path: string) => void
  onSelect: (name: string | null) => void
  onSort: (key: SortKey) => void
  onOpen: (entry: FileEntry) => void
  onDropEntry: (payload: DragPayload) => void
  onDragStateChange: (payload: DragPayload | null) => void
  headerExtra?: ReactNode
  emptyMessage: string
}) {
  const [draft, setDraft] = useState(data.path)
  const [dropActive, setDropActive] = useState(false)
  useEffect(() => {
    setDraft(data.path)
  }, [data.path])

  const canDrop = Boolean(dragPayload && dragPayload.kind !== kind)
  const entries = sortEntries(data.entries, data.sortKey, data.sortAsc)

  const column = (key: SortKey, label: string, className: string) => (
    <button className={`col ${className}${data.sortKey === key ? ' sorted' : ''}`}
      onClick={() => onSort(key)}>
      {label}{data.sortKey === key ? (data.sortAsc ? ' ▲' : ' ▼') : ''}
    </button>
  )

  return (
    <div
      className={`file-pane${dropActive && canDrop ? ' drop-ready' : ''}`}
      onDragOver={(event) => {
        if (!canDrop) return
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDropActive(false)
        if (canDrop && dragPayload) onDropEntry(dragPayload)
      }}
    >
      <div className="pane-head">
        <span className="pane-title">{title}</span>
        {headerExtra}
      </div>
      <div className="pane-path">
        <button className="btn small" disabled={!data.parent} onClick={() => data.parent && onNavigate(data.parent)}>
          Up
        </button>
        <input
          className="input"
          value={draft}
          placeholder={disabled ? 'Select a device first' : 'Path…'}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && draft.trim()) onNavigate(draft.trim())
          }}
        />
        <button className="btn small" disabled={disabled || !draft.trim()}
          onClick={() => onNavigate(draft.trim())}>
          Go
        </button>
        <button className="btn small" disabled={disabled || loading}
          onClick={() => data.path && onNavigate(data.path)}>
          ⟳
        </button>
      </div>
      {quickPaths && quickPaths.length > 0 ? (
        <div className="quick-paths">
          {quickPaths.map((item) => (
            <button key={item.path} className="btn small" onClick={() => onNavigate(item.path)}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {data.drives && data.drives.length > 0 ? (
        <div className="quick-paths">
          {data.drives.map((drive) => (
            <button key={drive} className="btn small" onClick={() => onNavigate(drive)}>
              {drive}
            </button>
          ))}
        </div>
      ) : null}
      <div className="file-table">
        <div className="file-head">
          {column('name', 'Name', 'grow')}
          {column('size', 'Size', 'num')}
          {column('modified', 'Modified', 'date')}
        </div>
        <div className="file-rows">
          {disabled || (!loading && entries.length === 0) ? (
            <div className="empty tight">{disabled ? emptyMessage : loading ? 'Loading…' : emptyMessage}</div>
          ) : (
            entries.map((entry) => {
              const fullPath = joinPath(data.path, entry.name)
              return (
                <div
                  key={entry.name}
                  className={`file-row${data.selected === entry.name ? ' selected' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy'
                    event.dataTransfer.setData('text/plain', fullPath)
                    onDragStateChange({ kind, entry, fullPath })
                  }}
                  onDragEnd={() => onDragStateChange(null)}
                  onClick={() => onSelect(entry.name)}
                  onDoubleClick={() => onOpen(entry)}
                >
                  <span className="col grow name">
                    <span className="row-glyph">{entry.is_dir ? '▸' : '·'}</span>
                    {entry.name}
                    {entry.is_link ? ' →' : ''}
                  </span>
                  <span className="col num">{entry.is_dir ? '' : formatSize(entry.size)}</span>
                  <span className="col date">{entry.modified}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function FilesPage({ snapshot }: { snapshot: AppSnapshot }) {
  const [local, setLocal] = useState<PaneData>(EMPTY_PANE)
  const [device, setDevice] = useState<PaneData>(EMPTY_PANE)
  const [localLoading, setLocalLoading] = useState(false)
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const devicePathRef = useRef('/sdcard')
  const selectedDevice = snapshot.selectedDevice

  const loadLocal = useCallback(async (path: string) => {
    setLocalLoading(true)
    try {
      const listing: DirListing = await api.localDir(path)
      setLocal((prev) => ({
        ...prev,
        path: listing.path,
        parent: listing.parent,
        entries: listing.entries,
        drives: listing.drives ?? null,
        selected: null,
      }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLocalLoading(false)
    }
  }, [])

  const loadDevice = useCallback(async (path: string) => {
    setDeviceLoading(true)
    try {
      const listing: DirListing = await api.deviceDir(path)
      devicePathRef.current = listing.path
      setDevice((prev) => ({
        ...prev,
        path: listing.path,
        parent: listing.parent,
        entries: listing.entries,
        selected: null,
      }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setDeviceLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLocal('')
  }, [loadLocal])

  useEffect(() => {
    if (!selectedDevice) {
      devicePathRef.current = '/sdcard'
      setDevice(EMPTY_PANE)
      return
    }
    void loadDevice(devicePathRef.current || '/sdcard')
  }, [selectedDevice, loadDevice])

  const withBusy = async (phase: string, action: () => Promise<void>) => {
    setBusy(phase)
    setMessage('')
    try {
      await action()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const openEntry = (kind: PaneKind, entry: FileEntry) => {
    if (!entry.is_dir) return
    const base = kind === 'local' ? local : device
    void (kind === 'local' ? loadLocal : loadDevice)(joinPath(base.path, entry.name))
  }

  const handleDrop = (target: PaneKind) => async (payload: DragPayload) => {
    if (payload.kind === target) return
    await withBusy('transfer', async () => {
      if (target === 'device') {
        if (!device.path) throw new Error('Select a device first.')
        const destination = joinPath(device.path, payload.entry.name)
        await api.pushFile(payload.fullPath, destination)
        setMessage(`Pushed ${payload.entry.name} → ${destination}`)
        await loadDevice(device.path)
      } else {
        const destination = joinPath(local.path, payload.entry.name)
        await api.pullFile(payload.fullPath, destination)
        setMessage(`Pulled ${payload.entry.name} → ${destination}`)
        await loadLocal(local.path)
      }
    })
  }

  const deviceSelected = device.selected
    ? device.entries.find((item) => item.name === device.selected)
    : undefined

  const deviceActions = (
    <>
      <button className="btn small" disabled={!selectedDevice || Boolean(busy)}
        onClick={() => void withBusy('pick', async () => {
          const result = await api.pushPick(device.path || '/sdcard')
          if (result.cancelled) return
          setMessage(`Pushed ${result.pushed ?? 0} file(s)${result.failed ? `, ${result.failed} failed` : ''}.`)
          if (device.path) await loadDevice(device.path)
        })}>
        Push file…
      </button>
      <button className="btn small" disabled={!deviceSelected || deviceSelected.is_dir || Boolean(busy)}
        onClick={() => void withBusy('save', async () => {
          const target = joinPath(device.path, deviceSelected!.name)
          const result = await api.saveAs(target)
          if (result.cancelled) return
          setMessage(`Saved to ${result.path}`)
        })}>
        Save as…
      </button>
      <button className="btn small" disabled={!selectedDevice || Boolean(busy)}
        onClick={() => void withBusy('mkdir', async () => {
          const name = window.prompt('New folder name:')
          if (!name || !name.trim()) return
          await api.deviceMkdir(joinPath(device.path, name.trim()))
          setMessage(`Created ${name.trim()}.`)
          await loadDevice(device.path)
        })}>
        New folder
      </button>
      <button className="btn small" disabled={!deviceSelected || Boolean(busy)}
        onClick={() => void withBusy('rename', async () => {
          const name = window.prompt('New name:', deviceSelected!.name)
          if (!name || !name.trim() || name.trim() === deviceSelected!.name) return
          await api.deviceRename(
            joinPath(device.path, deviceSelected!.name),
            joinPath(device.path, name.trim()),
          )
          setMessage(`Renamed to ${name.trim()}.`)
          await loadDevice(device.path)
        })}>
        Rename
      </button>
      <button className="btn small danger" disabled={!deviceSelected || Boolean(busy)}
        onClick={() => void withBusy('delete', async () => {
          const target = joinPath(device.path, deviceSelected!.name)
          if (!window.confirm(`Delete ${deviceSelected!.name} from the device?`)) return
          await api.deviceDelete(target)
          setMessage(`Deleted ${deviceSelected!.name}.`)
          await loadDevice(device.path)
        })}>
        Delete
      </button>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Files</h1>
          <div className="sub">
            Drag rows between panes to push (→ device) or pull (← PC). Drop only — not external Explorer windows.
          </div>
        </div>
        <div className="row">
          <span className={`badge${busy ? ' warn' : ' ok'}`}>
            {busy ? 'Working…' : 'Ready'}
          </span>
        </div>
      </div>
      <div className="page-body">
        {message ? <div className="hint" style={{ marginBottom: 8 }}>{message}</div> : null}
        <div className="file-panes">
          <FilePane
            title="This PC"
            kind="local"
            data={local}
            loading={localLoading}
            dragPayload={drag}
            onNavigate={(path) => void loadLocal(path)}
            onSelect={(name) => setLocal((prev) => ({ ...prev, selected: name }))}
            onSort={(key) => setLocal((prev) => ({
              ...prev,
              sortKey: key,
              sortAsc: prev.sortKey === key ? !prev.sortAsc : true,
            }))}
            onOpen={(entry) => openEntry('local', entry)}
            onDropEntry={handleDrop('device')}
            onDragStateChange={setDrag}
            emptyMessage="This folder is empty."
          />
          <FilePane
            title="Android device"
            kind="device"
            data={device}
            loading={deviceLoading}
            disabled={!selectedDevice}
            quickPaths={[
              { label: 'sdcard', path: '/sdcard' },
              { label: 'tmp', path: '/data/local/tmp' },
              { label: 'root', path: '/' },
            ]}
            dragPayload={drag}
            headerExtra={deviceActions}
            onNavigate={(path) => void loadDevice(path)}
            onSelect={(name) => setDevice((prev) => ({ ...prev, selected: name }))}
            onSort={(key) => setDevice((prev) => ({
              ...prev,
              sortKey: key,
              sortAsc: prev.sortKey === key ? !prev.sortAsc : true,
            }))}
            onOpen={(entry) => openEntry('device', entry)}
            onDropEntry={handleDrop('local')}
            onDragStateChange={setDrag}
            emptyMessage={selectedDevice ? 'This folder is empty.' : 'Select a device to browse it.'}
          />
        </div>
      </div>
    </>
  )
}

/* ---------------- DeGoogle ---------------- */

function DeGooglePage() {
  const [status, setStatus] = useState<DeGoogleStatus | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'simple' | 'custom'>('simple')
  const [action, setAction] = useState<'disable' | 'uninstall'>('disable')
  const [includeRisky, setIncludeRisky] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [undoDisabled, setUndoDisabled] = useState<Set<string>>(new Set())
  const [undoUninstalled, setUndoUninstalled] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await api.deGoogleStatus())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 2000)
    return () => window.clearInterval(timer)
  }, [load])

  // When switching to Custom, pre-select the installed safe bucket.
  useEffect(() => {
    if (mode !== 'custom' || !status?.installed) return
    setPicked(new Set(status.installed.safe ?? []))
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset undo selections whenever a new state snapshot arrives (after a run).
  useEffect(() => {
    if (!status) return
    setUndoDisabled(new Set(status.state.disabled))
    setUndoUninstalled(new Set(status.state.uninstalled))
  }, [status?.state.updated]) // eslint-disable-line react-hooks/exhaustive-deps

  const job = status?.job
  const installed = status?.installed
  const running = Boolean(job?.running)
  const hasUndo = Boolean(status && (status.state.disabled.length > 0 || status.state.uninstalled.length > 0))

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      await api.deGoogleRun({
        mode,
        action,
        includeRisky,
        packages: mode === 'custom' ? [...picked] : undefined,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    setBusy(true)
    setError('')
    try {
      await api.deGoogleUndo({
        disabled: [...undoDisabled],
        uninstalled: [...undoUninstalled],
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const bucketDetails = (key: 'safe' | 'risky' | 'unsafe', label: string) => {
    const list = installed?.[key] ?? []
    return (
      <details className={`bucket bucket-${key}`} key={key} open={key === 'safe'}>
        <summary>
          {label} — {list.length} installed
          {key === 'unsafe' ? ' ⚠' : ''}
        </summary>
        <div className="bucket-list">
          {list.length === 0 ? (
            <div className="hint">None of these are installed.</div>
          ) : (
            list.map((pkg) => (
              <label className="check-row" key={pkg}>
                <input
                  type="checkbox"
                  checked={picked.has(pkg)}
                  disabled={running || busy}
                  onChange={(event) => {
                    const next = new Set(picked)
                    if (event.target.checked) next.add(pkg)
                    else next.delete(pkg)
                    setPicked(next)
                  }}
                />
                <span className="mono" title={pkg}>{friendlyName(pkg)}</span>
              </label>
            ))
          )}
        </div>
      </details>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>DeGoogle</h1>
          <div className="sub">
            {status?.device
              ? `Working on ${status.device}`
              : 'Select a device first'}
            {installed ? ` · ${installed.safe.length + installed.risky.length + installed.unsafe.length} catalog packages installed` : ''}
          </div>
        </div>
        <button className="btn" disabled={busy || running} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div className="page-body">
        {error ? <div className="error" style={{ marginBottom: 10 }}>{error}</div> : null}
        {!status?.device ? (
          <div className="empty">Select a connected device to run DeGoogle.</div>
        ) : (
          <>
            {running ? (
              <div className="settings-card">
                <h2>{job?.phase === 'undo' ? 'Restoring packages…' : 'Removing packages…'}</h2>
                <div className="desc">
                  {job?.done ?? 0}/{job?.total ?? 0}
                  {job?.current ? ` · ${job.current}` : ''}
                </div>
                <div className="progress">
                  <div
                    className="progress-fill"
                    style={{ width: `${job && job.total ? Math.round((job.done / job.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="settings-card">
              <h2>Mode</h2>
              <div className="desc">
                <strong>Simple</strong> removes optional Google apps (never system-critical ones).
                <strong> Custom</strong> lets you pick every catalog package, including unsafe ones.
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <div className="seg">
                  <button className={mode === 'simple' ? 'active' : ''}
                    onClick={() => setMode('simple')} disabled={running || busy}>
                    Simple
                  </button>
                  <button className={mode === 'custom' ? 'active' : ''}
                    onClick={() => setMode('custom')} disabled={running || busy}>
                    Custom
                  </button>
                </div>
                <div className="seg">
                  <button className={action === 'disable' ? 'active' : ''}
                    onClick={() => setAction('disable')} disabled={running || busy}>
                    Disable
                  </button>
                  <button className={action === 'uninstall' ? 'active' : ''}
                    onClick={() => setAction('uninstall')} disabled={running || busy}>
                    Uninstall for user
                  </button>
                </div>
              </div>
              {mode === 'simple' ? (
                <label className="check-row">
                  <input type="checkbox" checked={includeRisky} disabled={running || busy}
                    onChange={(event) => setIncludeRisky(event.target.checked)} />
                  Also include risky services (login / sync adapters — may break Google sign-in and sync)
                </label>
              ) : (
                <div className="buckets">
                  {bucketDetails('safe', 'Safe')}
                  {bucketDetails('risky', 'Risky')}
                  {bucketDetails('unsafe', 'Unsafe ⚠')}
                  <div className="error" style={{ marginTop: 8 }}>
                    Unsafe packages can bootloop the device or kill camera, network, launcher and OTA.
                    Only select them if you know exactly what you are doing.
                  </div>
                </div>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" disabled={running || busy}
                  onClick={() => void run()}>
                  {busy ? 'Starting…' : mode === 'simple'
                    ? `Run Simple cleanup (${action === 'disable' ? 'disable' : 'uninstall'})`
                    : `Run Custom selection (${picked.size})`}
                </button>
              </div>
              {job?.lastRun && !running ? (
                <div className="hint" style={{ marginTop: 10 }}>
                  Last run ({job.lastRun.finished}): {job.lastRun.disabled.length} disabled,{' '}
                  {job.lastRun.uninstalled.length} uninstalled, {job.lastRun.failed.length} failed.
                  {job.lastRun.failed.length > 0 ? (
                    <div className="error">
                      {job.lastRun.failed.slice(0, 5).map((item) => `${item.package}: ${item.error}`).join(' · ')}
                      {job.lastRun.failed.length > 5 ? ' …' : ''}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="settings-card">
              <h2>Undo</h2>
              <div className="desc">
                Restore packages this device previously removed through DeGoogle (enabled / reinstalled
                for your user account).
              </div>
              {!hasUndo ? (
                <div className="hint">Nothing to restore for this device.</div>
              ) : (
                <>
                  {status.state.disabled.length > 0 ? (
                    <div className="bucket-list" style={{ marginBottom: 8 }}>
                      <div className="hint">Disabled ({status.state.disabled.length}):</div>
                      {status.state.disabled.map((pkg) => (
                        <label className="check-row" key={pkg}>
                          <input type="checkbox" checked={undoDisabled.has(pkg)} disabled={running || busy}
                            onChange={(event) => {
                              const next = new Set(undoDisabled)
                              if (event.target.checked) next.add(pkg)
                              else next.delete(pkg)
                              setUndoDisabled(next)
                            }} />
                          <span className="mono" title={pkg}>{friendlyName(pkg)}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {status.state.uninstalled.length > 0 ? (
                    <div className="bucket-list" style={{ marginBottom: 8 }}>
                      <div className="hint">Uninstalled ({status.state.uninstalled.length}):</div>
                      {status.state.uninstalled.map((pkg) => (
                        <label className="check-row" key={pkg}>
                          <input type="checkbox" checked={undoUninstalled.has(pkg)} disabled={running || busy}
                            onChange={(event) => {
                              const next = new Set(undoUninstalled)
                              if (event.target.checked) next.add(pkg)
                              else next.delete(pkg)
                              setUndoUninstalled(next)
                            }} />
                          <span className="mono" title={pkg}>{friendlyName(pkg)}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <button className="btn" disabled={running || busy} onClick={() => void undo()}>
                    {busy ? 'Starting…' : `Restore ${undoDisabled.size + undoUninstalled.size} package(s)`}
                  </button>
                  {job?.lastUndo && !running ? (
                    <div className="hint" style={{ marginTop: 10 }}>
                      Last restore ({job.lastUndo.finished}): {job.lastUndo.restored.length} restored,{' '}
                      {job.lastUndo.failed.length} failed.
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ---------------- Shell ---------------- */

function ShellPage({ snapshot }: { snapshot: AppSnapshot }) {
  const [command, setCommand] = useState('')
  const [running, setRunning] = useState(false)
  const [clientError, setClientError] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)

  const selected = snapshot.selectedDevice
  // The backend appends every prompt and output line to its bounded log with tag SHELL.
  const shellLogs = snapshot.logs.filter((record) => record.tag === 'SHELL')

  useEffect(() => {
    const el = outputRef.current
    // jsdom does not implement scrollTo; real browsers do.
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight })
  }, [shellLogs.length])

  const submit = async () => {
    const value = command.trim()
    if (!value || running) return
    setRunning(true)
    setCommand('')
    setClientError('')
    setHistory((prev) => [value, ...prev].slice(0, 50))
    setHistoryIndex(-1)
    try {
      await api.runShell(value)
    } catch (err) {
      // The backend log is the UI's output stream; surface request failures inline.
      setClientError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Shell</h1>
          <div className="sub">{selected ? `Running on ${selected}` : 'Select a device first'}</div>
        </div>
        <span className="hint">Output is streamed from the device</span>
      </div>
      <div className="page-body">
        <div className="shell">
          <div className="shell-output" ref={outputRef}>
            {shellLogs.length === 0 ? (
              <span className="shell-line out">
                Run any adb shell command, e.g. <span className="prompt">getprop ro.build.version.release</span>
              </span>
            ) : (
              shellLogs.map((record) => {
                const isPrompt = record.message.startsWith('$ ')
                const kind = record.level === 'ERROR' ? 'err' : isPrompt ? 'prompt' : 'out'
                return (
                  <div key={record.id} className={`shell-line ${kind}`}>
                    {isPrompt ? record.message : record.message || ' '}
                  </div>
                )
              })
            )}
          </div>
          <div className="shell-input-row">
            <input
              className="input"
              placeholder={selected ? 'Enter shell command…' : 'Select a device to use the shell'}
              value={command}
              disabled={!selected || running}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                } else if (event.key === 'ArrowUp' && history.length) {
                  event.preventDefault()
                  const next = Math.min(historyIndex + 1, history.length - 1)
                  setHistoryIndex(next)
                  setCommand(history[next])
                } else if (event.key === 'ArrowDown' && historyIndex >= 0) {
                  event.preventDefault()
                  const next = historyIndex - 1
                  setHistoryIndex(next)
                  setCommand(next >= 0 ? history[next] : '')
                }
              }}
            />
            <button className="btn primary" onClick={() => void submit()} disabled={!selected || running || !command.trim()}>
              {running ? 'Running…' : 'Run'}
            </button>
          </div>
          {clientError ? <div className="error" style={{ marginTop: 8 }}>{clientError}</div> : null}
          <div className="hint" style={{ marginTop: 8 }}>
            Output appears above. ↑/↓ browse your command history. A leading <code>adb shell</code> is stripped automatically.
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- Logcat ---------------- */

function LogcatPage({ snapshot, onChanged }: { snapshot: AppSnapshot; onChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState('')
  const [clientError, setClientError] = useState('')
  const viewRef = useRef<HTMLDivElement>(null)
  const followRef = useRef(true)

  const logs = snapshot.logs.filter((record) => record.tag === 'LOGCAT')
  const selected = snapshot.selectedDevice
  const running = snapshot.logcat.running

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) return logs
    return logs.filter((record) => record.message.toLowerCase().includes(needle))
  }, [logs, filter])

  useEffect(() => {
    const el = viewRef.current
    if (el && followRef.current && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [visible.length])

  const toggle = async () => {
    setClientError('')
    try {
      if (running) await api.stopLogcat()
      else await api.startLogcat()
      await onChanged()
    } catch (err) {
      setClientError(err instanceof Error ? err.message : String(err))
      await onChanged()
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Logcat</h1>
          <div className="sub">{running ? `Streaming ${snapshot.logcat.serial || ''}` : 'Not streaming'}</div>
        </div>
        <button
          className={`btn ${running ? 'danger' : 'primary'}`}
          onClick={() => void toggle()}
          disabled={!selected}
        >
          {running ? 'Stop' : 'Start'}
        </button>
      </div>
      <div className="page-body">
        <div className="shell">
          <div className="logcat-toolbar">
            <input
              className="input"
              style={{ maxWidth: 320 }}
              placeholder="Filter output…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <span className="hint">{visible.length} line(s)</span>
            {clientError ? <span className="error" style={{ marginLeft: 'auto' }}>{clientError}</span> : null}
          </div>
          <div
            className="logcat-view"
            ref={viewRef}
            onScroll={() => {
              const el = viewRef.current
              if (!el) return
              followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            }}
          >
            {visible.length === 0 ? (
              <div className="hint">
                {!selected
                  ? 'Select a device first.'
                  : running
                    ? 'Waiting for log output…'
                    : 'Press Start to stream the device log.'}
              </div>
            ) : (
              visible.map((record: LogRecord) => (
                <div key={record.id} className={`log-line ${record.level}`}>
                  <span className="time">{record.time}</span>
                  <span className="tag">{record.level}</span>
                  <span className="msg">{record.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- Settings ---------------- */

function SettingsPage({ snapshot, onChanged }: { snapshot: AppSnapshot; onChanged: () => Promise<void> }) {
  const [adbPath, setAdbPath] = useState(snapshot.settings.adbPath)
  const [theme, setTheme] = useState(snapshot.settings.theme)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setAdbPath(snapshot.settings.adbPath)
    setTheme(snapshot.settings.theme)
  }, [snapshot.settings.adbPath, snapshot.settings.theme])

  const save = async (patch: { adbPath?: string; theme?: 'dark' | 'light' }) => {
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await api.saveSettings(patch)
      document.documentElement.dataset.theme = patch.theme ?? document.documentElement.dataset.theme
      await onChanged()
      setSaved('Saved.')
      window.setTimeout(() => setSaved(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="sub">DroidSlate {snapshot.runtime.version}</div>
        </div>
      </div>
      <div className="page-body">
        <div className="settings-card">
          <h2>ADB location</h2>
          <div className="desc">
            DroidSlate bundles its own adb binary. Set a custom path only if you need a
            specific platform-tools version. Leave empty to use the bundled/PATH copy.
          </div>
          <div className="row">
            <input
              className="input"
              placeholder={snapshot.runtime.adbPath || 'e.g. C:\\Android\\platform-tools\\adb.exe'}
              value={adbPath}
              onChange={(event) => setAdbPath(event.target.value)}
            />
            <button className="btn primary" onClick={() => void save({ adbPath })} disabled={saving}>
              Save
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            Active: <code>{snapshot.runtime.adbPath}</code>
            {snapshot.runtime.adbFound ? ' · found' : ' · not found'}
          </div>
          {error ? <div className="error" style={{ marginTop: 8 }}>{error}</div> : null}
        </div>

        <div className="settings-card">
          <h2>Appearance</h2>
          <div className="desc">Choose the dashboard color theme.</div>
          <div className="row">
            <div className="seg">
              <button
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => {
                  setTheme('dark')
                  void save({ theme: 'dark' })
                }}
              >
                Dark
              </button>
              <button
                className={theme === 'light' ? 'active' : ''}
                onClick={() => {
                  setTheme('light')
                  void save({ theme: 'light' })
                }}
              >
                Light
              </button>
            </div>
            {saved ? <span className="saved">{saved}</span> : null}
          </div>
        </div>
      </div>
    </>
  )
}
