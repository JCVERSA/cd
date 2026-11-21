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
