import { AlertTriangle, CheckCircle2, Clipboard, LoaderCircle, Play, RefreshCw, ShieldCheck, Terminal, XCircle } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import type { DiagnosticCheck, LogEntry } from '../types'
import { Badge, Button, SpotlightCard } from '../components/ui'

function CheckIcon({ status }: { status: DiagnosticCheck['status'] }) {
  if (status === 'pass') return <CheckCircle2 size={18}/>
  if (status === 'warn') return <AlertTriangle size={18}/>
  if (status === 'fail') return <XCircle size={18}/>
  return <LoaderCircle size={18}/>
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
  const [running, setRunning] = useState(false)
  const [refreshingLogs, setRefreshingLogs] = useState(false)

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
      notify('Redacted logs copied.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Logs could not be copied.', 'danger')
    }
  }

  const passing = checks.filter((check) => check.status === 'pass').length
  return (
    <div className="screen diagnostics-screen">
      <section className="diagnostic-hero">
        <div>
          <span className="section-kicker">Local health</span>
          <h2>{passing === checks.length ? 'Everything looks good' : 'SwiftSlate needs attention'}</h2>
          <p>These checks run on this computer. API keys and captured text are never included in logs.</p>
        </div>
        <Button variant="primary" loading={running} icon={<Play size={16}/>} onClick={run}>Run all checks</Button>
      </section>

      <section className="diagnostic-grid">
        {checks.map((check, index) => (
          <SpotlightCard className={`diagnostic-check check-${check.status}`} key={check.id} delay={index * 0.035}>
            <span className="check-icon"><CheckIcon status={check.status}/></span>
            <div><strong>{check.label}</strong><p>{check.status === 'idle' && running ? 'Checking…' : check.detail}</p></div>
            <Badge tone={check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : check.status === 'fail' ? 'danger' : 'neutral'}>{check.status === 'pass' ? 'Passed' : check.status}</Badge>
          </SpotlightCard>
        ))}
      </section>

      <SpotlightCard className="logs-card" delay={0.12}>
        <div className="section-heading">
          <div><span className="section-kicker">Redacted automatically</span><h3>Runtime log</h3></div>
          <div className="log-actions"><Button variant="ghost" size="sm" loading={refreshingLogs} icon={<RefreshCw size={14}/>} onClick={refreshLogs}>Refresh</Button><Button variant="secondary" size="sm" icon={<Clipboard size={14}/>} onClick={copyLogs}>Copy logs</Button></div>
        </div>
        <div className="log-console" role="log" aria-label="Runtime log">
          <div className="log-console-bar"><span/><span/><span/><strong><Terminal size={13}/> debug.log</strong></div>
          <div className="log-lines">
            {logs.map((entry, index) => (
              <div className="log-line" key={`${entry.time}-${index}`}><time>{entry.time}</time><span className={`log-level log-${entry.level.toLowerCase()}`}>{entry.level}</span><code>{entry.message}</code></div>
            ))}
            {!logs.length ? <div className="log-line"><code>No runtime events have been recorded yet.</code></div> : null}
          </div>
        </div>
        <div className="log-privacy"><ShieldCheck size={15}/><span>Secrets matching configured API keys are replaced before they reach this log.</span></div>
      </SpotlightCard>
    </div>
  )
}
