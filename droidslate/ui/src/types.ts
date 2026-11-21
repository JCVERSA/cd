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

export type ThemeMode = 'dark' | 'light' | 'system'
export type AccentId = 'emerald' | 'violet' | 'nebula' | 'amber' | 'crimson'

export interface RuntimeState {
  version: string
  adbPath: string
  adbFound: boolean
  uptimeSeconds: number
  theme: ThemeMode
}

export interface Settings {
  adbPath: string
  theme: ThemeMode
  accent: AccentId
}

export interface LogcatState {
  running: boolean
  serial: string | null
}

export interface AdbUpdates {
  localVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
  error: string
  url: string
}

export interface MdnsService {
  name: string
  host: string
  port: number
  type: 'pairing' | 'connect' | 'other'
  target: string
}

export interface AppSnapshot {
  runtime: RuntimeState
  devices: Device[]
  selectedDevice: string
  settings: Settings
  wifiHistory: string[]
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

export interface BundleApkEntry {
  name: string
  size: number
}

export interface BundleMeta {
  package: string
  label: string | null
  version: string | null
  versionCode: string | null
  minSdk: string | null
}

export interface InstallProfile {
  abis: string[]
  density: number
  sdk: number
  locales: string[]
}

export interface BundlePlan {
  selected: string[]
  notes: string[]
}

export interface BundleInspect {
  format: 'apk' | 'apks' | 'xapk' | 'apkm' | 'zip'
  filename: string
  size: number
  single: boolean
  meta: BundleMeta | null
  apks: BundleApkEntry[]
  obb: BundleApkEntry[]
  icon: boolean
  device: InstallProfile | null
  plan: BundlePlan | null
}

export interface BundleInstallResult {
  ok: boolean
  filename: string
  format: string
  installed: number
  selected: string[]
  obbPushed: string[]
  obbFailed: string[]
  notes: string[]
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
