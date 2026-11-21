import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import type { AppEntry, AppSnapshot, Device, DeviceInfo, LogRecord, ScreenshotRef } from './types'

type Page = 'devices' | 'apps' | 'shell' | 'logcat' | 'settings'

const NAV: { id: Page; label: string; glyph: string }[] = [
  { id: 'devices', label: 'Devices', glyph: '▣' },
  { id: 'apps', label: 'Apps', glyph: '▦' },
  { id: 'shell', label: 'Shell', glyph: '>_' },
  { id: 'logcat', label: 'Logcat', glyph: '≡' },
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
          ) : page === 'shell' ? (
            <ShellPage snapshot={snapshot} />
          ) : page === 'logcat' ? (
            <LogcatPage snapshot={snapshot} onChanged={refresh} />
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
