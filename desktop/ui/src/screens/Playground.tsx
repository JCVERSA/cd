import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { Badge, Button, Select, SpotlightCard, cn } from '../components/ui'
import {
  ArrowRightIcon,
  CheckMarkIcon,
  ClockPulseIcon,
  CopyCheckIcon,
  EraserSweepIcon,
  PlayActionIcon,
  SparkleIcon,
  SwapChainIcon,
} from '../icons'
import type { Command as CommandType } from '../types'

const sample = 'hey team just wanted to check if we can move the meeting to tomorrow afternoon because the current time does not work well for everyone'
const quickPresets = ['fix', 'improve', 'shorten', 'formal', 'bold'] as const

export function Playground({
  commands,
  prefix = '.',
  initialTrigger,
  notify,
}: {
  commands: CommandType[]
  prefix?: string
  initialTrigger?: string
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const available = useMemo(() => commands.filter((command) => command.type === 'ai' || command.type === 'style'), [commands])
  const commandOptions = useMemo(
    () => available.map((command) => ({
      value: command.trigger,
      label: `${prefix}${command.trigger}`,
      detail: command.prompt,
      mono: true,
    })),
    [available, prefix],
  )
  const [selected, setSelected] = useState(
    initialTrigger && available.some((item) => item.trigger === initialTrigger)
      ? initialTrigger
      : (available[0]?.trigger || 'fix'),
  )
  const [input, setInput] = useState(sample)
  const [output, setOutput] = useState('')
  const [runCount, setRunCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)

  useEffect(() => {
    if (initialTrigger && available.some((item) => item.trigger === initialTrigger)) {
      setSelected(initialTrigger)
    }
  }, [available, initialTrigger])

  const wordCount = useMemo(() => {
    const trimmed = input.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [input])

  const activeCommand = useMemo(
    () => available.find((command) => command.trigger === selected),
    [available, selected],
  )

  async function run() {
    if (!input.trim() || running) return
    setRunning(true)
    try {
      const result = await api.runPlayground({ command: selected, input })
      setOutput(result.output)
      setDuration(result.durationMs)
      setRunCount((prev) => prev + 1)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The command could not be run.', 'danger')
    } finally {
      setRunning(false)
    }
  }

  async function copy() {
    if (!output) return
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(output)
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400)
      notify('Result copied to the clipboard.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The result could not be copied.', 'danger')
    }
  }

  return (
    <div className="screen playground-screen">
      <SpotlightCard className="playground-shell">
        <div className="playground-studio-bar">
          <div className="playground-title-block">
            <h2>Command playground</h2>
            <p>{activeCommand?.prompt || 'Transform text safely without modifying any external window.'}</p>
          </div>

          <div className="playground-controls">
            <div className="playground-select-group">
              <label htmlFor="playground-command">Command</label>
              <Select
                id="playground-command"
                label="Command"
                size="sm"
                value={selected}
                options={commandOptions}
                onChange={setSelected}
              />
            </div>
            <Button
              variant="primary"
              icon={<PlayActionIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
              loading={running}
              disabled={!input.trim()}
              onClick={run}
            >
              Run command
            </Button>
          </div>
        </div>

        <div className="playground-preset-strip">
          <span className="preset-strip-label">Quick pick</span>
          <div className="preset-pills">
            {quickPresets
              .filter((trigger) => available.some((item) => item.trigger === trigger))
              .map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  className={cn('preset-pill', selected === trigger && 'preset-pill-active')}
                  aria-pressed={selected === trigger}
                  onClick={() => setSelected(trigger)}
                >
                  {prefix}{trigger}
                </button>
              ))}
          </div>
          <span className="shortcut-hint">Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run</span>
        </div>

        <div className="playground-grid">
          <section className="editor-pane">
            <div className="pane-heading">
              <label htmlFor="playground-input">Source draft</label>
              <span className="inline-suffix-preview" title="How you trigger this in any Windows app">
                … <code>{prefix}{selected}</code>
              </span>
            </div>
            <textarea
              id="playground-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void run()
                }
              }}
              placeholder="Enter text to transform…"
              spellCheck
            />
            <div className="editor-footer">
              <span>{wordCount} {wordCount === 1 ? 'word' : 'words'} · {input.length} chars</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<EraserSweepIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
                onClick={() => setInput('')}
              >
                Clear
              </Button>
            </div>
          </section>

          <div className="playground-flow" aria-hidden="true">
            <ArrowRightIcon size={18} strokeWidth={1.85} morphed={running || Boolean(output)} />
          </div>

          <section className="editor-pane result-pane">
            <div className="pane-heading">
              <span>Transformed output</span>
              {output ? <Badge tone="success"><CheckMarkIcon size={12} strokeWidth={1.85} aria-hidden="true" /> Ready</Badge> : <Badge>Idle</Badge>}
            </div>
            <div className="result-output" aria-live="polite">
              {output ? (
                <div key={runCount} className="result-text-reveal">{output}</div>
              ) : (
                <div className="result-placeholder">
                  <SparkleIcon size={24} strokeWidth={1.85} aria-hidden="true" />
                  <p>Run <code>{prefix}{selected}</code> to preview the inline replacement.</p>
                </div>
              )}
            </div>
            <div className="editor-footer">
              <span>{output ? <><ClockPulseIcon size={14} strokeWidth={1.85} aria-hidden="true" /> {duration} ms</> : 'Nothing pasted externally'}</span>
              <div className="result-footer-actions">
                {output ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<SwapChainIcon size={14} strokeWidth={1.85} aria-hidden="true" />}
                    onClick={() => { setInput(output); setOutput('') }}
                  >
                    Use as input
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CopyCheckIcon size={15} strokeWidth={1.85} morphed={copied} aria-hidden="true" />}
                  disabled={!output}
                  onClick={copy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </SpotlightCard>
    </div>
  )
}
