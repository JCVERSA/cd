export type PageId =
  | 'overview'
  | 'playground'
  | 'providers'
  | 'commands'
  | 'styles'
  | 'settings'
  | 'diagnostics'

export type RuntimeState = {
  running: boolean
  paused: boolean
  provider: string
  model: string
  prefix: string
  commandCount: number
  localStyleCount: number
  protectedKeyCount: number
  uptimeSeconds: number
  requestsToday: number
  lastCommand?: string
  lastCommandAt?: string
  firstRun: boolean
  launchAtStartup: boolean
  spinner: 'animated' | 'static' | 'off'
  keyDelay: number
  theme: ThemeId
  reducedMotion: boolean
}

export type ThemeId = 'lavender' | 'amber' | 'sapphire' | 'emerald' | 'rose'

export type ProviderId =
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'deepseek'
  | 'ollama'
  | 'lmstudio'
  | 'nvidia'
  | 'custom'

export type Provider = {
  id: ProviderId
  name: string
  description: string
  endpoint: string
  model: string
  connected: boolean
  local: boolean
  keyConfigured: boolean
  portalAvailable?: boolean
  models?: string[]
  latencyMs?: number
}

export type CommandType = 'ai' | 'replacer-text' | 'style' | 'system'

export type Command = {
  id: string
  trigger: string
  type: CommandType
  prompt: string
  value: string
  enabled: boolean
  uses: number
}

export type DiagnosticCheck = {
  id: string
  label: string
  detail: string
  status: 'pass' | 'warn' | 'fail' | 'idle'
}

export type LogEntry = {
  time: string
  level: 'INFO' | 'WARNING' | 'ERROR'
  message: string
}

export type ActivityItem = {
  id: string
  command: string
  provider: string
  durationMs: number
  time: string
  status: 'success' | 'error' | 'cancelled'
}

export type AppSnapshot = {
  runtime: RuntimeState
  providers: Provider[]
  commands: Command[]
  activity: ActivityItem[]
  diagnostics: DiagnosticCheck[]
  logs: LogEntry[]
}
