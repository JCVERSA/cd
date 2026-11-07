import { ProviderLogo, getProviderTileClass } from '../components/ProviderLogo'
import { Badge, Button, SpotlightCard } from '../components/ui'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CommandsIcon,
  CursorSparkIcon,
  PlayPauseCircleIcon,
  ShieldCheckIcon,
  StylesIcon,
} from '../icons'
import type { AppSnapshot, PageId } from '../types'

const quickTriggers = ['fix', 'improve', 'shorten', 'formal', 'bold'] as const

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function Overview({
  snapshot,
  onNavigate,
  onTryCommand,
  onPause,
}: {
  snapshot: AppSnapshot
  onNavigate: (page: PageId) => void
  onTryCommand: (trigger: string) => void
  onPause: () => void
}) {
  const { runtime, activity } = snapshot
  const activeProviderRecord = snapshot.providers.find((item) => item.id === runtime.provider)
  const isProviderReady = Boolean(
    activeProviderRecord?.connected || activeProviderRecord?.local || activeProviderRecord?.keyConfigured,
  )
  const endpointHost = activeProviderRecord?.local
    ? '127.0.0.1 (Local runtime)'
    : activeProviderRecord?.endpoint.replace(/^https?:\/\//, '').split('/')[0] || 'Custom endpoint'

  return (
    <div className="screen overview-screen">
      <section className="overview-bento-top">
        <SpotlightCard className="engine-stage" interactive>
          <div className="engine-stage-top">
            <div className="engine-stage-copy">
              <div className="status-pill-inline">
                <span className={`live-dot ${runtime.paused ? 'live-dot-paused' : ''}`} aria-hidden="true" />
                <span>{runtime.paused ? 'Inline hook paused' : 'Global keyboard hook active'}</span>
              </div>
              <h2>{runtime.paused ? 'SwiftSlate is paused' : 'SwiftSlate is listening'}</h2>
              <p>
                {runtime.paused
                  ? 'Inline triggers are paused across Windows. Your commands and encrypted credentials remain intact.'
                  : <>Finish any sentence with <code>{runtime.prefix}fix</code>, <code>{runtime.prefix}improve</code>, or a custom trigger to rewrite text in place.</>}
              </p>
              <div className="hero-actions">
                <Button
                  variant="primary"
                  icon={<PlayPauseCircleIcon size={16} strokeWidth={1.85} morphed={runtime.paused} aria-hidden="true" />}
                  onClick={onPause}
                >
                  {runtime.paused ? 'Resume engine' : 'Pause engine'}
                </Button>
                <Button
                  variant="secondary"
                  icon={<CursorSparkIcon size={16} strokeWidth={1.85} aria-hidden="true" />}
                  onClick={() => onNavigate('playground')}
                >
                  Open playground
                </Button>
              </div>
            </div>

            <div className="inline-specimen-frame" aria-label="Inline command specimen">
              <div className="specimen-row">
                <span className="specimen-tag">Typed</span>
                <code>we should push release to fri {runtime.prefix}formal</code>
              </div>
              <div className="specimen-row specimen-row-out">
                <span className="specimen-tag">Replaced</span>
                <strong>Let’s move the release to Friday.</strong>
              </div>
              <div className="specimen-triggers">
                <span>Try live:</span>
                {quickTriggers.map((trigger) => (
                  <button
                    key={trigger}
                    type="button"
                    className="trigger-chip"
                    onClick={() => onTryCommand(trigger)}
                  >
                    {runtime.prefix}{trigger}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="telemetry-ledger" role="region" aria-label="Runtime statistics">
            <div className="telemetry-cell">
              <span>Commands</span>
              <strong>{runtime.commandCount}</strong>
              <small>active globally</small>
            </div>
            <div className="telemetry-cell">
              <span>Requests today</span>
              <strong>{runtime.requestsToday}</strong>
              <small>local styles run offline</small>
            </div>
            <div className="telemetry-cell">
              <span>Session uptime</span>
              <strong>{formatDuration(runtime.uptimeSeconds)}</strong>
              <small>zero idle CPU polling</small>
            </div>
            <div className="telemetry-cell">
              <span>Protected keys</span>
              <strong>{runtime.protectedKeyCount}</strong>
              <small>Windows DPAPI bound</small>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="routing-pod" interactive delay={0.03}>
          <div className="routing-pod-header">
            <div className={`provider-mark ${getProviderTileClass(runtime.provider)}`}>
              <ProviderLogo id={runtime.provider} size={21} />
            </div>
            <Badge tone={isProviderReady ? 'success' : 'warning'}>
              {isProviderReady ? 'Connected' : 'Setup needed'}
            </Badge>
          </div>

          <div className="routing-pod-body">
            <h3>{activeProviderRecord?.name || runtime.provider}</h3>
            <p>{activeProviderRecord?.description || 'Active model endpoint for AI inline commands.'}</p>
          </div>

          <dl className="routing-specs">
            <div>
              <dt>Active model</dt>
              <dd className="mono-copy" title={runtime.model}>{runtime.model || 'None selected'}</dd>
            </div>
            <div>
              <dt>Endpoint</dt>
              <dd className="mono-copy" title={endpointHost}>{endpointHost}</dd>
            </div>
          </dl>

          <div className="routing-pod-footer">
            <button type="button" className="text-link" onClick={() => onNavigate('providers')}>
              <span>{isProviderReady ? 'Switch or configure model' : 'Configure API key'}</span>
              <ArrowRightIcon size={15} strokeWidth={1.85} aria-hidden="true" />
            </button>
          </div>
        </SpotlightCard>
      </section>

      <section className="overview-bento-bottom">
        <div className="launchpad-column">
          <SpotlightCard className="launchpad-card">
            <div className="card-header-clean">
              <h3>Workspace actions</h3>
              <span>Jump straight to setup</span>
            </div>
            <div className="launchpad-list">
              <button className="quick-action" type="button" onClick={() => onNavigate('commands')}>
                <span className="quick-icon" aria-hidden="true"><CommandsIcon size={16} strokeWidth={1.85} /></span>
                <span><strong>Create command</strong><small>Define a custom prompt or text snippet</small></span>
                <ArrowRightIcon size={15} strokeWidth={1.85} aria-hidden="true" />
              </button>
              <button className="quick-action" type="button" onClick={() => onNavigate('styles')}>
                <span className="quick-icon" aria-hidden="true"><StylesIcon size={16} strokeWidth={1.85} /></span>
                <span><strong>Typography foundry</strong><small>Preview offline Unicode styles</small></span>
                <ArrowRightIcon size={15} strokeWidth={1.85} aria-hidden="true" />
              </button>
            </div>
          </SpotlightCard>

          <div className="assurance-strip">
            <ShieldCheckIcon size={17} strokeWidth={1.85} aria-hidden="true" />
            <p><strong>Local-first privacy:</strong> Unicode styles never touch the network, and API keys stay encrypted inside Windows DPAPI.</p>
          </div>
        </div>

        <SpotlightCard className="activity-card">
          <div className="section-heading">
            <div className="card-header-clean">
              <h3>Recent executions</h3>
              <span>Latest inline replacements in this session</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('diagnostics')}>View logs</Button>
          </div>
          <div className="activity-list">
            {activity.length ? activity.map((item) => (
              <div className="activity-row" key={item.id}>
                <span className="activity-status" aria-hidden="true"><CheckCircleIcon size={15} strokeWidth={1.85} /></span>
                <div className="activity-main">
                  <strong>{item.command}</strong>
                  <span>{item.provider}</span>
                </div>
                <span className="activity-duration">{item.durationMs} ms</span>
                <time>{item.time}</time>
              </div>
            )) : (
              <div className="activity-empty">
                <p>No inline commands triggered yet.</p>
                <span>Type <code>{runtime.prefix}fix</code> or <code>{runtime.prefix}bold</code> at the end of text in any app, or test one in Playground.</span>
              </div>
            )}
          </div>
        </SpotlightCard>
      </section>
    </div>
  )
}
