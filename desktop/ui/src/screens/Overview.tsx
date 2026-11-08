import { useState } from 'react'
import { ProviderLogo, getProviderTileClass } from '../components/ProviderLogo'
import { SlideCommit } from '../components/SlideCommit'
import { SwipeRow } from '../components/SwipeRow'
import { Badge, SpotlightCard } from '../components/ui'
import {
  CheckCircleIcon,
  CloseXIcon,
  PlayActionIcon,
  ShieldCheckIcon,
  SparkleIcon,
} from '../icons'
import type { AppSnapshot } from '../types'

const quickTriggers = ['fix', 'improve', 'shorten', 'formal', 'bold'] as const

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function Overview({
  snapshot,
  onTryCommand,
  onPause,
}: {
  snapshot: AppSnapshot
  onTryCommand: (trigger: string) => void
  onPause: () => void | Promise<void>
}) {
  const { runtime, activity } = snapshot
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const visibleActivity = activity.filter((item) => !dismissedIds.includes(item.id))
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
                <SlideCommit
                  label={runtime.paused ? 'Slide to resume hook' : 'Slide to pause hook'}
                  doneLabel={runtime.paused ? 'Hook paused' : 'Hook active'}
                  errorLabel="Toggle failed"
                  width={228}
                  height={40}
                  radius={20}
                  holdMs={520}
                  trackColor="var(--surface-2)"
                  handleColor={runtime.paused ? '#68d6aa' : 'var(--accent)'}
                  successColor="#22c55e"
                  dangerColor="#e5484d"
                  onConfirm={() => onPause()}
                />
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

          <dl className="routing-specs routing-specs-flush">
            <div>
              <dt>Active model</dt>
              <dd className="mono-copy" title={runtime.model}>{runtime.model || 'None selected'}</dd>
            </div>
            <div>
              <dt>Endpoint</dt>
              <dd className="mono-copy" title={endpointHost}>{endpointHost}</dd>
            </div>
          </dl>
        </SpotlightCard>
      </section>

      <section className="overview-bento-bottom overview-bento-single">
        <SpotlightCard className="activity-card">
          <div className="section-heading">
            <div className="card-header-clean">
              <h3>Recent executions</h3>
              <span>Latest inline replacements in this session</span>
            </div>
          </div>
          <div className="activity-list">
            {visibleActivity.length ? visibleActivity.map((item) => {
              const rawTrigger = item.command.startsWith(runtime.prefix)
                ? item.command.slice(runtime.prefix.length)
                : item.command.replace(/^\./, '')
              return (
                <SwipeRow
                  key={item.id}
                  className="activity-swipe-row"
                  label={`Execution ${item.command}`}
                  height={48}
                  radius={10}
                  actionWidth={72}
                  rowColor="var(--surface-2)"
                  drawerColor="#242336"
                  actionColor="#d9485f"
                  textColor="var(--text)"
                  actions={[
                    {
                      id: 'dismiss',
                      label: 'Dismiss',
                      icon: <CloseXIcon size={16} strokeWidth={1.9} aria-hidden="true" />,
                    },
                    {
                      id: 'rerun',
                      label: 'Try live',
                      color: '#2d3b4e',
                      icon: <PlayActionIcon size={15} strokeWidth={1.9} aria-hidden="true" />,
                      onSelect: () => onTryCommand(rawTrigger),
                    },
                  ]}
                  onCommit={() => {
                    setDismissedIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
                  }}
                >
                  <div className="activity-row">
                    <span className="activity-status" aria-hidden="true"><CheckCircleIcon size={15} strokeWidth={1.85} /></span>
                    <div className="activity-main">
                      <strong>{item.command}</strong>
                      <span>{item.provider}</span>
                    </div>
                    <span className="activity-duration">{item.durationMs} ms</span>
                    <time>{item.time}</time>
                  </div>
                </SwipeRow>
              )
            }) : (
              <div className="activity-empty">
                <SparkleIcon size={24} strokeWidth={1.85} aria-hidden="true" />
                <p>No executions in this session yet</p>
                <span>Type any sentence followed by <code>{runtime.prefix}fix</code> or <code>{runtime.prefix}bold</code> in any Windows app to see telemetry here.</span>
              </div>
            )}
          </div>
        </SpotlightCard>

        <div className="assurance-strip">
          <ShieldCheckIcon size={17} strokeWidth={1.85} aria-hidden="true" />
          <p><strong>Local-first privacy:</strong> Unicode styles never touch the network, and API keys stay encrypted inside Windows DPAPI.</p>
        </div>
      </section>
    </div>
  )
}
