import { useRef, useState } from 'react'
import { ChromaGrid } from '../components/ChromaGrid'
import { RubberSegment } from '../components/RubberSegment'
import { Badge, Button, SpotlightCard, cn } from '../components/ui'
import { CopyCheckIcon, InfoCircleIcon, OfflineCloudIcon } from '../icons'
import { styles } from '../styleTransforms'

const defaultSample = 'SwiftSlate makes writing feel effortless 2026'

const styleAccents: Record<string, string> = {
  bold: '#d9c7ff',
  italic: '#88b8ff',
  mono: '#75e5bc',
  bubble: '#ffafc8',
  gothic: '#ffc76b',
  smallcaps: '#60d5ff',
}

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
        <Badge tone="success"><OfflineCloudIcon size={12} strokeWidth={1.85} aria-hidden="true" /> Offline engine</Badge>
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
            placeholder="Type any phrase to preview all 6 styles live…"
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
              icon={<CopyCheckIcon size={15} strokeWidth={1.85} morphed={copiedId === active.id} aria-hidden="true" />}
              onClick={() => void copyText(activeOutput, active.id)}
            >
              {copiedId === active.id ? 'Copied' : 'Copy specimen'}
            </Button>
          </div>
          <RubberSegment
            aria-label="Active Unicode style"
            className="foundry-rubber-segment"
            value={selected}
            onChange={(val) => setSelected(val)}
            items={styles.map((style) => ({
              value: style.id,
              label: style.id === 'mono' ? 'Mono' : style.name,
            }))}
            trackColor="rgba(6, 6, 10, 0.52)"
            thumbColor="var(--accent)"
            textColor="var(--text-soft)"
            activeTextColor="#110d18"
            size="sm"
            radius={9}
            inset={2}
            equalSlots={false}
            stretch={100}
            squash={3}
            draggable
          />
          <p className="foundry-stage-output">{activeOutput || 'Your styled preview appears here.'}</p>
        </div>
      </SpotlightCard>

      <ChromaGrid
        as="section"
        ariaLabel="Unicode style specimens"
        className="specimen-grid"
        columns={2}
        minCardWidth={280}
        gap={12}
        radius={270}
        softness={0.62}
        damping={0.42}
        fadeOut={0.55}
        glow={0.56}
        borderGlow={0.92}
        cardRadius={14}
        items={styles.map((style) => {
          const preview = style.transform(sample || 'SwiftSlate 2026')
          const isSelected = selected === style.id
          return {
            id: style.id,
            accent: styleAccents[style.id] || '#d9c7ff',
            className: cn('specimen-card', isSelected && 'specimen-card-active'),
            children: (
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
            ),
          }
        })}
      />

      <div className="style-note">
        <InfoCircleIcon size={16} strokeWidth={1.85} aria-hidden="true" />
        <p>Unicode styles substitute code points rather than changing the host application’s font. Visual weight varies slightly by installed system font.</p>
      </div>
    </div>
  )
}
