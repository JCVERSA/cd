import { Bot, Pencil, Play, Plus, Search, Sparkles, Trash2, Type, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../api'
import { Badge, Button, Field, Modal, Select, SpotlightCard, Switch } from '../components/ui'
import type { Command, CommandType } from '../types'

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
  onTryCommand,
  notify,
}: {
  commands: Command[]
  prefix: string
  onChange: (commands: Command[]) => void
  onTryCommand?: (trigger: string) => void
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | CommandType>('all')
  const [editing, setEditing] = useState<Command | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Command | null>(null)
  const [saving, setSaving] = useState(false)

  const enabledCount = useMemo(() => commands.filter((command) => command.enabled).length, [commands])
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
          <h2>Your command library</h2>
          <p>{enabledCount} active triggers ready after any sentence across Windows applications.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setEditing(blankCommand())}>New command</Button>
      </section>

      <SpotlightCard className="command-table-card">
        <div className="table-toolbar">
          <div className="filter-search">
            <Search size={16} strokeWidth={1.85} aria-hidden="true" />
            <input aria-label="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" />
          </div>
          <div className="segmented-control" role="group" aria-label="Command type filter">
            {(['all', 'ai', 'style', 'replacer-text'] as const).map((item) => (
              <button
                key={item}
                className={type === item ? 'segment-active' : ''}
                aria-pressed={type === item}
                type="button"
                onClick={() => setType(item)}
              >
                {item === 'all' ? 'All' : typeMeta[item].label}
              </button>
            ))}
          </div>
          <span className="table-count">{filtered.length} command{filtered.length === 1 ? '' : 's'}</span>
        </div>

        <div className="command-table" role="table" aria-label="Commands">
          <div role="rowgroup">
            <div className="command-row command-header" role="row">
              <span role="columnheader">Trigger</span>
              <span role="columnheader">Instruction</span>
              <span role="columnheader">Kind</span>
              <span role="columnheader">Uses</span>
              <span role="columnheader">Active</span>
              <span role="columnheader"><span className="sr-only">Actions</span></span>
            </div>
          </div>
          <div role="rowgroup">
            {filtered.map((command) => {
              const meta = typeMeta[command.type]
              const Icon = meta.icon
              const canTry = Boolean(onTryCommand) && (command.type === 'ai' || command.type === 'style')
              return (
                <div className="command-row" role="row" key={command.id}>
                  <div className="command-trigger" role="cell"><span className="trigger-prefix">{prefix}</span><strong>{command.trigger}</strong></div>
                  <div className="command-behavior" role="cell">
                    <strong>{command.prompt || command.value || 'Built-in action'}</strong>
                    <small>{command.type === 'ai' ? 'Uses active provider' : 'Runs offline on device'}</small>
                  </div>
                  <div role="cell"><Badge tone={meta.tone}><Icon size={12} strokeWidth={1.85} aria-hidden="true" />{meta.label}</Badge></div>
                  <span className="uses-count" role="cell">{command.uses}</span>
                  <div role="cell">
                    {command.type === 'system'
                      ? <Badge tone="neutral">Built in</Badge>
                      : <Switch checked={command.enabled} onChange={(value) => toggle(command, value)} label={`${command.enabled ? 'Disable' : 'Enable'} .${command.trigger}`} />}
                  </div>
                  <div className="row-actions" role="cell">
                    {canTry ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Try .${command.trigger} in Playground`}
                        title={`Try ${prefix}${command.trigger}`}
                        icon={<Play size={14} strokeWidth={1.85} aria-hidden="true" />}
                        onClick={() => onTryCommand?.(command.trigger)}
                      />
                    ) : null}
                    {command.type === 'system' ? null : (
                      <>
                        <Button variant="ghost" size="icon" aria-label={`Edit .${command.trigger}`} icon={<Pencil size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setEditing({ ...command })} />
                        <Button variant="ghost" size="icon" aria-label={`Delete .${command.trigger}`} icon={<Trash2 size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setConfirmDelete(command)} />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {!filtered.length ? (
            <div className="empty-table">
              <Search size={26} strokeWidth={1.85} aria-hidden="true" />
              <strong>No commands found</strong>
              <span>Try another search or filter.</span>
            </div>
          ) : null}
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
              <div className="prefix-input">
                <span>{prefix}</span>
                <input
                  data-autofocus=""
                  value={editing.trigger}
                  maxLength={50}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setEditing({ ...editing, trigger: event.target.value.replace(/\s/g, '') })}
                  placeholder="command…"
                />
              </div>
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
                <textarea rows={4} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} placeholder="Enter value…" />
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
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" icon={<Trash2 size={16} strokeWidth={1.85} aria-hidden="true" />} onClick={remove}>Delete</Button></>}
      >
        <div className="delete-warning"><Trash2 size={18} strokeWidth={1.85} aria-hidden="true" /><p>This cannot be undone, but you can recreate the command later.</p></div>
      </Modal>
    </div>
  )
}
