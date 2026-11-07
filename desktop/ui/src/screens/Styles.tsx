import { Check, Clipboard, CloudOff, Info } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, Button, SpotlightCard, cn } from '../components/ui'
import { styles } from '../styleTransforms'

const defaultSample = 'SwiftSlate makes writing feel effortless 2026'

export function StylesScreen({
  prefix,
  notify,
}: {
  prefix: string
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [sample, setSample] = useState(defaultSample)
  const [selected, setSelected] = useState('bold')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimer = useRef<number | null>(null)
  const active = styles.find((style) => style.id === selected) || styles[0]
  const activeOutput = active.transform(sample)

  async function copyText(text: string, id: string) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1400)
      notify('Styled text copied to the clipboard.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Styled text could not be copied.', 'danger')
    }
  }

  return (
    <div className="screen styles-screen">
      <section className="screen-intro-row">
        <div>
          <h2>Style text without a network request</h2>
          <p>Unicode presentation characters run 100% locally and leave accents, emoji, and non-Latin scripts untouched.</p>
        </div>
        <Badge tone="success"><CloudOff size={12} strokeWidth={1.85} aria-hidden="true" /> Offline engine</Badge>
      </section>

      <SpotlightCard className="foundry-composer">
        <div className="foundry-input-pane">
          <label className="foundry-label" htmlFor="style-sample">Sample phrase</label>
          <textarea
            id="style-sample"
            rows={2}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
            maxLength={240}
            placeholder="Type any phrase to preview all 7 styles live…"
          />
          <span className="foundry-hint">
            In any Windows app, type your text followed by <code>{prefix}{active.id}</code> to transform in place.
          </span>
        </div>

        <div className="foundry-stage-pane">
          <div className="foundry-stage-top">
            <div className="foundry-stage-meta">
              <strong>{active.name}</strong>
              <Badge tone="accent">{prefix}{active.id}</Badge>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={copiedId === active.id
                ? <Check size={15} strokeWidth={1.85} aria-hidden="true" />
                : <Clipboard size={15} strokeWidth={1.85} aria-hidden="true" />}
              onClick={() => void copyText(activeOutput, active.id)}
            >
              {copiedId === active.id ? 'Copied' : 'Copy specimen'}
            </Button>
          </div>
          <p className="foundry-stage-output">{activeOutput || 'Your styled preview appears here.'}</p>
        </div>
      </SpotlightCard>

      <section className="specimen-grid" aria-label="Unicode style specimens">
        {styles.map((style, index) => {
          const preview = style.transform(sample || 'SwiftSlate 2026')
          const isSelected = selected === style.id
          return (
            <SpotlightCard
              key={style.id}
              interactive
              delay={index * 0.02}
              className={cn('specimen-card', isSelected && 'specimen-card-active')}
            >
              <button
                type="button"
                className="specimen-select-hit"
                aria-pressed={isSelected}
                onClick={() => setSelected(style.id)}
              >
                <div className="specimen-card-head">
                  <span className="style-swatch" aria-hidden="true">{style.transform('Aa')}</span>
                  <div className="specimen-card-titles">
                    <strong>{style.name}</strong>
                    <small>{style.description}</small>
                  </div>
                  <code>{prefix}{style.id}</code>
                </div>
                <p className="specimen-live-line">{preview}</p>
              </button>
            </SpotlightCard>
          )
        })}
      </section>

      <div className="style-note">
        <Info size={16} strokeWidth={1.85} aria-hidden="true" />
        <p>Unicode styles substitute code points rather than changing the host application’s font. Visual weight varies slightly by installed system font.</p>
      </div>
    </div>
  )
}
