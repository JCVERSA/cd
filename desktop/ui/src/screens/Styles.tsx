import { Check, Clipboard, CloudOff, Info, Palette, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, Button, SpotlightCard } from '../components/ui'
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
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)
  const active = styles.find((style) => style.id === selected) || styles[0]
  const result = active.transform(sample)

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(result)
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400)
      notify('Styled text copied to the clipboard.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Styled text could not be copied.', 'danger')
    }
  }

  return (
    <div className="screen styles-screen">
      <section className="screen-intro-row">
        <div>
          <span className="section-kicker">Offline transformations</span>
          <h2>Style text without a network request</h2>
          <p>SwiftSlate uses Unicode presentation characters and preserves unsupported scripts.</p>
        </div>
        <Badge tone="success"><CloudOff size={12} strokeWidth={1.85} aria-hidden="true" /> Always local</Badge>
      </section>

      <section className="style-layout">
        <SpotlightCard className="style-picker-card">
          <div className="section-heading compact">
            <div><span className="section-kicker">Library</span><h3>Choose a style</h3></div>
            <Palette size={18} strokeWidth={1.85} className="muted-icon" aria-hidden="true" />
          </div>
          <div className="style-option-list">
            {styles.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`style-option ${selected === style.id ? 'style-option-active' : ''}`}
                onClick={() => setSelected(style.id)}
              >
                <span className="style-swatch" aria-hidden="true">{style.transform('Aa')}</span>
                <span><strong>{style.name}</strong><small>{style.description}</small></span>
                {selected === style.id ? (
                  <span className="selected-check" aria-hidden="true"><Check size={12} strokeWidth={2.2} /></span>
                ) : null}
              </button>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="style-preview-card">
          <div className="section-heading">
            <div><span className="section-kicker">Live preview</span><h3>{active.name}</h3></div>
            <Badge tone="accent">{prefix}{active.id}</Badge>
          </div>
          <label className="style-input-label" htmlFor="style-sample">Preview text</label>
          <textarea id="style-sample" rows={3} value={sample} onChange={(event) => setSample(event.target.value)} maxLength={240} />
          <div className="style-output">
            <div className="style-output-heading">
              <span>Transformed output</span>
              <Button
                variant="ghost"
                size="sm"
                icon={copied
                  ? <Check size={16} strokeWidth={1.85} aria-hidden="true" />
                  : <Clipboard size={16} strokeWidth={1.85} aria-hidden="true" />}
                onClick={copy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p>{result || 'Your preview will appear here.'}</p>
          </div>
          <div className="style-note">
            <Info size={16} strokeWidth={1.85} aria-hidden="true" />
            <p>This changes characters, not the host application’s font. Appearance depends on the app and installed fonts.</p>
          </div>
        </SpotlightCard>
      </section>

      <SpotlightCard className="style-usage-card">
        <span className="usage-spark" aria-hidden="true"><Sparkles size={18} strokeWidth={1.85} /></span>
        <div>
          <strong>Use it anywhere</strong>
          <p>Type your text followed by <code>{prefix}{active.id}</code>. SwiftSlate replaces the field content and restores your clipboard.</p>
        </div>
      </SpotlightCard>
    </div>
  )
}
