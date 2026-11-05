import { Bot, Pencil, Plus, Search, Sparkles, Trash2, Type, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../api'
import type { Command, CommandType } from '../types'
import { Badge, Button, Field, Modal, Select, SpotlightCard, Switch } from '../components/ui'

const typeMeta: Record<CommandType, { label: string; icon: typeof Bot; tone: 'accent' | 'success' | 'warning' | 'neutral' }> = {
  ai: { label: 'AI', icon: Bot, tone: 'accent' },
  style: { label: 'Local style', icon: Sparkles, tone: 'success' },
  'replacer-text': { label: 'Text', icon: Type, tone: 'warning' },
  system: { label: 'System', icon: Wand2, tone: 'neutral' },
}

function blankCommand(): Command {
  return { id: crypto.randomUUID(), trigger: '', type: 'ai', prompt: '', value: '', enabled: true, uses: 0 }
}

export function CommandsScreen({
  commands,
  prefix,
  onChange,
  notify,
}: {
  commands: Command[]
  prefix: string
  onChange: (commands: Command[]) => void
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | CommandType>('all')
  const [editing, setEditing] = useState<Command | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Command | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => commands.filter((command) => {
    const matchQuery = !query || command.trigger.toLowerCase().includes(query.toLowerCase()) || command.prompt.toLowerCase().includes(query.toLowerCase())
    return matchQuery && (type === 'all' || command.type === type)
  }), [commands, query, type])

  async function save() {
    if (!editing || !editing.trigger.trim()) return
    setSaving(true)
    try {
      const normalized = { ...editing, trigger: editing.trigger.trim().replace(/^\./, ''), id: editing.id || editing.trigger }
      const saved = await api.saveCommand(normalized)
      const exists = commands.some((command) => command.id === saved.id)
      onChange(exists ? commands.map((command) => command.id === saved.id ? saved : command) : [saved, ...commands])
      setEditing(null)
      notify(`.${saved.trigger} saved.`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Command could not be saved.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirmDelete) return
    try {
      await api.deleteCommand(confirmDelete.id)
      onChange(commands.filter((command) => command.id !== confirmDelete.id))
      notify(`.${confirmDelete.trigger} removed.`, 'success')
      setConfirmDelete(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Command could not be removed.', 'danger')
    }
  }

  async function toggle(command: Command, enabled: boolean) {
    try {
      const saved = await api.saveCommand({ ...command, enabled })
      onChange(commands.map((item) => item.id === saved.id ? saved : item))
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Command state could not be changed.', 'danger')
    }
  }

  return (
    <div className="screen commands-screen">
      <section className="screen-intro-row">
        <div>
          <span className="section-kicker">Inline automation</span>
          <h2>Your command library</h2>
          <p>Triggers activate after text in any supported Windows application.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setEditing(blankCommand())}>New command</Button>
      </section>

      <SpotlightCard className="command-table-card">
        <div className="table-toolbar">
          <div className="filter-search"><Search size={16}/><input aria-label="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" /></div>
          <div className="segmented-control" aria-label="Command type filter">
            {(['all', 'ai', 'style', 'replacer-text'] as const).map((item) => (
              <button key={item} className={type === item ? 'segment-active' : ''} type="button" onClick={() => setType(item)}>{item === 'all' ? 'All' : typeMeta[item].label}</button>
            ))}
          </div>
          <span className="table-count">{filtered.length} command{filtered.length === 1 ? '' : 's'}</span>
        </div>

        <div className="command-table" role="table" aria-label="Commands">
          <div className="command-row command-header" role="row">
            <span>Trigger</span><span>Behavior</span><span>Type</span><span>Uses</span><span>Enabled</span><span><span className="sr-only">Actions</span></span>
          </div>
          {filtered.map((command) => {
            const meta = typeMeta[command.type]
            const Icon = meta.icon
            return (
              <div className="command-row" role="row" key={command.id}>
                <div className="command-trigger"><span className="trigger-prefix">{prefix}</span><strong>{command.trigger}</strong></div>
                <div className="command-behavior"><strong>{command.prompt || command.value || 'Built-in action'}</strong><small>{command.type === 'ai' ? 'Uses the active provider' : 'Runs on this device'}</small></div>
                <div><Badge tone={meta.tone}><Icon size={12}/>{meta.label}</Badge></div>
                <span className="uses-count">{command.uses}</span>
                {command.type === 'system'
                  ? <Badge tone="neutral">Built in</Badge>
                  : <Switch checked={command.enabled} onChange={(value) => toggle(command, value)} label={`${command.enabled ? 'Disable' : 'Enable'} .${command.trigger}`} />}
                <div className="row-actions">
                  {command.type === 'system' ? null : <>
                    <Button variant="ghost" size="icon" aria-label={`Edit .${command.trigger}`} icon={<Pencil size={15}/>} onClick={() => setEditing({ ...command })}/>
                    <Button variant="ghost" size="icon" aria-label={`Delete .${command.trigger}`} icon={<Trash2 size={15}/>} onClick={() => setConfirmDelete(command)}/>
                  </>}
                </div>
              </div>
            )
          })}
          {!filtered.length ? <div className="empty-table"><Search size={23}/><strong>No commands found</strong><span>Try another search or filter.</span></div> : null}
        </div>
      </SpotlightCard>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing && commands.some((command) => command.id === editing.id) ? 'Edit command' : 'Create command'}
        description="A trigger runs after it is typed at the end of a text field."
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save command</Button></>}
      >
        {editing ? (
          <div className="command-form">
            <Field label="Trigger" hint={`Users will type ${prefix}${editing.trigger || 'command'}. Letters, numbers, hyphens, and underscores are safest.`}>
              <div className="prefix-input"><span>{prefix}</span><input value={editing.trigger} maxLength={50} onChange={(event) => setEditing({ ...editing, trigger: event.target.value.replace(/\s/g, '') })} placeholder="command" autoFocus /></div>
            </Field>
            <Field label="Command type">
              <Select<CommandType>
                label="Command type"
                value={editing.type}
                options={[
                  { value: 'ai', label: 'AI transformation', detail: 'Send text to your active provider prompt' },
                  { value: 'replacer-text', label: 'Text replacement', detail: 'Insert fixed text offline without AI' },
                  { value: 'style', label: 'Local style', detail: 'Transform letters with an offline Unicode style' },
                ]}
                onChange={(nextType) => setEditing({ ...editing, type: nextType })}
              />
            </Field>
            {editing.type === 'ai' ? (
              <Field label="Transformation instruction" hint="The selected text is fenced separately to reduce prompt injection risk.">
                <textarea rows={5} value={editing.prompt} onChange={(event) => setEditing({ ...editing, prompt: event.target.value })} placeholder="Describe how the text should be transformed…" />
              </Field>
            ) : (
              <Field label={editing.type === 'style' ? 'Style identifier' : 'Replacement text'}>
                <textarea rows={4} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} placeholder="Value" />
              </Field>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete command?"
        description={confirmDelete ? `.${confirmDelete.trigger} will stop working immediately.` : undefined}
        size="sm"
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" icon={<Trash2 size={15}/>} onClick={remove}>Delete</Button></>}
      >
        <div className="delete-warning"><Trash2 size={20}/><p>This cannot be undone, but you can recreate the command later.</p></div>
      </Modal>
    </div>
  )
}
