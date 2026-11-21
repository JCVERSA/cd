import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSnapshot } from './types'
import App from './App'

const baseSnapshot: AppSnapshot = {
  runtime: { version: '1.0.0', adbPath: 'adb', adbFound: true, uptimeSeconds: 12, theme: 'dark' },
  devices: [{ id: 'emulator-5554', status: 'device', model: 'Pixel 8' }],
  selectedDevice: 'emulator-5554',
  settings: { adbPath: '', scrcpyPath: '', theme: 'dark', accent: 'emerald' },
  wifiHistory: [],
  logcat: { running: false, serial: null },
  logs: [],
}

const mockApi = vi.hoisted(() => ({
  isDesktopHost: true,
  snapshot: vi.fn(),
  refreshDevices: vi.fn(),
  selectDevice: vi.fn(),
  deviceInfo: vi.fn(),
  runShell: vi.fn(),
  startLogcat: vi.fn(),
  stopLogcat: vi.fn(),
  saveSettings: vi.fn(),
  listApps: vi.fn(),
  stageApk: vi.fn(),
  installStaged: vi.fn(),
  uninstallApp: vi.fn(),
  reinstallApp: vi.fn(),
  setAppEnabled: vi.fn(),
  takeScreenshot: vi.fn(),
  latestScreenshot: vi.fn(),
  openScreenshotsFolder: vi.fn(),
  reboot: vi.fn(),
  localDir: vi.fn(),
  deviceDir: vi.fn(),
  pushFile: vi.fn(),
  pullFile: vi.fn(),
  pushPick: vi.fn(),
  saveAs: vi.fn(),
  deviceMkdir: vi.fn(),
  deviceRename: vi.fn(),
  deviceDelete: vi.fn(),
  deGoogleStatus: vi.fn(),
  deGoogleRun: vi.fn(),
  deGoogleUndo: vi.fn(),
  wifiGetIp: vi.fn(),
  wifiEnableTcp: vi.fn(),
  wifiConnect: vi.fn(),
  wifiDisconnect: vi.fn(),
  wifiMdns: vi.fn(),
  wifiPair: vi.fn(),
  adbRestart: vi.fn(),
  updatesAdb: vi.fn(),
  diagnosticsReport: vi.fn(),
  diagnosticsSave: vi.fn(),
  dropFile: vi.fn(),
  uploadBundle: vi.fn(),
  inspectBundle: vi.fn(),
  installBundle: vi.fn(),
  mirrorVersion: vi.fn(),
  mirrorStart: vi.fn(),
  mirrorStop: vi.fn(),
  mirrorStatus: vi.fn(),
  mirrorLogs: vi.fn(),
  mirrorCheckUpdate: vi.fn(),
}))

vi.mock('./api', () => ({ api: mockApi }))

afterEach(() => {
  window.localStorage.removeItem('droidslate.language')
  window.localStorage.removeItem('droidslate.onboarding')
  window.localStorage.removeItem('droidslate.scrcpy')
  vi.restoreAllMocks()
})

describe('DroidSlate app shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.snapshot.mockResolvedValue(structuredClone(baseSnapshot))
    mockApi.latestScreenshot.mockResolvedValue({ none: true })
    mockApi.mirrorVersion.mockResolvedValue({ found: false, path: null, version: null })
    mockApi.mirrorStatus.mockResolvedValue({ processes: {} })
    mockApi.mirrorLogs.mockResolvedValue({ serial: '', lines: [] })
    mockApi.deviceInfo.mockResolvedValue({
      Model: 'Pixel 8',
      Manufacturer: 'Google',
      Brand: 'google',
      'Android Version': '15',
      'SDK Version': '35',
      Build: 'AP3A.241105.008',
      Serial: 'EMULATOR28X0Y0',
      CPU: 'arm64-v8a',
    })
  })

  it('renders the navigation and the selected device', async () => {
    render(<App />)
    expect(await screen.findByText('DroidSlate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Devices/ })).toBeInTheDocument()
    // Device name shows in the sidebar chip, the device card, and the info grid.
    expect((await screen.findAllByText('Pixel 8')).length).toBeGreaterThan(0)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('switches to the Shell page and shows the device context', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Shell/ }))
    expect(await screen.findByRole('heading', { name: 'Shell' })).toBeInTheDocument()
    expect(await screen.findByText('Running on emulator-5554')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter shell command…')).toBeInTheDocument()
  })

  it('surfaces a connection error when the snapshot request fails', async () => {
    mockApi.snapshot.mockRejectedValue(new Error('backend down'))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/backend down/)).toBeInTheDocument())
  })

  it('lists packages on the Apps page and filters them by search', async () => {
    mockApi.listApps.mockResolvedValue({
      device: 'emulator-5554',
      apps: [
        { name: 'com.android.settings', system: true, installed: true, disabled: false },
        { name: 'com.example.chat', system: false, installed: true, disabled: true },
        { name: 'com.android.vending', system: true, installed: false, disabled: false },
      ],
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Apps/ }))

    expect(await screen.findByText('com.android.settings')).toBeInTheDocument()
    expect(screen.getByText('com.example.chat')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByText('Uninstalled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reinstall' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search packages…'), 'example')
    expect(screen.queryByText('com.android.settings')).not.toBeInTheDocument()
    expect(screen.getByText('com.example.chat')).toBeInTheDocument()
    expect(screen.getByText('1 shown')).toBeInTheDocument()
  })

  it('renders both file panes with entries and sorts by size', async () => {
    mockApi.localDir.mockResolvedValue({
      path: '/home/user/test',
      parent: '/home/user',
      entries: [
        { name: 'big.bin', is_dir: false, size: 100, modified: 'Apr 30, 08:15' },
        { name: 'small.bin', is_dir: false, size: 1, modified: 'Apr 30, 08:15' },
        { name: 'docs', is_dir: true, size: null, modified: 'May 1, 12:00' },
      ],
      drives: [],
    })
    mockApi.deviceDir.mockResolvedValue({
      path: '/sdcard',
      parent: '/',
      entries: [{ name: 'DCIM', is_dir: true, size: null, modified: 'May 1, 12:00' }],
      drives: [],
    })

    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Files/ }))

    expect(await screen.findByText('This PC')).toBeInTheDocument()
    expect(await screen.findByText('Android device')).toBeInTheDocument()
    expect(await screen.findByText('big.bin')).toBeInTheDocument()
    expect(await screen.findByText('DCIM')).toBeInTheDocument()
    // device quick paths from the spec
    expect(screen.getByRole('button', { name: 'tmp' })).toBeInTheDocument()

    const firstPane = document.querySelector('.file-pane') as HTMLElement
    await user.click(within(firstPane).getByText('Size'))
    const names = Array.from(firstPane.querySelectorAll('.file-row .name'))
      .map((el) => (el.textContent ?? '').replace(/^[^A-Za-z0-9]+/, ''))
    expect(names).toEqual(['docs', 'small.bin', 'big.bin'])
  })

  it('runs a simple DeGoogle pass and switches to custom selection', async () => {
    mockApi.deGoogleStatus.mockResolvedValue({
      device: 'emulator-5554',
      installed: {
        safe: ['com.google.android.carlink', 'com.google.android.youtube'],
        risky: ['com.google.android.gsf.login'],
        unsafe: ['com.android.vending'],
      },
      state: { disabled: [], uninstalled: [], updated: '' },
      job: {
        running: false,
        phase: null,
        done: 0,
        total: 0,
        current: '',
        lastRun: null,
        lastUndo: null,
      },
    })
    mockApi.deGoogleRun.mockResolvedValue({ started: true, total: 2 })

    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /DeGoogle/ }))

    expect(await screen.findByRole('button', { name: 'Simple' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Custom' })).toBeInTheDocument()
    // simple mode never renders the unsafe bucket
    expect(document.querySelector('.bucket-unsafe')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Run Simple/ }))
    await vi.waitFor(() => {
      expect(mockApi.deGoogleRun).toHaveBeenCalledWith({
        mode: 'simple',
        action: 'disable',
        includeRisky: false,
      })
    })

    await user.click(screen.getByRole('button', { name: 'Custom' }))
    expect(await screen.findByText('Android Auto')).toBeInTheDocument()
    const unsafe = document.querySelector('.bucket-unsafe')
    expect(unsafe).not.toBeNull()
    // raw package id kept in the title attribute next to the friendly name
    expect(unsafe?.querySelector('span[title="com.android.vending"]')).not.toBeNull()
  })

  it('offers the WiFi no-cable flow on the Devices page', async () => {
    mockApi.wifiGetIp.mockResolvedValue({ ip: '192.168.1.25', serial: 'emulator-5554' })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')

    expect(screen.getByText('WiFi (no cable)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get IP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable TCP/IP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Get IP' }))
    await vi.waitFor(() => {
      expect(mockApi.wifiGetIp).toHaveBeenCalledTimes(1)
      expect((screen.getByLabelText('Device IP') as HTMLInputElement).value).toBe('192.168.1.25')
    })
    expect(
      screen.getByText('Found device IP: 192.168.1.25 — now click Enable TCP/IP.'),
    ).toBeInTheDocument()
  })

  it('inspects a dropped bundle and offers matching splits on the Installer tab', async () => {
    mockApi.uploadBundle.mockResolvedValue({ name: 'game.xapk', size: 1234 })
    mockApi.inspectBundle.mockResolvedValue({
      format: 'xapk',
      filename: 'game.xapk',
      size: 1234,
      single: false,
      meta: {
        package: 'com.example.game',
        label: 'Example Game',
        version: '2.1.0',
        versionCode: '210',
        minSdk: '24',
      },
      apks: [
        { name: 'base.apk', size: 100 },
        { name: 'config.arm64_v8a.apk', size: 50 },
        { name: 'config.x86.apk', size: 50 },
      ],
      obb: [],
      icon: true,
      device: { abis: ['arm64-v8a'], density: 440, sdk: 34, locales: ['fr-FR'] },
      plan: {
        selected: ['base.apk', 'config.arm64_v8a.apk'],
        notes: ['2 of 3 APK(s) selected for this device.'],
      },
    })

    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Installer/ }))

    expect(screen.getByText('Drop bundle files here')).toBeInTheDocument()
    expect(screen.getByText('No bundle added yet.')).toBeInTheDocument()

    const input = document.querySelector('.dropzone input[type="file"]') as HTMLInputElement
    const file = new File([new Uint8Array([80, 75, 3, 4])], 'game.xapk')
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('game.xapk')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(mockApi.uploadBundle).toHaveBeenCalledTimes(1)
      expect(mockApi.inspectBundle).toHaveBeenCalledWith('game.xapk')
    })
    expect(await screen.findByText('com.example.game')).toBeInTheDocument()
    expect(screen.getByText('Example Game · v2.1.0')).toBeInTheDocument()
    expect(screen.getByText('XAPK')).toBeInTheDocument()
    // split table: 2 chosen (✓), 1 skipped
    expect(screen.getAllByText('✓')).toHaveLength(2)
    expect(screen.getByText('config.x86.apk').closest('.split-row')?.className)
      .toContain('skipped')
    expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled()
  })

  it('switches the interface language to French and back via Settings', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Français' }))
    expect(screen.getByRole('button', { name: /Appareils/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Paramètres' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Devices/ })).toBeInTheDocument()
  })

  it('pairs an Android 11+ device through the mDNS flow', async () => {
    mockApi.wifiMdns.mockResolvedValue({
      services: [
        {
          name: 'adb-TEST_adb-tls-connect._tcp',
          host: '192.168.1.25',
          port: 37451,
          type: 'connect',
          target: '192.168.1.25:37451',
        },
        {
          name: 'adb-TEST_adb-tls-pairing._tcp',
          host: '192.168.1.25',
          port: 42123,
          type: 'pairing',
          target: '192.168.1.25:42123',
        },
      ],
    })
    mockApi.wifiPair.mockResolvedValue({
      target: '192.168.1.25:42123',
      output: 'Successfully paired with 192.168.1.25:42123',
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')

    await user.click(screen.getByRole('button', { name: 'Discover' }))
    await vi.waitFor(() => expect(mockApi.wifiMdns).toHaveBeenCalledTimes(1))
    // pairing service is pre-selected, connect service is not a pairing target
    const serviceButton = await screen.findByRole('button', { name: '192.168.1.25:42123' })
    expect(serviceButton.className).toContain('primary')

    await user.type(screen.getByLabelText('Pairing code'), '482913')
    await user.click(screen.getByRole('button', { name: 'Pair' }))
    await vi.waitFor(() => {
      expect(mockApi.wifiPair).toHaveBeenCalledWith('192.168.1.25:42123', '482913')
    })
    expect(
      screen.getByText('Paired with 192.168.1.25:42123 — the device should now show up in the list.'),
    ).toBeInTheDocument()
  })

  it('validates the pairing code before calling the backend', async () => {
    mockApi.wifiMdns.mockResolvedValue({ services: [] })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')

    await user.click(screen.getByRole('button', { name: 'Discover' }))
    await vi.waitFor(() => expect(mockApi.wifiMdns).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/No mDNS services found/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pair' }))
    expect(
      screen.getByText('Select a discovered pairing service first.'),
    ).toBeInTheDocument()
    expect(mockApi.wifiPair).not.toHaveBeenCalled()
  })

  it('restarts the ADB server from the Devices header', async () => {
    mockApi.adbRestart.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')

    await user.click(screen.getByRole('button', { name: 'Restart ADB' }))
    await vi.waitFor(() => expect(mockApi.adbRestart).toHaveBeenCalledTimes(1))
    expect(screen.getByText('ADB server restarted.')).toBeInTheDocument()
  })

  it('offers recent WiFi IPs as one-click chips', async () => {
    mockApi.snapshot.mockResolvedValue({
      ...structuredClone(baseSnapshot),
      wifiHistory: ['192.168.1.5', '10.0.0.2'],
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')

    const chip = screen.getByRole('button', { name: '192.168.1.5' })
    await user.click(chip)
    expect((screen.getByLabelText('Device IP') as HTMLInputElement).value).toBe('192.168.1.5')
  })

  it('shows the first-connection guide when no device is present', async () => {
    mockApi.snapshot.mockResolvedValue({
      ...structuredClone(baseSnapshot),
      devices: [],
      selectedDevice: '',
    })
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Connect your first device')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem('droidslate.onboarding')).toBe('1')

    // the Help button reopens the guide on demand
    await user.click(screen.getByRole('button', { name: /Help/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('checks for adb updates from Settings', async () => {
    mockApi.updatesAdb.mockResolvedValue({
      localVersion: '35.0.4',
      latestVersion: '35.0.5',
      updateAvailable: true,
      error: '',
      url: 'https://developer.android.com/tools/releases/platform-tools',
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Settings/ }))

    await user.click(await screen.findByRole('button', { name: 'Check for updates' }))
    await vi.waitFor(() => expect(mockApi.updatesAdb).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Update available: 35.0.4 → 35.0.5.'),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Open download page' })
    expect(link.getAttribute('href')).toContain('platform-tools')
  })

  it('generates and saves a diagnostics report', async () => {
    mockApi.diagnosticsReport.mockResolvedValue({ report: { app: 'DroidSlate' } })
    mockApi.diagnosticsSave.mockResolvedValue({
      ok: true,
      path: 'C:\\Users\\test\\report.json',
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Settings/ }))

    await user.click(await screen.findByRole('button', { name: /Generate & save report/ }))
    await vi.waitFor(() => {
      expect(mockApi.diagnosticsReport).toHaveBeenCalledTimes(1)
      expect(mockApi.diagnosticsSave).toHaveBeenCalledWith({ app: 'DroidSlate' })
    })
    expect(
      await screen.findByText('Report saved to C:\\Users\\test\\report.json.'),
    ).toBeInTheDocument()
  })

  it('routes globally dropped bundles to the Installer', async () => {
    mockApi.uploadBundle.mockResolvedValue({ name: 'game.xapk', size: 1234 })
    mockApi.inspectBundle.mockResolvedValue({
      format: 'xapk',
      filename: 'game.xapk',
      size: 1234,
      single: false,
      meta: null,
      apks: [{ name: 'base.apk', size: 100 }],
      obb: [],
      icon: false,
      device: null,
      plan: null,
    })
    render(<App />)
    await screen.findAllByText('Pixel 8')

    const file = new File([new Uint8Array([80, 75, 3, 4])], 'game.xapk')
    fireEvent.drop(document.querySelector('.app') as Element, {
      dataTransfer: { files: [file], types: ['Files'] },
    })

    expect(await screen.findByText('Drop bundle files here')).toBeInTheDocument()
    await vi.waitFor(() => expect(mockApi.uploadBundle).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('game.xapk')).toBeInTheDocument()
  })

  it('pushes globally dropped plain files to the device', async () => {
    mockApi.dropFile.mockResolvedValue({
      ok: true,
      path: '/sdcard/Download/notes.txt',
      size: 5,
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    render(<App />)
    await screen.findAllByText('Pixel 8')

    const file = new File(['hello'], 'notes.txt')
    fireEvent.drop(document.querySelector('.app') as Element, {
      dataTransfer: { files: [file], types: ['Files'] },
    })

    await vi.waitFor(() => expect(mockApi.dropFile).toHaveBeenCalledTimes(1))
    expect(mockApi.dropFile.mock.calls[0][0].name).toBe('notes.txt')
    expect(confirmSpy).toHaveBeenCalledWith('Push notes.txt to /sdcard/Download/?')
    await vi.waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Pushed 1 file(s) to /sdcard/Download/.')
    })
  })

  it('switches color mode and accent from Settings', async () => {
    // Persist into the snapshot the way the real backend does — otherwise the
    // 2.5s snapshot poll immediately reverts the optimistic DOM update.
    mockApi.saveSettings.mockImplementation(async (patch) => {
      const merged: AppSnapshot['settings'] = { ...baseSnapshot.settings, ...patch }
      mockApi.snapshot.mockResolvedValue({
        ...structuredClone(baseSnapshot),
        settings: merged,
        // The backend mirrors the theme into runtime.theme — keep the mock honest.
        runtime: { ...baseSnapshot.runtime, theme: merged.theme },
      })
      return merged
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Settings/ }))

    await user.click(await screen.findByRole('button', { name: 'System' }))
    await vi.waitFor(() => {
      expect(mockApi.saveSettings).toHaveBeenCalledWith({ theme: 'system' })
      // jsdom reports no dark OS preference → system resolves to light
      expect(document.documentElement.dataset.theme).toBe('light')
    })

    await user.click(screen.getByRole('button', { name: 'Violet' }))
    await vi.waitFor(() => {
      expect(mockApi.saveSettings).toHaveBeenCalledWith({ accent: 'violet' })
      expect(document.documentElement.dataset.accent).toBe('violet')
    })
  })

  it('shows the splash until the first snapshot arrives', async () => {
    let release!: (value: AppSnapshot) => void
    mockApi.snapshot.mockImplementation(
      () =>
        new Promise<AppSnapshot>((resolve) => {
          release = resolve
        }),
    )
    render(<App />)
    expect(screen.getByText('Connecting to DroidSlate…')).toBeInTheDocument()

    release(structuredClone(baseSnapshot))
    expect((await screen.findAllByText('Pixel 8')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Connecting to DroidSlate…')).not.toBeInTheDocument()
  })

  it('mirrors the device: version, start, live logs, stop', async () => {
    mockApi.mirrorVersion.mockResolvedValue({
      found: true,
      path: 'C:/DroidSlate/scrcpy-bin/scrcpy.exe',
      version: '5.0.1',
    })
    mockApi.mirrorStart.mockResolvedValue({ ok: true, pid: 4242 })
    mockApi.mirrorStop.mockResolvedValue({ ok: true, serial: 'emulator-5554', running: false })

    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Mirror/ }))

    expect(await screen.findByRole('heading', { name: 'Mirror' })).toBeInTheDocument()
    expect(await screen.findByText('scrcpy 5.0.1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start mirror' }))
    await waitFor(() =>
      expect(mockApi.mirrorStart).toHaveBeenCalledWith(
        'emulator-5554',
        expect.objectContaining({ codec: 'h264', bitrate: 8, fps: 0 }),
      ),
    )

    // Update check: local vs latest GitHub release (report-only).
    mockApi.mirrorCheckUpdate.mockResolvedValue({
      localVersion: '5.0.1',
      latestVersion: '5.0.1',
      updateAvailable: false,
      error: '',
      url: 'https://github.com/Genymobile/scrcpy/releases/latest',
    })
    await user.click(screen.getByRole('button', { name: 'Check for updates' }))
    await waitFor(() => expect(mockApi.mirrorCheckUpdate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('scrcpy is up to date (5.0.1).')).toBeInTheDocument()

    // The status poll (1.5 s) picks up the running session and streams its log.
    mockApi.mirrorStatus.mockResolvedValue({
      processes: { 'emulator-5554': { pid: 4242, running: true } },
    })
    mockApi.mirrorLogs.mockResolvedValue({
      serial: 'emulator-5554',
      lines: ['$ scrcpy -s emulator-5554', 'fake scrcpy up'],
    })
    expect(
      await screen.findByText('Mirroring (pid 4242)', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/fake scrcpy up/, {}, { timeout: 4000 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(mockApi.mirrorStop).toHaveBeenCalledWith('emulator-5554'))
  })

  it('exposes the scrcpy location field in Settings', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Settings/ }))

    const heading = await screen.findByRole('heading', { name: 'scrcpy location' })
    const card = heading.closest('.settings-card')
    expect(card).not.toBeNull()
    const scope = within(card as HTMLElement)
    const input = scope.getByPlaceholderText('e.g. C:/scrcpy/scrcpy.exe')
    await user.clear(input)
    await user.type(input, 'C:/tools/scrcpy.exe')
    await user.click(scope.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(mockApi.saveSettings).toHaveBeenCalledWith({ scrcpyPath: 'C:/tools/scrcpy.exe' }),
    )
  })

  it('explains when the bundled scrcpy is missing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findAllByText('Pixel 8')
    await user.click(screen.getByRole('button', { name: /Mirror/ }))

    expect(await screen.findByText(/scrcpy not found/)).toBeInTheDocument()
    // Without the engine the start action stays unavailable.
    expect(screen.getByRole('button', { name: 'Start mirror' })).toBeDisabled()
  })
})
