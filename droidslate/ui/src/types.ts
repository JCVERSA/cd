export interface Device {
  id: string
  status: string
  model: string | null
  product?: string | null
  manufacturer?: string
}

export interface LogRecord {
  id: string
  time: string
  level: string
  tag: string
  message: string
}

export interface RuntimeState {
  version: string
  adbPath: string
  adbFound: boolean
  uptimeSeconds: number
  theme: 'dark' | 'light'
}

export interface Settings {
  adbPath: string
  theme: 'dark' | 'light'
}

export interface LogcatState {
  running: boolean
  serial: string | null
}

export interface AppSnapshot {
  runtime: RuntimeState
  devices: Device[]
  selectedDevice: string
  settings: Settings
  logcat: LogcatState
  logs: LogRecord[]
}

export interface AppEntry {
  name: string
  system: boolean
  installed: boolean
  disabled: boolean
}

export interface ScreenshotRef {
  name: string
  url: string
  path: string
}

export interface FileEntry {
  name: string
  size: number
  modified: string
  is_dir: boolean
  is_link: boolean
  permissions: string
}

export interface DirListing {
  path: string
  parent: string | null
  entries: FileEntry[]
  drives?: string[] | null
}

export interface TransferResult {
  ok: boolean
  to?: string
  path?: string
}

export interface PickResult {
  cancelled?: boolean
  results?: { file: string; ok: boolean; error: string }[]
  pushed?: number
  failed?: number
}

export interface DeGoogleBucketState {
  disabled: string[]
  uninstalled: string[]
  updated: string
}

export interface DeGoogleJob {
  running: boolean
  phase: string
  done: number
  total: number
  current: string
  lastRun: {
    action: string
    disabled: string[]
    uninstalled: string[]
    failed: { package: string; error: string }[]
    finished: string
  } | null
  lastUndo: {
    restored: string[]
    failed: { package: string; error: string }[]
    finished: string
  } | null
}

export interface DeGoogleStatus {
  device: string
  installed: Record<string, string[]> | null
  state: DeGoogleBucketState
  job: DeGoogleJob
}

export interface WifiIpResult {
  ip: string
  serial: string
}

export interface WifiTcpResult {
  port: number
  serial: string
}

export interface WifiConnectResult {
  target: string
  output: string
}

export interface DeviceInfo {
  Model: string
  Manufacturer: string
  Brand: string
  'Android Version': string
  'SDK Version': string
  Build: string
  Serial: string
  CPU: string
}
