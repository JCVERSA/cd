import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Command,
  KeyRound,
  MousePointer2,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react'
import type { AppSnapshot, PageId } from '../types'
import { Badge, Button, SpotlightCard } from '../components/ui'

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function Overview({
  snapshot,
  onNavigate,
  onPause,
}: {
  snapshot: AppSnapshot
  onNavigate: (page: PageId) => void
  onPause: () => void
}) {
  const { runtime, activity } = snapshot
  return (
    <div className="screen overview-screen">
      <section className="hero-grid">
        <SpotlightCard className="runtime-hero">
          <div className="runtime-hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Runtime</div>
            <h2>{runtime.paused ? 'SwiftSlate is paused' : 'SwiftSlate is listening'}</h2>
            <p>
              {runtime.paused
                ? 'Inline commands are temporarily disabled. Your configuration is still safe.'
                : <>Type <code>{runtime.prefix}fix</code>, <code>{runtime.prefix}improve</code>, or any custom trigger in a text field.</>}
            </p>
            <div className="hero-actions">
              <Button
                variant="primary"
                icon={runtime.paused ? <PlayCircle size={17} /> : <PauseCircle size={17} />}
                onClick={onPause}
              >
                {runtime.paused ? 'Resume engine' : 'Pause engine'}
              </Button>
              <Button variant="ghost" icon={<MousePointer2 size={16} />} onClick={() => onNavigate('playground')}>
                Open playground
              </Button>
            </div>
          </div>
          <div className="runtime-visual" aria-hidden="true">
            <div className="pulse-shell pulse-shell-outer" />
            <div className="pulse-shell pulse-shell-inner" />
            <div className="runtime-glyph"><Sparkles size={29} /></div>
            <span className="orbit-dot orbit-dot-a" />
            <span className="orbit-dot orbit-dot-b" />
          </div>
        </SpotlightCard>

        <SpotlightCard className="provider-hero" delay={0.04}>
          <div className="card-heading-row">
            <div className="icon-tile"><Bot size={18} /></div>
            <Badge tone="success">Connected</Badge>
          </div>
          <span className="card-kicker">Active provider</span>
          <h3>{runtime.provider === 'gemini' ? 'Google Gemini' : runtime.provider}</h3>
          <p className="mono-copy">{runtime.model}</p>
          <button type="button" className="text-link" onClick={() => onNavigate('providers')}>
            Manage provider <ArrowRight size={14} />
          </button>
        </SpotlightCard>
      </section>

      <section className="stat-grid" aria-label="Runtime statistics">
        <SpotlightCard className="stat-card" delay={0.08}>
          <div className="stat-icon accent-purple"><Command size={18} /></div>
          <div><span>Commands</span><strong>{runtime.commandCount}</strong><small>available globally</small></div>
        </SpotlightCard>
        <SpotlightCard className="stat-card" delay={0.12}>
          <div className="stat-icon accent-blue"><Zap size={18} /></div>
          <div><span>Requests today</span><strong>{runtime.requestsToday}</strong><small>all processed locally first</small></div>
        </SpotlightCard>
        <SpotlightCard className="stat-card" delay={0.16}>
          <div className="stat-icon accent-green"><Clock3 size={18} /></div>
          <div><span>Uptime</span><strong>{formatDuration(runtime.uptimeSeconds)}</strong><small>zero CPU while idle</small></div>
        </SpotlightCard>
        <SpotlightCard className="stat-card" delay={0.2}>
          <div className="stat-icon accent-rose"><KeyRound size={18} /></div>
          <div><span>Protected keys</span><strong>{runtime.protectedKeyCount}</strong><small>encrypted with DPAPI</small></div>
        </SpotlightCard>
      </section>

      <section className="content-grid">
        <SpotlightCard className="activity-card" delay={0.24}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">Live history</span>
              <h3>Recent activity</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('diagnostics')}>View logs</Button>
          </div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-row" key={item.id}>
                <span className="activity-status"><CheckCircle2 size={16} /></span>
                <div className="activity-main">
                  <strong>{item.command}</strong>
                  <span>{item.provider}</span>
                </div>
                <span className="activity-duration">{item.durationMs} ms</span>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <div className="side-card-stack">
          <SpotlightCard className="quick-card" delay={0.28}>
            <div className="section-heading compact">
              <div><span className="section-kicker">Shortcuts</span><h3>Quick actions</h3></div>
              <WandSparkles size={18} className="muted-icon" />
            </div>
            <button className="quick-action" type="button" onClick={() => onNavigate('commands')}>
              <span className="quick-icon"><Command size={16} /></span>
              <span><strong>Create command</strong><small>Add a new inline trigger</small></span>
              <ArrowRight size={15} />
            </button>
            <button className="quick-action" type="button" onClick={() => onNavigate('providers')}>
              <span className="quick-icon"><Bot size={16} /></span>
              <span><strong>Add provider</strong><small>Connect a model endpoint</small></span>
              <ArrowRight size={15} />
            </button>
          </SpotlightCard>

          <SpotlightCard className="security-card" delay={0.32}>
            <div className="security-icon"><ShieldCheck size={20} /></div>
            <div>
              <strong>Private by design</strong>
              <p>Local styles never use the network. Credentials stay encrypted for your Windows account.</p>
            </div>
          </SpotlightCard>
        </div>
      </section>
    </div>
  )
}
