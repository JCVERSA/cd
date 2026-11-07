import { AlertTriangle, Check, CheckCircle2, Clipboard, LoaderCircle, Play, RefreshCw, ShieldCheck, Terminal, XCircle } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { Badge, Button, SpotlightCard } from '../components/ui'
import type { DiagnosticCheck, LogEntry } from '../types'

type LogFilter = 'all' | 'info' | 'warn' | 'error'

function CheckIcon({ status }: { status: DiagnosticCheck['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={17} strokeWidth={1.85} aria-hidden="true" />
  if (status === 'warn') return <AlertTriangle size={17} strokeWidth={1.85} aria-hidden="true" />
  if (status === 'fail') return <XCircle size={17} strokeWidth={1.85} aria-hidden="true" />
  return <LoaderCircle size={17} strokeWidth={1.85} className="spin" aria-hidden="true" />
}

export function DiagnosticsScreen({
  initial,
  initialLogs,
  notify,
}: {
  initial: DiagnosticCheck[]
  initialLogs: LogEntry[]
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [checks, setChecks] = useState(initial)
  const [logs, setLogs] = useState(initialLogs)
  const [levelFilter, setLevelFilter] = useState<LogFilter>('all')
  const [running, setRunning] = useState(false)
  const [refreshingLogs, setRefreshingLogs] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)

  const filteredLogs = useMemo(
    () =>
      logs.filter((entry) => {
        if (levelFilter === 'all') return true
        if (levelFilter === 'warn') return entry.level === 'WARNING'
        return entry.level.toLowerCase() === levelFilter
      }),
    [levelFilter, logs],
  )

  async function run() {
    setRunning(true)
    setChecks(checks.map((check) => ({ ...check, status: 'idle' })))
    try {
      const result = await api.runDiagnostics()
      setChecks(result)
      notify('Diagnostics completed.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Diagnostics could not complete.', 'danger')
    } finally {
      setRunning(false)
    }
  }

  async function refreshLogs() {
    setRefreshingLogs(true)
    try {
      setLogs(await api.logs())
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Logs could not be refreshed.', 'danger')
    } finally {
      setRefreshingLogs(false)
    }
  }

  async function copyLogs() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(logs.map((row) => `${row.time}  ${row.level}  ${row.message}`).join('\n'))
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400)
      notify('Redacted logs copied.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Logs could not be copied.', 'danger')
    }
  }

  const passing = checks.filter((check) => check.status === 'pass').length
  return (
    <div className="screen diagnostics-screen">
      <section className="diagnostic-hero">
        <div>
          <h2>{passing === checks.length ? 'Everything looks healthy' : 'SwiftSlate needs attention'}</h2>
          <p>{passing} of {checks.length} local runtime checks passing. API keys and typed text never enter logs.</p>
        </div>
        <Button variant="primary" loading={running} icon={<Play size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={run}>Run all checks</Button>
      </section>

      <section className="diagnostics-split">
        <SpotlightCard className="health-matrix-card">
          <div className="card-header-clean">
            <h3>Health checklist</h3>
            <span>Subsystems verified locally</span>
          </div>
          <div className="diagnostic-list">
            {checks.map((check) => (
              <div className={`diagnostic-row check-${check.status}`} key={check.id}>
                <span className="check-icon"><CheckIcon status={check.status} /></span>
                <div className="diagnostic-row-copy">
                  <strong>{check.label}</strong>
                  <p>{check.status === 'idle' && running ? 'Checking…' : check.detail}</p>
                </div>
                <Badge tone={check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : check.status === 'fail' ? 'danger' : 'neutral'}>
                  {check.status === 'pass' ? 'Passed' : check.status}
                </Badge>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="logs-card">
          <div className="logs-card-top">
            <div className="card-header-clean">
              <h3>Runtime stream</h3>
              <span>Redacted before persistence</span>
            </div>
            <div className="log-actions">
              <div className="segmented-control" role="group" aria-label="Log level filter">
                {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={levelFilter === lvl ? 'segment-active' : ''}
                    aria-pressed={levelFilter === lvl}
                    onClick={() => setLevelFilter(lvl)}
                  >
                    {lvl === 'all' ? 'All' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" loading={refreshingLogs} icon={<RefreshCw size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={refreshLogs}>Refresh</Button>
              <Button
                variant="secondary"
                size="sm"
                icon={copied
                  ? <Check size={15} strokeWidth={1.85} aria-hidden="true" />
                  : <Clipboard size={15} strokeWidth={1.85} aria-hidden="true" />}
                onClick={copyLogs}
              >
                {copied ? 'Copied' : 'Copy logs'}
              </Button>
            </div>
          </div>

          <div className="log-console" role="log" aria-label="Runtime log">
            <div className="log-console-bar">
              <strong><Terminal size={14} strokeWidth={1.85} aria-hidden="true" /> debug.log</strong>
              <span className="log-count">{filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="log-lines">
              {filteredLogs.map((entry, index) => (
                <div className="log-line" key={`${entry.time}-${index}`}>
                  <time>{entry.time}</time>
                  <span className={`log-level log-${entry.level.toLowerCase()}`}>{entry.level}</span>
                  <code>{entry.message}</code>
                </div>
              ))}
              {!filteredLogs.length ? <div className="log-line log-empty"><code>No matching runtime events recorded.</code></div> : null}
            </div>
          </div>
          <div className="log-privacy"><ShieldCheck size={15} strokeWidth={1.85} aria-hidden="true" /><span>Configured provider keys are scrubbed automatically before reaching this console.</span></div>
        </SpotlightCard>
      </section>
    </div>
  )
}
