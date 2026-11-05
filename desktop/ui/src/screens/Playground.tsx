import { ArrowRight, Check, Clipboard, Clock3, Eraser, Play, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Command as CommandType } from '../types'
import { api } from '../api'
import { Badge, Button, Select, SpotlightCard } from '../components/ui'

const sample = 'hey team just wanted to check if we can move the meeting to tomorrow afternoon because the current time does not work well for everyone'

export function Playground({ commands, prefix = '.', notify }: { commands: CommandType[]; prefix?: string; notify: (message: string, tone?: 'success' | 'danger') => void }) {
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
  const [selected, setSelected] = useState(available[0]?.trigger || 'fix')
  const [input, setInput] = useState(sample)
  const [output, setOutput] = useState('')
  const [duration, setDuration] = useState(0)
  const [running, setRunning] = useState(false)

  async function run() {
    if (!input.trim()) return
    setRunning(true)
    try {
      const result = await api.runPlayground({ command: selected, input })
      setOutput(result.output)
      setDuration(result.durationMs)
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
      notify('Result copied to the clipboard.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The result could not be copied.', 'danger')
    }
  }

  return (
    <div className="screen playground-screen">
      <SpotlightCard className="playground-shell">
        <div className="playground-toolbar">
          <div>
            <span className="section-kicker">Safe testing</span>
            <h2>Command playground</h2>
          </div>
          <div className="toolbar-meta"><Badge tone="accent"><Sparkles size={12} /> {selected}</Badge><span>Nothing is pasted automatically</span></div>
        </div>

        <div className="playground-grid">
          <section className="editor-pane">
            <div className="pane-heading">
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
            <label className="editor-label" htmlFor="playground-input">Input text</label>
            <textarea
              id="playground-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter text to transform…"
              spellCheck
            />
            <div className="editor-footer">
              <span>{input.length} characters</span>
              <Button variant="ghost" size="sm" icon={<Eraser size={14} />} onClick={() => setInput('')}>Clear</Button>
            </div>
          </section>

          <div className="playground-flow" aria-hidden="true"><ArrowRight size={18} /></div>

          <section className="editor-pane result-pane">
            <div className="pane-heading">
              <span>Result</span>
              {output ? <Badge tone="success"><Check size={12} /> Complete</Badge> : <Badge>Waiting</Badge>}
            </div>
            <div className="result-output" aria-live="polite">
              {output || <div className="result-placeholder"><Sparkles size={23} /><p>Your transformed text will appear here.</p></div>}
            </div>
            <div className="editor-footer">
              <span>{output ? <><Clock3 size={13} /> {duration} ms</> : 'Ready when you are'}</span>
              <Button variant="ghost" size="sm" icon={<Clipboard size={14} />} disabled={!output} onClick={copy}>Copy</Button>
            </div>
          </section>
        </div>

        <div className="playground-actionbar">
          <p><strong>Tip:</strong> In any app, type your prefix and command after the text you want to transform.</p>
          <Button variant="primary" icon={<Play size={16} />} loading={running} disabled={!input.trim()} onClick={run}>Run command</Button>
        </div>
      </SpotlightCard>
    </div>
  )
}
