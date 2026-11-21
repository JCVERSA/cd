import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import { I18nProvider, useI18n, useT, type DictKey } from './i18n'
import type {
  AdbUpdates,
  AccentId,
  AppEntry,
  AppSnapshot,
  BundleInspect,
  BundleInstallResult,
  DeGoogleStatus,
  Device,
  DeviceInfo,
  DirListing,
  FileEntry,
  LogRecord,
  MdnsService,
  MirrorProcess,
  MirrorStatus,
  MirrorVersion,
  ScreenshotRef,
  ScrcpyConfig,
  ThemeMode,
} from './types'

type Page = 'devices' | 'mirror' | 'apps' | 'installer' | 'files' | 'shell' | 'logcat' | 'degoogle' | 'settings'

const NAV: { id: Page; labelKey: DictKey; glyph: string }[] = [
  { id: 'devices', labelKey: 'nav.devices', glyph: '▣' },
  { id: 'mirror', labelKey: 'nav.mirror', glyph: '▷' },
  { id: 'apps', labelKey: 'nav.apps', glyph: '▦' },
  { id: 'installer', labelKey: 'nav.installer', glyph: '⬇' },
  { id: 'files', labelKey: 'nav.files', glyph: '◫' },
  { id: 'shell', labelKey: 'nav.shell', glyph: '>_' },
  { id: 'logcat', labelKey: 'nav.logcat', glyph: '≡' },
  { id: 'degoogle', labelKey: 'nav.degoogle', glyph: '⊘' },
  { id: 'settings', labelKey: 'nav.settings', glyph: '⚙' },
]

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolveThemeMode(mode: string): 'dark' | 'light' {
  if (mode === 'dark' || mode === 'light') return mode
  return prefersDark() ? 'dark' : 'light'
}

const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'emerald', label: 'Emerald', color: '#3ddc84' },
  { id: 'violet', label: 'Violet', color: '#a78bfa' },
  { id: 'nebula', label: 'Nebula', color: '#60a5fa' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'crimson', label: 'Crimson', color: '#f43f5e' },
]

export default function App() {
  return (
    <I18nProvider>
      <AppShell />
    </I18nProvider>
  )
}

function AppShell() {
  const t = useT()
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [page, setPage] = useState<Page>('devices')
  const [error, setError] = useState('')
  const [onboardingClosed, setOnboardingClosed] = useState(() => {
    try {
      return window.localStorage.getItem('droidslate.onboarding') === '1'
    } catch {
      return true
    }
  })
  const [onboardingForced, setOnboardingForced] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [dropOverlay, setDropOverlay] = useState(false)

  const applySnapshot = useCallback((next: AppSnapshot) => {
    setSnapshot(next)
    document.documentElement.dataset.theme = resolveThemeMode(next.runtime.theme)
    document.documentElement.dataset.accent = next.settings.accent || 'emerald'
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

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof query.addEventListener !== 'function') return
    const onChange = () => {
      if (snapshot && snapshot.runtime.theme === 'system') {
        document.documentElement.dataset.theme = resolveThemeMode('system')
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [snapshot])

  const selected = snapshot?.selectedDevice || ''
  const selectedDevice = useMemo(
    () => snapshot?.devices.find((item) => item.id === selected) || null,
    [snapshot, selected],
  )

  const showOnboarding = Boolean(
    snapshot && (onboardingForced || (!onboardingClosed && snapshot.devices.length === 0)),
  )

  const dismissOnboarding = () => {
    setOnboardingClosed(true)
    setOnboardingForced(false)
    try {
      window.localStorage.setItem('droidslate.onboarding', '1')
    } catch {
      // localStorage may be unavailable — the session-level close still applies.
    }
  }

  const handleDroppedFiles = async (files: File[]) => {
    const isBundle = (name: string) =>
      BUNDLE_EXTS.some((ext) => name.toLowerCase().endsWith(ext))
    const bundles = files.filter((file) => isBundle(file.name))
    if (bundles.length > 0) {
      setPendingFiles(bundles)
      setPage('installer')
      return
    }
    if (!snapshot?.selectedDevice) {
      window.alert(t('drop.needDevice'))
      return
    }
    let pushed = 0
    for (const file of files) {
      if (!window.confirm(t('drop.pushConfirm', { name: file.name }))) continue
      try {
        await api.dropFile(file)
        pushed += 1
      } catch (err) {
        window.alert(
          t('drop.pushFailed', {
            name: file.name,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    }
    if (pushed > 0) window.alert(t('drop.pushedCount', { n: pushed }))
    await refresh()
  }

  return (
    <div
      className="app"
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropOverlay(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setDropOverlay(false)
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) return
        event.preventDefault()
        setDropOverlay(false)
        void handleDroppedFiles(Array.from(event.dataTransfer.files))
      }}
    >
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
            {t(item.labelKey)}
          </button>
        ))}
        <button
          className="nav-btn"
          onClick={() => setOnboardingForced(true)}
          title={t('onb.title')}
        >
          <span className="glyph">?</span>
          {t('side.help')}
        </button>
        <div className="spacer" />
        <div
          className={`status-chip${selectedDevice && selectedDevice.status === 'device' ? ' on' : ''}`}
          title={selected ? t('side.selected', { id: selected }) : t('side.noSelected')}
        >
          <span className="dot" />
          {selected
            ? selectedDevice?.model || selected
            : snapshot?.devices.length
              ? t('side.deviceCount', { n: snapshot.devices.length })
              : t('side.noDevice')}
        </div>
        <div
          className="status-chip"
          title={t('side.adbTitle', {
            path: snapshot?.runtime.adbPath || '…',
            uptime: snapshot ? formatUptime(snapshot.runtime.uptimeSeconds) : '…',
          })}
        >
          <span className={`dot${snapshot?.runtime.adbFound ? ' on' : ''}`} style={{ background: snapshot?.runtime.adbFound ? 'var(--accent)' : undefined }} />
          {snapshot?.runtime.adbFound ? t('side.adbReady') : t('side.adbMissing')}
        </div>
      </aside>

      <main className="main">
        {error ? (
          <div className="page-header">
            <div className="error">{t('app.connectionError', { error })}</div>
            <button className="btn small" onClick={() => void refresh()}>{t('app.retry')}</button>
          </div>
        ) : null}

        {snapshot ? (
          page === 'devices' ? (
            <DevicesPage snapshot={snapshot} onChanged={refresh} />
          ) : page === 'mirror' ? (
            <MirrorPage snapshot={snapshot} />
          ) : page === 'apps' ? (
            <AppsPage snapshot={snapshot} />
          ) : page === 'installer' ? (
            <InstallerPage
              snapshot={snapshot}
              pendingFiles={pendingFiles}
              onPendingConsumed={() => setPendingFiles([])}
            />
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
      {!snapshot && !error ? (
        <div className="splash">
          <img src="./droidslate-logo.png" alt="" />
          <div className="splash-name">DroidSlate</div>
          <div className="splash-sub">{t('app.connecting')}</div>
        </div>
      ) : null}
      {dropOverlay ? (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <div className="dz-title">{t('drop.title')}</div>
            <div className="hint">{t('drop.hint')}</div>
          </div>
        </div>
      ) : null}
      {showOnboarding ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('onb.title')}
        >
          <div className="modal-card">
            <h2>{t('onb.title')}</h2>
            <ol className="onb-steps">
              <li>{t('onb.step1')}</li>
              <li>{t('onb.step2')}</li>
              <li>{t('onb.step3')}</li>
              <li>{t('onb.step4')}</li>
            </ol>
            <div className="row">
              <button className="btn primary" onClick={dismissOnboarding}>
                {t('onb.dismiss')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- Mirror ---------------- */

const MIRROR_STORAGE_KEY = 'droidslate.scrcpy'

const DEFAULT_MIRROR_CONFIG: ScrcpyConfig = {
  codec: 'h264',
  audio: true,
  audioCodec: 'opus',
  bitrate: 8,
  maxSize: 0,
  fps: 0,
  rotation: '0',
  alwaysOnTop: false,
  fullscreen: false,
  borderless: false,
  stayAwake: false,
  turnScreenOff: false,
  keepActive: false,
  record: false,
  recordPath: '',
}

function loadMirrorConfig(): ScrcpyConfig {
  try {
    const raw = window.localStorage.getItem(MIRROR_STORAGE_KEY)
    if (raw) return { ...DEFAULT_MIRROR_CONFIG, ...(JSON.parse(raw) as Partial<ScrcpyConfig>) }
  } catch {
    // Corrupt or unavailable storage — fall back to defaults.
  }
  return { ...DEFAULT_MIRROR_CONFIG }
}

function MirrorPage({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT()
  const device = snapshot.selectedDevice
  const [config, setConfig] = useState<ScrcpyConfig>(loadMirrorConfig)
  const [version, setVersion] = useState<MirrorVersion | null>(null)
  const [status, setStatus] = useState<Record<string, MirrorProcess>>({})
  const [logs, setLogs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [updates, setUpdates] = useState<AdbUpdates | null>(null)
  const [checking, setChecking] = useState(false)

  const active = Boolean(status[device]?.running)

  useEffect(() => {
    try {
      window.localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(config))
    } catch {
      // Private mode — the config simply won't persist.
    }
  }, [config])

  useEffect(() => {
    let cancelled = false
    api
      .mirrorVersion()
      .then((value) => {
        if (!cancelled) setVersion(value)
      })
      .catch(() => {
        // Version is informational only; the page still works without it.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!device) return
    let cancelled = false
    const tick = async () => {
      try {
        const next: MirrorStatus = await api.mirrorStatus()
        if (cancelled) return
        setStatus(next.processes)
        if (next.processes[device]?.running) {
          const session = await api.mirrorLogs(device, 200)
          if (!cancelled) setLogs(session.lines)
        }
      } catch {
        // Transient poll failure — the next tick retries.
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 1500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [device])

  const update = <K extends keyof ScrcpyConfig>(key: K, value: ScrcpyConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      await api.mirrorStart(device, config)
    } catch (exc) {
      setError(t('mirror.failed', { error: exc instanceof Error ? exc.message : String(exc) }))
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    setError('')
    try {
      await api.mirrorStop(device)
      setLogs([])
    } catch (exc) {
      setError(t('mirror.failed', { error: exc instanceof Error ? exc.message : String(exc) }))
    } finally {
      setBusy(false)
    }
  }

  const checkUpdates = async () => {
    setChecking(true)
    try {
      setUpdates(await api.mirrorCheckUpdate())
    } catch (exc) {
      setUpdates({
        localVersion: null,
        latestVersion: null,
        updateAvailable: false,
        error: exc instanceof Error ? exc.message : String(exc),
        url: '',
      })
    } finally {
      setChecking(false)
    }
  }

  const startDisabled = !device || busy || active || (version !== null && !version.found)

  return (
    <section>
      <h1>{t('mirror.title')}</h1>
      <p className="hint">{t('mirror.sub')}</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {version?.found ? (
          <span className="hint">{t('mirror.version', { version: version.version ?? '?' })}</span>
        ) : null}
        <button className="btn small" disabled={checking} onClick={() => void checkUpdates()}>
          {checking ? t('set.checking') : t('set.checkUpdates')}
        </button>
        {updates?.updateAvailable ? (
          <a className="btn primary" href={updates.url} target="_blank" rel="noreferrer">
            {t('set.openDownloadPage')}
          </a>
        ) : null}
      </div>
      {version && !version.found ? <p className="error">{t('mirror.notFound')}</p> : null}
      {updates && !updates.updateAvailable && !updates.error ? (
        <p className="hint">
          {t('mirror.upToDate', { version: updates.latestVersion ?? updates.localVersion ?? '?' })}
        </p>
      ) : null}
      {updates?.error ? <p className="error">{updates.error}</p> : null}
      {!device ? <p className="hint">{t('mirror.noDevice')}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn primary" disabled={startDisabled} onClick={() => void start()}>
          {t('mirror.start')}
        </button>
        <button
          className="btn danger"
          disabled={!device || busy || !active}
          onClick={() => void stop()}
        >
          {t('mirror.stop')}
        </button>
        {active ? (
          <span className="hint">{t('mirror.running', { pid: status[device]?.pid ?? 0 })}</span>
        ) : null}
      </div>

      <div className="mirror-grid">
        <div>
          <h3>{t('mirror.video')}</h3>
          <div className="field">
            <label htmlFor="mirror-codec">{t('mirror.codec')}</label>
            <select
              id="mirror-codec"
              value={config.codec}
              disabled={active}
              onChange={(event) => update('codec', event.target.value as ScrcpyConfig['codec'])}
            >
              <option value="h264">H.264</option>
              <option value="h265">H.265</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mirror-bitrate">{t('mirror.bitrate')}</label>
            <select
              id="mirror-bitrate"
              value={config.bitrate}
              disabled={active}
              onChange={(event) => update('bitrate', Number(event.target.value))}
            >
              {[2, 4, 8, 12, 16, 24, 50].map((value) => (
                <option key={value} value={value}>
                  {t('mirror.mbps', { n: value })}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mirror-fps">{t('mirror.fps')}</label>
            <select
              id="mirror-fps"
              value={config.fps}
              disabled={active}
              onChange={(event) => update('fps', Number(event.target.value))}
            >
              <option value={0}>{t('mirror.fpsAuto')}</option>
              {[30, 60, 90, 120].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mirror-size">{t('mirror.maxSize')}</label>
            <select
              id="mirror-size"
              value={config.maxSize}
              disabled={active}
              onChange={(event) => update('maxSize', Number(event.target.value))}
            >
              <option value={0}>{t('mirror.sizeAuto')}</option>
              {[800, 1280, 1920, 2560].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mirror-rotation">{t('mirror.rotation')}</label>
            <select
              id="mirror-rotation"
              value={config.rotation}
              disabled={active}
              onChange={(event) => update('rotation', event.target.value as ScrcpyConfig['rotation'])}
            >
              <option value="0">{t('mirror.rot0')}</option>
              <option value="1">{t('mirror.rot1')}</option>
              <option value="2">{t('mirror.rot2')}</option>
              <option value="3">{t('mirror.rot3')}</option>
            </select>
          </div>
        </div>

        <div>
          <h3>{t('mirror.audio')}</h3>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={config.audio}
                disabled={active}
                onChange={(event) => update('audio', event.target.checked)}
              />{' '}
              {t('mirror.audio')}
            </label>
          </div>
          <div className="field">
            <label htmlFor="mirror-acodec">{t('mirror.codec')}</label>
            <select
              id="mirror-acodec"
              value={config.audioCodec}
              disabled={active || !config.audio}
              onChange={(event) =>
                update('audioCodec', event.target.value as ScrcpyConfig['audioCodec'])
              }
            >
              <option value="opus">Opus</option>
              <option value="aac">AAC</option>
              <option value="flac">FLAC</option>
              <option value="raw">Raw</option>
            </select>
          </div>

          <h3>{t('mirror.window')}</h3>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={config.alwaysOnTop}
                disabled={active}
                onChange={(event) => update('alwaysOnTop', event.target.checked)}
              />{' '}
              {t('mirror.alwaysOnTop')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.fullscreen}
                disabled={active}
                onChange={(event) => update('fullscreen', event.target.checked)}
              />{' '}
              {t('mirror.fullscreen')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.borderless}
                disabled={active}
                onChange={(event) => update('borderless', event.target.checked)}
              />{' '}
              {t('mirror.borderless')}
            </label>
          </div>
        </div>

        <div>
          <h3>{t('mirror.behavior')}</h3>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={config.stayAwake}
                disabled={active}
                onChange={(event) => update('stayAwake', event.target.checked)}
              />{' '}
              {t('mirror.stayAwake')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.turnScreenOff}
                disabled={active}
                onChange={(event) => update('turnScreenOff', event.target.checked)}
              />{' '}
              {t('mirror.turnScreenOff')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.keepActive}
                disabled={active}
                onChange={(event) => update('keepActive', event.target.checked)}
              />{' '}
              {t('mirror.keepActive')}
            </label>
          </div>

          <h3>{t('mirror.record')}</h3>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={config.record}
                disabled={active}
                onChange={(event) => update('record', event.target.checked)}
              />{' '}
              {t('mirror.record')}
            </label>
            <label htmlFor="mirror-record-path">{t('mirror.recordPath')}</label>
            <input
              id="mirror-record-path"
              className="input"
              type="text"
              value={config.recordPath}
              disabled={active || !config.record}
              placeholder={t('mirror.recordPathHint')}
              onChange={(event) => update('recordPath', event.target.value)}
            />
          </div>
        </div>
      </div>

      <h3>{t('mirror.logs')}</h3>
      <pre className="mirror-logs">{logs.length ? logs.join('\n') : t('mirror.noLogs')}</pre>
    </section>
  )
}

/* ---------------- Devices ---------------- */

function DevicesPage({ snapshot, onChanged }: { snapshot: AppSnapshot; onChanged: () => Promise<void> }) {
  const t = useT()
  const [info, setInfo] = useState<DeviceInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [shot, setShot] = useState<ScreenshotRef | null>(null)
  const [rebootMode, setRebootMode] = useState<'normal' | 'recovery' | 'bootloader'>('normal')
  const [actionBusy, setActionBusy] = useState('')
  const [wifiIp, setWifiIp] = useState('')
  const [wifiPort, setWifiPort] = useState('5555')
  const [wifiBusy, setWifiBusy] = useState('')
  const [wifiStatus, setWifiStatus] = useState('')
  const [wifiStatusKind, setWifiStatusKind] = useState<'ok' | 'error'>('ok')
  const [pairServices, setPairServices] = useState<MdnsService[] | null>(null)
  const [pairTarget, setPairTarget] = useState('')
  const [pairCode, setPairCode] = useState('')
  const [pairBusy, setPairBusy] = useState<'' | 'discover' | 'pair'>('')
  const [pairStatus, setPairStatus] = useState('')
  const [pairStatusKind, setPairStatusKind] = useState<'ok' | 'error'>('ok')
  const [restartBusy, setRestartBusy] = useState(false)
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('error')
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
        setWifiStatus(t('wifi.foundIp', { ip: result.ip }))
      } else if (action === 'enable-tcp') {
        const result = await api.wifiEnableTcp()
        setWifiStatusKind('ok')
        setWifiStatus(t('wifi.tcpEnabled', { port: result.port }))
      } else if (action === 'connect') {
        const ip = wifiIp.trim()
        if (!ip) throw new Error(t('wifi.needIp'))
        const result = await api.wifiConnect(
          ip,
          wifiPort.trim() ? Number(wifiPort) : undefined,
        )
        setWifiStatusKind('ok')
        setWifiStatus(t('wifi.connected', { target: result.target }))
        await onChanged()
      } else {
        const ip = wifiIp.trim()
        if (!ip) throw new Error(t('wifi.needIpDisconnect'))
        const result = await api.wifiDisconnect(
          ip,
          wifiPort.trim() ? Number(wifiPort) : undefined,
        )
        setWifiStatusKind('ok')
        setWifiStatus(t('wifi.disconnected', { target: result.target }))
        await onChanged()
      }
    } catch (err) {
      setWifiStatusKind('error')
      setWifiStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setWifiBusy('')
    }
  }

  const discoverServices = async () => {
    setPairBusy('discover')
    setPairStatus('')
    try {
      const result = await api.wifiMdns()
      setPairServices(result.services)
      const first = result.services.find((item) => item.type === 'pairing')
      if (first) setPairTarget(first.target)
      setPairStatusKind('ok')
    } catch (err) {
      setPairStatusKind('error')
      setPairStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setPairBusy('')
    }
  }

  const pairDevice = async () => {
    const target = pairTarget.trim()
    const code = pairCode.trim()
    if (!target) {
      setPairStatusKind('error')
      setPairStatus(t('wifi.needService'))
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setPairStatusKind('error')
      setPairStatus(t('wifi.needCode'))
      return
    }
    setPairBusy('pair')
    setPairStatus('')
    try {
      const result = await api.wifiPair(target, code)
      setPairStatusKind('ok')
      setPairStatus(t('wifi.paired', { target: result.target }))
      setPairCode('')
      await onChanged()
    } catch (err) {
      setPairStatusKind('error')
      setPairStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setPairBusy('')
    }
  }

  const restartAdb = async () => {
    setRestartBusy(true)
    setMessage('')
    try {
      await api.adbRestart()
      setMessageKind('ok')
      setMessage(t('wifi.restarted'))
      await onChanged()
    } catch (err) {
      setMessageKind('error')
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setRestartBusy(false)
    }
  }

  const pairingServices = (pairServices ?? []).filter((item) => item.type === 'pairing')

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('devices.title')}</h1>
          <div className="sub">{t('devices.sub')}</div>
        </div>
        <div className="row">
          <button
            className="btn"
            disabled={busy || restartBusy}
            onClick={() => void restartAdb()}
          >
            {restartBusy ? t('wifi.restarting') : t('wifi.restartAdb')}
          </button>
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
            {t('devices.refresh')}
          </button>
        </div>
      </div>
      <div className="page-body">
        {message ? (
          <div className={messageKind === 'ok' ? 'saved' : 'error'} style={{ marginBottom: 10 }}>
            {message}
          </div>
        ) : null}
        {snapshot.devices.length === 0 ? (
          <div className="empty">
            {t('devices.emptyTitle')}
            <br />
            {t('devices.emptyHint')}
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
                  <div className="name">{device.model || device.product || t('devices.fallbackName')}</div>
                  <div className="id">{device.id}</div>
                </div>
                <span className={`badge${device.status === 'device' ? ' ok' : ' warn'}`}>
                  {device.status === 'device' ? t('devices.connected') : device.status}
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
            <h2>{t('devices.actions')}</h2>
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
                {actionBusy === 'shot' ? t('devices.capturing') : t('devices.takeScreenshot')}
              </button>
              <select
                className="select"
                style={{ maxWidth: 190 }}
                value={rebootMode}
                onChange={(event) => setRebootMode(event.target.value as typeof rebootMode)}
              >
                <option value="normal">{t('devices.rebootSystem')}</option>
                <option value="recovery">{t('devices.rebootRecovery')}</option>
                <option value="bootloader">{t('devices.rebootBootloader')}</option>
              </select>
              <button
                className="btn danger"
                disabled={Boolean(actionBusy)}
                onClick={async () => {
                  const label =
                    rebootMode === 'normal'
                      ? t('devices.rebootLabelNormal')
                      : t('devices.rebootLabelMode', { mode: rebootMode })
                  if (!window.confirm(t('devices.rebootConfirm', { label }))) return
                  setActionBusy('reboot')
                  setMessage('')
                  try {
                    await api.reboot(rebootMode)
                    setMessage(t('devices.rebootSent', { mode: rebootMode }))
                    await onChanged()
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : String(err))
                  } finally {
                    setActionBusy('')
                  }
                }}
              >
                {actionBusy === 'reboot' ? t('devices.rebooting') : t('devices.reboot')}
              </button>
            </div>
            {shot ? (
              <div className="shot-result">
                <img src={shot.url} alt={t('devices.screenshotAlt')} />
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
                    {t('devices.openFolder')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="hint" style={{ marginTop: 10 }}>
                {t('devices.noScreenshot')}
              </div>
            )}
          </div>
        ) : null}
        {selected ? (
          <div className="settings-card" style={{ marginTop: 16 }}>
            <h2>{t('wifi.title')}</h2>
            <div className="desc">
              {t('wifi.descLead')} <strong>{t('wifi.stepGetIp')}</strong> →{' '}
              <strong>{t('wifi.stepEnableTcp')}</strong> → {t('wifi.descUnplug')} →{' '}
              <strong>{t('wifi.stepConnect')}</strong>. {t('wifi.descSameNetwork')}
            </div>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                className="input"
                style={{ maxWidth: 220 }}
                value={wifiIp}
                placeholder="192.168.1.25"
                aria-label={t('wifi.ipAria')}
                onChange={(event) => setWifiIp(event.target.value)}
              />
              <input
                className="input"
                style={{ maxWidth: 84 }}
                value={wifiPort}
                placeholder="5555"
                aria-label={t('wifi.portAria')}
                onChange={(event) => setWifiPort(event.target.value)}
              />
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('get-ip')}
              >
                {wifiBusy === 'get-ip' ? t('wifi.reading') : t('wifi.getIp')}
              </button>
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('enable-tcp')}
              >
                {wifiBusy === 'enable-tcp' ? t('wifi.enabling') : t('wifi.enableTcp')}
              </button>
              <button
                className="btn primary"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('connect')}
              >
                {wifiBusy === 'connect' ? t('wifi.connecting') : t('wifi.connect')}
              </button>
              <button
                className="btn"
                disabled={Boolean(wifiBusy)}
                onClick={() => void wifiAction('disconnect')}
              >
                {wifiBusy === 'disconnect' ? t('wifi.disconnecting') : t('wifi.disconnect')}
              </button>
            </div>
            {snapshot.wifiHistory.length > 0 ? (
              <div className="quick-paths" style={{ marginTop: 6 }}>
                <span className="hint">{t('wifi.recent')}</span>
                {snapshot.wifiHistory.slice(0, 6).map((ip) => (
                  <button key={ip} className="btn small" onClick={() => setWifiIp(ip)}>
                    {ip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="pair-block">
              <div className="row" style={{ marginTop: 10, marginBottom: 4 }}>
                <strong>{t('wifi.pairSection')}</strong>
                <button
                  className="btn small"
                  disabled={Boolean(pairBusy)}
                  onClick={() => void discoverServices()}
                >
                  {pairBusy === 'discover' ? t('wifi.discovering') : t('wifi.discover')}
                </button>
                {pairTarget ? <span className="badge ok">{pairTarget}</span> : null}
              </div>
              <div className="desc">{t('wifi.pairDesc')}</div>
              {pairServices !== null && pairingServices.length === 0 ? (
                <div className="hint">{t('wifi.noServices')}</div>
              ) : null}
              {pairingServices.length > 0 ? (
                <div className="quick-paths" style={{ marginBottom: 6 }}>
                  {pairingServices.map((item) => (
                    <button
                      key={item.target}
                      className={`btn small${pairTarget === item.target ? ' primary' : ''}`}
                      onClick={() => setPairTarget(item.target)}
                    >
                      {item.target}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="row">
                <input
                  className="input"
                  style={{ maxWidth: 160 }}
                  value={pairCode}
                  placeholder={t('wifi.pairCodePlaceholder')}
                  aria-label={t('wifi.pairCodeAria')}
                  onChange={(event) => setPairCode(event.target.value)}
                />
                <button
                  className="btn primary"
                  disabled={Boolean(pairBusy)}
                  onClick={() => void pairDevice()}
                >
                  {pairBusy === 'pair' ? t('wifi.pairing') : t('wifi.pair')}
                </button>
              </div>
              {pairStatus ? (
                <div className={pairStatusKind === 'error' ? 'error' : 'hint'}>{pairStatus}</div>
              ) : null}
            </div>
            {wifiStatus ? (
              <div className={wifiStatusKind === 'error' ? 'error' : 'hint'}>{wifiStatus}</div>
            ) : (
              <div className="hint">{t('wifi.legacyHint')}</div>
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
  const t = useT()
  const [apps, setApps] = useState<AppEntry[] | null>(null)
  const [filter, setFilter] = useState<AppFilter>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('error')
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
      if (done) {
        setMessageKind('ok')
        setMessage(done)
      }
      await load()
    } catch (err) {
      setMessageKind('error')
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
      setInstallPhase(t('apps.uploading', { index: 1, total: list.length }))
      const staged: string[] = []
      for (let index = 0; index < list.length; index += 1) {
        setInstallPhase(t('apps.uploading', { index: index + 1, total: list.length }))
        const stagedFile = await api.stageApk(list[index])
        staged.push(stagedFile.name)
      }
      setInstallPhase(
        staged.length > 1
          ? t('apps.installingSplits', { n: staged.length })
          : t('apps.installing'),
      )
      await api.installStaged(staged)
      setMessageKind('ok')
      setMessage(
        staged.length === 1
          ? t('apps.installedFile', { name: staged[0] })
          : t('apps.installedSplits', { n: staged.length }),
      )
      await load()
    } catch (err) {
      setMessageKind('error')
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
          <h1>{t('apps.title')}</h1>
          <div className="sub">
            {selected
              ? t('apps.subPackages', { count: apps ? apps.length : '…', device: selected })
              : t('apps.selectFirst')}
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
            {t('apps.installApk')}
          </button>
          <button className="btn" disabled={!selected || Boolean(busy)} onClick={() => void load()}>
            {busy === 'load' ? t('apps.loading') : t('apps.refresh')}
          </button>
        </div>
      </div>
      <div className="page-body">
        {message ? (
          <div className={messageKind === 'ok' ? 'saved' : 'error'} style={{ marginBottom: 10 }}>
            {message}
          </div>
        ) : null}
        {installPhase ? <div className="hint" style={{ marginBottom: 10 }}>{installPhase}</div> : null}
        {!selected ? (
          <div className="empty">{t('apps.emptyNoDevice')}</div>
        ) : !apps ? (
          <div className="empty">
            {busy === 'load' ? t('apps.loadingPackages') : t('apps.noList')}
          </div>
        ) : (
          <>
            <div className="logcat-toolbar">
              <input
                className="input"
                style={{ maxWidth: 320 }}
                placeholder={t('apps.search')}
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
                    {value === 'all'
                      ? t('apps.filterAll')
                      : value === 'user'
                        ? t('apps.filterUser')
                        : t('apps.filterSystem')}
                  </button>
                ))}
              </div>
              <span className="hint">{t('apps.shown', { n: visible.length })}</span>
            </div>
            <div className="device-list">
              {visible.length === 0 ? (
                <div className="empty">{t('apps.noMatch')}</div>
              ) : (
                visible.map((app) => (
                  <div className="app-row" key={app.name}>
                    <div className="device-meta">
                      <div className="name mono">{app.name}</div>
                      <div className="badges">
                        <span className="badge">
                          {app.system ? t('apps.badgeSystem') : t('apps.badgeUser')}
                        </span>
                        {app.disabled ? <span className="badge warn">{t('apps.badgeDisabled')}</span> : null}
                        {!app.installed ? (
                          <span className="badge warn">{t('apps.badgeUninstalled')}</span>
                        ) : null}
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
                                app.disabled
                                  ? t('apps.enabledMsg', { name: app.name })
                                  : t('apps.disabledMsg', { name: app.name }),
                              )
                            }
                          >
                            {busy === `enable-${app.name}`
                              ? '…'
                              : app.disabled
                                ? t('apps.enable')
                                : t('apps.disable')}
                          </button>
                          <button
                            className="btn small danger"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void runAction(
                                `uninstall-${app.name}`,
                                () => api.uninstallApp(app.name),
                                t('apps.uninstalledMsg', { name: app.name }),
                              )
                            }
                          >
                            {busy === `uninstall-${app.name}` ? '…' : t('apps.uninstall')}
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
                              t('apps.restoredMsg', { name: app.name }),
                            )
                          }
                        >
                          {busy === `reinstall-${app.name}` ? '…' : t('apps.reinstall')}
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
  const t = useT()
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
          {t('files.up')}
        </button>
        <input
          className="input"
          value={draft}
          placeholder={disabled ? t('files.selectDeviceFirst') : t('files.pathPlaceholder')}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && draft.trim()) onNavigate(draft.trim())
          }}
        />
        <button className="btn small" disabled={disabled || !draft.trim()}
          onClick={() => onNavigate(draft.trim())}>
          {t('files.go')}
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
          {column('name', t('files.colName'), 'grow')}
          {column('size', t('files.colSize'), 'num')}
          {column('modified', t('files.colModified'), 'date')}
        </div>
        <div className="file-rows">
          {disabled || (!loading && entries.length === 0) ? (
            <div className="empty tight">
              {disabled ? emptyMessage : loading ? t('files.loading') : emptyMessage}
            </div>
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
  const t = useT()
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
        if (!device.path) throw new Error(t('files.selectDeviceFirst'))
        const destination = joinPath(device.path, payload.entry.name)
        await api.pushFile(payload.fullPath, destination)
        setMessage(t('files.pushedTo', { name: payload.entry.name, path: destination }))
        await loadDevice(device.path)
      } else {
        const destination = joinPath(local.path, payload.entry.name)
        await api.pullFile(payload.fullPath, destination)
        setMessage(t('files.pulledTo', { name: payload.entry.name, path: destination }))
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
          setMessage(
            t('files.pushedCount', { n: result.pushed ?? 0 }) +
              (result.failed ? t('files.pushFailed', { n: result.failed }) : ''),
          )
          if (device.path) await loadDevice(device.path)
        })}>
        {t('files.pushFile')}
      </button>
      <button className="btn small" disabled={!deviceSelected || deviceSelected.is_dir || Boolean(busy)}
        onClick={() => void withBusy('save', async () => {
          const target = joinPath(device.path, deviceSelected!.name)
          const result = await api.saveAs(target)
          if (result.cancelled) return
          setMessage(t('files.savedTo', { path: result.path ?? '' }))
        })}>
        {t('files.saveAs')}
      </button>
      <button className="btn small" disabled={!selectedDevice || Boolean(busy)}
        onClick={() => void withBusy('mkdir', async () => {
          const name = window.prompt(t('files.newFolderName'))
          if (!name || !name.trim()) return
          await api.deviceMkdir(joinPath(device.path, name.trim()))
          setMessage(t('files.created', { name: name.trim() }))
          await loadDevice(device.path)
        })}>
        {t('files.newFolder')}
      </button>
      <button className="btn small" disabled={!deviceSelected || Boolean(busy)}
        onClick={() => void withBusy('rename', async () => {
          const name = window.prompt(t('files.newName'), deviceSelected!.name)
          if (!name || !name.trim() || name.trim() === deviceSelected!.name) return
          await api.deviceRename(
            joinPath(device.path, deviceSelected!.name),
            joinPath(device.path, name.trim()),
          )
          setMessage(t('files.renamed', { name: name.trim() }))
          await loadDevice(device.path)
        })}>
        {t('files.rename')}
      </button>
      <button className="btn small danger" disabled={!deviceSelected || Boolean(busy)}
        onClick={() => void withBusy('delete', async () => {
          const target = joinPath(device.path, deviceSelected!.name)
          if (!window.confirm(t('files.deleteConfirm', { name: deviceSelected!.name }))) return
          await api.deviceDelete(target)
          setMessage(t('files.deleted', { name: deviceSelected!.name }))
          await loadDevice(device.path)
        })}>
        {t('files.delete')}
      </button>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('files.title')}</h1>
          <div className="sub">{t('files.sub')}</div>
        </div>
        <div className="row">
          <span className={`badge${busy ? ' warn' : ' ok'}`}>
            {busy ? t('files.working') : t('files.ready')}
          </span>
        </div>
      </div>
      <div className="page-body">
        {message ? <div className="hint" style={{ marginBottom: 8 }}>{message}</div> : null}
        <div className="file-panes">
          <FilePane
            title={t('files.paneLocal')}
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
            emptyMessage={t('files.empty')}
          />
          <FilePane
            title={t('files.paneDevice')}
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
            emptyMessage={selectedDevice ? t('files.empty') : t('files.emptyDeviceNoDev')}
          />
        </div>
      </div>
    </>
  )
}

/* ---------------- DeGoogle ---------------- */

function DeGooglePage() {
  const t = useT()
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
          {t('deg.bucketSummary', { label, n: list.length })}
          {key === 'unsafe' ? ' ⚠' : ''}
        </summary>
        <div className="bucket-list">
          {list.length === 0 ? (
            <div className="hint">{t('deg.noneInstalled')}</div>
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
          <h1>{t('deg.title')}</h1>
          <div className="sub">
            {status?.device
              ? t('deg.workingOn', { device: status.device })
              : t('deg.selectFirst')}
            {installed
              ? t('deg.catalogCount', {
                  n: installed.safe.length + installed.risky.length + installed.unsafe.length,
                })
              : ''}
          </div>
        </div>
        <button className="btn" disabled={busy || running} onClick={() => void load()}>
          {t('deg.refresh')}
        </button>
      </div>
      <div className="page-body">
        {error ? <div className="error" style={{ marginBottom: 10 }}>{error}</div> : null}
        {!status?.device ? (
          <div className="empty">{t('deg.empty')}</div>
        ) : (
          <>
            {running ? (
              <div className="settings-card">
                <h2>{job?.phase === 'undo' ? t('deg.restoring') : t('deg.removing')}</h2>
                <div className="desc">
                  {t('deg.progress', { done: job?.done ?? 0, total: job?.total ?? 0 })}
                  {job?.current ? t('deg.progressCurrent', { current: job.current }) : ''}
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
              <h2>{t('deg.mode')}</h2>
              <div className="desc">
                <strong>{t('deg.simple')}</strong> {t('deg.simpleDesc')}{' '}
                <strong>{t('deg.custom')}</strong> {t('deg.customDesc')}
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <div className="seg">
                  <button className={mode === 'simple' ? 'active' : ''}
                    onClick={() => setMode('simple')} disabled={running || busy}>
                    {t('deg.simple')}
                  </button>
                  <button className={mode === 'custom' ? 'active' : ''}
                    onClick={() => setMode('custom')} disabled={running || busy}>
                    {t('deg.custom')}
                  </button>
                </div>
                <div className="seg">
                  <button className={action === 'disable' ? 'active' : ''}
                    onClick={() => setAction('disable')} disabled={running || busy}>
                    {t('deg.disable')}
                  </button>
                  <button className={action === 'uninstall' ? 'active' : ''}
                    onClick={() => setAction('uninstall')} disabled={running || busy}>
                    {t('deg.uninstallUser')}
                  </button>
                </div>
              </div>
              {mode === 'simple' ? (
                <label className="check-row">
                  <input type="checkbox" checked={includeRisky} disabled={running || busy}
                    onChange={(event) => setIncludeRisky(event.target.checked)} />
                  {t('deg.includeRisky')}
                </label>
              ) : (
                <div className="buckets">
                  {bucketDetails('safe', t('deg.bucketSafe'))}
                  {bucketDetails('risky', t('deg.bucketRisky'))}
                  {bucketDetails('unsafe', t('deg.bucketUnsafe'))}
                  <div className="error" style={{ marginTop: 8 }}>
                    {t('deg.unsafeWarning')}
                  </div>
                </div>
              )}
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" disabled={running || busy}
                  onClick={() => void run()}>
                  {busy
                    ? t('deg.starting')
                    : mode === 'simple'
                      ? t('deg.runSimple', {
                          action:
                            action === 'disable'
                              ? t('deg.actionDisable')
                              : t('deg.actionUninstall'),
                        })
                      : t('deg.runCustom', { n: picked.size })}
                </button>
              </div>
              {job?.lastRun && !running ? (
                <div className="hint" style={{ marginTop: 10 }}>
                  {t('deg.lastRun', {
                    finished: job.lastRun.finished,
                    disabled: job.lastRun.disabled.length,
                    uninstalled: job.lastRun.uninstalled.length,
                    failed: job.lastRun.failed.length,
                  })}
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
              <h2>{t('deg.undo')}</h2>
              <div className="desc">{t('deg.undoDesc')}</div>
              {!hasUndo ? (
                <div className="hint">{t('deg.nothingToRestore')}</div>
              ) : (
                <>
                  {status.state.disabled.length > 0 ? (
                    <div className="bucket-list" style={{ marginBottom: 8 }}>
                      <div className="hint">
                        {t('deg.disabledCount', { n: status.state.disabled.length })}
                      </div>
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
                      <div className="hint">
                        {t('deg.uninstalledCount', { n: status.state.uninstalled.length })}
                      </div>
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
                    {busy
                      ? t('deg.starting')
                      : t('deg.restoreBtn', { n: undoDisabled.size + undoUninstalled.size })}
                  </button>
                  {job?.lastUndo && !running ? (
                    <div className="hint" style={{ marginTop: 10 }}>
                      {t('deg.lastRestore', {
                        finished: job.lastUndo.finished,
                        restored: job.lastUndo.restored.length,
                        failed: job.lastUndo.failed.length,
                      })}
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

/* ---------------- Installer ---------------- */

type BundleItem = {
  filename: string
  size: number
  info: BundleInspect | null
  error: string
  busy: '' | 'upload' | 'install'
  installed: boolean
  result: BundleInstallResult | null
}

const BUNDLE_EXTS = ['.apk', '.apks', '.xapk', '.apkm', '.zip']

function InstallerPage({
  snapshot,
  pendingFiles,
  onPendingConsumed,
}: {
  snapshot: AppSnapshot
  pendingFiles: File[]
  onPendingConsumed: () => void
}) {
  const t = useT()
  const [items, setItems] = useState<BundleItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [options, setOptions] = useState({
    reinstall: true,
    downgrade: false,
    grant: false,
    obb: true,
  })
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'ok' | 'error'>('ok')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasDevice = Boolean(snapshot.selectedDevice)

  const upsert = (item: BundleItem) =>
    setItems((prev) => {
      const index = prev.findIndex((entry) => entry.filename === item.filename)
      if (index === -1) return [...prev, item]
      const next = [...prev]
      next[index] = item
      return next
    })

  const patch = (filename: string, changes: Partial<BundleItem>) =>
    setItems((prev) =>
      prev.map((entry) => (entry.filename === filename ? { ...entry, ...changes } : entry)),
    )

  const addFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase()
      if (!BUNDLE_EXTS.some((ext) => lower.endsWith(ext))) {
        upsert({
          filename: file.name,
          size: file.size,
          info: null,
          error: t('inst.unsupportedExt'),
          busy: '',
          installed: false,
          result: null,
        })
        continue
      }
      upsert({
        filename: file.name,
        size: file.size,
        info: null,
        error: '',
        busy: 'upload',
        installed: false,
        result: null,
      })
      setSelected(file.name)
      setMessage('')
      try {
        const staged = await api.uploadBundle(file)
        const info = await api.inspectBundle(staged.name)
        patch(staged.name, { info, busy: '', size: staged.size })
        setSelected(staged.name)
      } catch (err) {
        patch(file.name, {
          busy: '',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  useEffect(() => {
    if (pendingFiles.length === 0) return
    void addFiles(pendingFiles)
    onPendingConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles])

  const install = async (filename: string) => {
    patch(filename, { busy: 'install' })
    setMessage('')
    try {
      const result = await api.installBundle(filename, options)
      patch(filename, { busy: '', installed: true, result })
      setMessageKind('ok')
      const obbNote = result.obbPushed.length
        ? t('inst.obbPushedNote', { n: result.obbPushed.length })
        : ''
      setMessage(
        t('inst.installedMsg', {
          filename,
          apks:
            result.installed === 1
              ? t('inst.apkUnitOne')
              : t('inst.apkUnitMany', { n: result.installed }),
        }) +
          obbNote +
          '.',
      )
    } catch (err) {
      patch(filename, { busy: '' })
      setMessageKind('error')
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }

  const removeItem = (filename: string) => {
    setItems((prev) => prev.filter((entry) => entry.filename !== filename))
    setSelected((prev) => (prev === filename ? null : prev))
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('inst.title')}</h1>
          <div className="sub">{t('inst.sub')}</div>
        </div>
      </div>
      <div className="page-body">
        {message ? (
          <div className={messageKind === 'error' ? 'error' : 'hint'} style={{ marginBottom: 10 }}>
            {message}
          </div>
        ) : null}
        {!hasDevice ? (
          <div className="hint" style={{ marginBottom: 10 }}>
            {t('inst.noDeviceHint')}
          </div>
        ) : null}
        <div
          className={`dropzone${dragOver ? ' over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setDragOver(false)
            void addFiles(event.dataTransfer.files)
          }}
        >
          <div className="dz-title">{t('inst.dropTitle')}</div>
          <div className="hint">{t('inst.dropHint')}</div>
          <input
            ref={fileRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            accept=".apk,.apks,.xapk,.apkm,.zip"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
        <div className="row" style={{ margin: '12px 0', flexWrap: 'wrap' }}>
          <label className="check-row">
            <input
              type="checkbox"
              checked={options.reinstall}
              onChange={(event) => setOptions((prev) => ({ ...prev, reinstall: event.target.checked }))}
            />
            {t('inst.optReplace')}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={options.downgrade}
              onChange={(event) => setOptions((prev) => ({ ...prev, downgrade: event.target.checked }))}
            />
            {t('inst.optDowngrade')}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={options.grant}
              onChange={(event) => setOptions((prev) => ({ ...prev, grant: event.target.checked }))}
            />
            {t('inst.optGrant')}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={options.obb}
              onChange={(event) => setOptions((prev) => ({ ...prev, obb: event.target.checked }))}
            />
            {t('inst.optObb')}
          </label>
        </div>
        {items.length === 0 ? (
          <div className="empty">{t('inst.empty')}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.filename}
              className={`bundle-card${selected === item.filename ? ' selected' : ''}`}
              onClick={() => setSelected(item.filename)}
            >
              <div className="bundle-head">
                <span className={`badge${item.error ? ' warn' : item.installed ? ' ok' : ''}`}>
                  {item.error
                    ? t('inst.badgeError')
                    : item.installed
                      ? t('inst.badgeInstalled')
                      : item.info
                        ? item.info.format.toUpperCase()
                        : item.busy === 'upload'
                          ? t('inst.uploading')
                          : '…'}
                </span>
                <span className="bundle-name">{item.filename}</span>
                <span className="hint">{formatSize(item.size)}</span>
                <button
                  className="btn small"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeItem(item.filename)
                  }}
                >
                  {t('inst.remove')}
                </button>
              </div>
              {item.error ? <div className="error">{item.error}</div> : null}
              {item.busy === 'upload' && !item.error ? (
                <div className="hint">{t('inst.uploadingInspecting')}</div>
              ) : null}
              {item.result ? (
                <div className="hint">
                  {t('inst.lastInstall', {
                    output:
                      item.result.output || t('inst.apkCount', { n: item.result.installed }),
                  })}
                  {item.result.notes.length ? ` — ${item.result.notes.join(' · ')}` : ''}
                </div>
              ) : null}
              {selected === item.filename && item.info ? (
                <div className="bundle-detail" onClick={(event) => event.stopPropagation()}>
                  <div className="meta-grid">
                    <div className="k">{t('inst.kPackage')}</div>
                    <div className="v mono">
                      {item.info.meta?.package ??
                        (item.info.single ? '—' : t('inst.unknownNoJson'))}
                    </div>
                    <div className="k">{t('inst.kApp')}</div>
                    <div className="v">
                      {item.info.meta?.label ?? '—'}
                      {item.info.meta?.version
                        ? t('inst.versionSep', { version: item.info.meta.version })
                        : ''}
                    </div>
                    <div className="k">{t('inst.kDevice')}</div>
                    <div className="v">
                      {item.info.device
                        ? t('inst.deviceProfile', {
                            abi: item.info.device.abis[0] ?? t('inst.unknownAbi'),
                            dpi: item.info.device.density || '?',
                            sdk: item.info.device.sdk || '?',
                          })
                        : t('inst.notConnected')}
                    </div>
                    <div className="k">{t('inst.kContents')}</div>
                    <div className="v">
                      {item.info.single
                        ? t('inst.singleApk')
                        : t('inst.apkCount', { n: item.info.apks.length }) +
                          (item.info.obb.length
                            ? t('inst.obbCount', { n: item.info.obb.length })
                            : '') +
                          (item.info.icon ? t('inst.iconSep') : '')}
                    </div>
                  </div>
                  {item.info.plan && item.info.apks.length > 0 ? (
                    <>
                      <div className="hint" style={{ margin: '8px 0 4px' }}>
                        {item.info.plan.notes.join(' ')}
                      </div>
                      <div className="split-list">
                        {item.info.apks.map((apk) => {
                          const chosen = item.info?.plan?.selected.includes(apk.name)
                          return (
                            <div className={`split-row${chosen ? '' : ' skipped'}`} key={apk.name}>
                              <span className="tick">{chosen ? '✓' : '·'}</span>
                              <span className="mono grow">{apk.name}</span>
                              <span className="hint">{formatSize(apk.size)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : null}
                  {item.info.obb.length > 0 ? (
                    <div className="hint" style={{ marginTop: 6 }}>
                      {t('inst.obbLabel', {
                        list: item.info.obb.map((entry) => entry.name).join(', '),
                      })}
                    </div>
                  ) : null}
                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      className="btn primary"
                      disabled={!hasDevice || Boolean(item.busy)}
                      onClick={() => void install(item.filename)}
                    >
                      {item.busy === 'install'
                        ? t('inst.installing')
                        : item.installed
                          ? t('inst.installAgain')
                          : t('inst.install')}
                    </button>
                    {!hasDevice ? (
                      <span className="hint">{t('inst.noDeviceSelected')}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  )
}

/* ---------------- Shell ---------------- */

function ShellPage({ snapshot }: { snapshot: AppSnapshot }) {
  const t = useT()
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
          <h1>{t('shell.title')}</h1>
          <div className="sub">
            {selected ? t('shell.runningOn', { device: selected }) : t('shell.selectFirst')}
          </div>
        </div>
        <span className="hint">{t('shell.streamed')}</span>
      </div>
      <div className="page-body">
        <div className="shell">
          <div className="shell-output" ref={outputRef}>
            {shellLogs.length === 0 ? (
              <span className="shell-line out">
                {t('shell.exampleLead')}{' '}
                <span className="prompt">{t('shell.exampleCmd')}</span>
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
              placeholder={
                selected ? t('shell.placeholderSel') : t('shell.placeholderNoDev')
              }
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
              {running ? t('shell.running') : t('shell.run')}
            </button>
          </div>
          {clientError ? <div className="error" style={{ marginTop: 8 }}>{clientError}</div> : null}
          <div className="hint" style={{ marginTop: 8 }}>
            {t('shell.hintLead')}
            <code>{t('shell.hintCode')}</code>
            {t('shell.hintTail')}
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- Logcat ---------------- */

function LogcatPage({ snapshot, onChanged }: { snapshot: AppSnapshot; onChanged: () => Promise<void> }) {
  const t = useT()
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
          <h1>{t('log.title')}</h1>
          <div className="sub">
            {running
              ? t('log.streaming', { serial: snapshot.logcat.serial || '' })
              : t('log.notStreaming')}
          </div>
        </div>
        <button
          className={`btn ${running ? 'danger' : 'primary'}`}
          onClick={() => void toggle()}
          disabled={!selected}
        >
          {running ? t('log.stop') : t('log.start')}
        </button>
      </div>
      <div className="page-body">
        <div className="shell">
          <div className="logcat-toolbar">
            <input
              className="input"
              style={{ maxWidth: 320 }}
              placeholder={t('log.filter')}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <span className="hint">{t('log.lineCount', { n: visible.length })}</span>
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
                  ? t('log.noDevice')
                  : running
                    ? t('log.waiting')
                    : t('log.pressStart')}
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
  const t = useT()
  const { lang, setLang } = useI18n()
  const [adbPath, setAdbPath] = useState(snapshot.settings.adbPath)
  const [scrcpyPath, setScrcpyPath] = useState(snapshot.settings.scrcpyPath)
  const [theme, setTheme] = useState(snapshot.settings.theme)
  const [accent, setAccent] = useState(snapshot.settings.accent)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [updates, setUpdates] = useState<AdbUpdates | null>(null)
  const [checking, setChecking] = useState(false)
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagStatus, setDiagStatus] = useState('')
  const [diagKind, setDiagKind] = useState<'ok' | 'error'>('ok')

  useEffect(() => {
    setAdbPath(snapshot.settings.adbPath)
    setScrcpyPath(snapshot.settings.scrcpyPath)
    setTheme(snapshot.settings.theme)
    setAccent(snapshot.settings.accent)
  }, [
    snapshot.settings.adbPath,
    snapshot.settings.scrcpyPath,
    snapshot.settings.theme,
    snapshot.settings.accent,
  ])

  const save = async (patch: {
    adbPath?: string
    scrcpyPath?: string
    theme?: ThemeMode
    accent?: AccentId
  }) => {
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await api.saveSettings(patch)
      if (patch.theme) document.documentElement.dataset.theme = resolveThemeMode(patch.theme)
      if (patch.accent) document.documentElement.dataset.accent = patch.accent
      await onChanged()
      setSaved(t('set.saved'))
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
          <h1>{t('set.title')}</h1>
          <div className="sub">{t('set.versionLine', { version: snapshot.runtime.version })}</div>
        </div>
      </div>
      <div className="page-body">
        <div className="settings-card">
          <h2>{t('set.adbLocation')}</h2>
          <div className="desc">{t('set.adbDesc')}</div>
          <div className="row">
            <input
              className="input"
              placeholder={snapshot.runtime.adbPath || 'e.g. C:\\Android\\platform-tools\\adb.exe'}
              value={adbPath}
              onChange={(event) => setAdbPath(event.target.value)}
            />
            <button className="btn primary" onClick={() => void save({ adbPath })} disabled={saving}>
              {t('set.save')}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {t('set.activePath', { path: '' })}
            <code>{snapshot.runtime.adbPath}</code>
            {snapshot.runtime.adbFound ? t('set.found') : t('set.notFound')}
          </div>
          {error ? <div className="error" style={{ marginTop: 8 }}>{error}</div> : null}
        </div>

        <div className="settings-card">
          <h2>{t('set.scrLocation')}</h2>
          <div className="desc">{t('set.scrDesc')}</div>
          <div className="row">
            <input
              className="input"
              placeholder="e.g. C:/scrcpy/scrcpy.exe"
              value={scrcpyPath}
              onChange={(event) => setScrcpyPath(event.target.value)}
            />
            <button
              className="btn primary"
              onClick={() => void save({ scrcpyPath })}
              disabled={saving}
            >
              {t('set.save')}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {t('set.activePath', { path: '' })}
            <code>{snapshot.settings.scrcpyPath || 'scrcpy-bin'}</code>
          </div>
        </div>

        <div className="settings-card">
          <h2>{t('set.appearance')}</h2>
          <div className="desc">{t('set.appearanceDesc')}</div>
          <div className="row">
            <div className="seg">
              <button
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => {
                  setTheme('dark')
                  void save({ theme: 'dark' })
                }}
              >
                {t('set.dark')}
              </button>
              <button
                className={theme === 'light' ? 'active' : ''}
                onClick={() => {
                  setTheme('light')
                  void save({ theme: 'light' })
                }}
              >
                {t('set.light')}
              </button>
              <button
                className={theme === 'system' ? 'active' : ''}
                onClick={() => {
                  setTheme('system')
                  void save({ theme: 'system' })
                }}
              >
                {t('set.system')}
              </button>
            </div>
            {saved ? <span className="saved">{saved}</span> : null}
          </div>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                className={`swatch${accent === item.id ? ' active' : ''}`}
                onClick={() => {
                  setAccent(item.id)
                  void save({ accent: item.id })
                }}
              >
                <span className="swatch-dot" style={{ background: item.color }} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <h2>{t('set.language')}</h2>
          <div className="desc">{t('set.languageDesc')}</div>
          <div className="row">
            <div className="seg">
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                {t('set.langEn')}
              </button>
              <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')}>
                {t('set.langFr')}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h2>{t('set.updates')}</h2>
          <div className="desc">{t('set.updatesDesc')}</div>
          <div className="row">
            <button
              className="btn"
              disabled={checking}
              onClick={async () => {
                setChecking(true)
                try {
                  setUpdates(await api.updatesAdb())
                } catch (err) {
                  setUpdates({
                    localVersion: null,
                    latestVersion: null,
                    updateAvailable: false,
                    error: err instanceof Error ? err.message : String(err),
                    url: '',
                  })
                } finally {
                  setChecking(false)
                }
              }}
            >
              {checking ? t('set.checking') : t('set.checkUpdates')}
            </button>
            {updates && updates.updateAvailable ? (
              <a className="btn primary" href={updates.url} target="_blank" rel="noreferrer">
                {t('set.openDownloadPage')}
              </a>
            ) : null}
          </div>
          {updates ? (
            <div
              className={updates.updateAvailable || updates.error ? 'error' : 'hint'}
              style={{ marginTop: 8 }}
            >
              {updates.updateAvailable
                ? t('set.updateAvail', {
                    local: updates.localVersion ?? '?',
                    latest: updates.latestVersion ?? '?',
                  })
                : updates.localVersion && updates.latestVersion && !updates.error
                  ? t('set.upToDate', { version: updates.localVersion })
                  : updates.error
                    ? t('set.checkFailed', { error: updates.error })
                    : t('set.noLocalAdb')}
            </div>
          ) : null}
        </div>

        <div className="settings-card">
          <h2>{t('set.diag')}</h2>
          <div className="desc">{t('set.diagDesc')}</div>
          <div className="row">
            <button
              className="btn"
              disabled={diagBusy}
              onClick={async () => {
                setDiagBusy(true)
                setDiagStatus('')
                try {
                  const { report } = await api.diagnosticsReport()
                  const savedResult = await api.diagnosticsSave(report)
                  setDiagKind('ok')
                  setDiagStatus(
                    savedResult.cancelled
                      ? t('set.reportCancelled')
                      : t('set.reportSaved', { path: savedResult.path ?? '' }),
                  )
                } catch (err) {
                  setDiagKind('error')
                  setDiagStatus(err instanceof Error ? err.message : String(err))
                } finally {
                  setDiagBusy(false)
                }
              }}
            >
              {diagBusy ? t('set.generating') : t('set.generateReport')}
            </button>
          </div>
          {diagStatus ? (
            <div className={diagKind === 'error' ? 'error' : 'hint'} style={{ marginTop: 8 }}>
              {diagStatus}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
