import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSnapshot } from './types'
import App from './App'

const baseSnapshot: AppSnapshot = {
  runtime: { version: '1.0.0', adbPath: 'adb', adbFound: true, uptimeSeconds: 12, theme: 'dark' },
  devices: [{ id: 'emulator-5554', status: 'device', model: 'Pixel 8' }],
  selectedDevice: 'emulator-5554',
  settings: { adbPath: '', theme: 'dark' },
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
}))

vi.mock('./api', () => ({ api: mockApi }))

describe('DroidSlate app shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.snapshot.mockResolvedValue(structuredClone(baseSnapshot))
    mockApi.latestScreenshot.mockResolvedValue({ none: true })
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
})
