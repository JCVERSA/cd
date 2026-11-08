import { useMemo, useState } from 'react'
import { api } from '../api'
import { GlideSelect } from '../components/GlideSelect'
import { HoldButton } from '../components/HoldButton'
import { JellyRadio } from '../components/JellyRadio'
import { RubberSegment } from '../components/RubberSegment'
import { SwipeRow, type SwipeAction } from '../components/SwipeRow'
import { Badge, Button, Field, Modal, SpotlightCard, Switch } from '../components/ui'
import {
  CheckMarkIcon,
  EditPenIcon,
  PlayActionIcon,
  PlusCreateIcon,
  ProvidersIcon,
  SearchIcon,
  SparkleIcon,
  TrashBinIcon,
  TypeGlyphIcon,
  WandIcon,
} from '../icons'
import type { Command, CommandType } from '../types'

const typeMeta: Record<CommandType, { label: string; icon: typeof ProvidersIcon; tone: 'accent' | 'success' | 'warning' | 'neutral' }> = {
  ai: { label: 'AI', icon: ProvidersIcon, tone: 'accent' },
  style: { label: 'Local style', icon: SparkleIcon, tone: 'success' },
  'replacer-text': { label: 'Text', icon: TypeGlyphIcon, tone: 'warning' },
  system: { label: 'System', icon: WandIcon, tone: 'neutral' },
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
  const [sortBy, setSortBy] = useState<'default' | 'uses' | 'alpha'>('default')
  const [editing, setEditing] = useState<Command | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Command | null>(null)
  const [saving, setSaving] = useState(false)

  const enabledCount = useMemo(() => commands.filter((command) => command.enabled).length, [commands])
  const filtered = useMemo(() => {
    const matched = commands.filter((command) => {
      const matchQuery = !query || command.trigger.toLowerCase().includes(query.toLowerCase()) || command.prompt.toLowerCase().includes(query.toLowerCase())
      return matchQuery && (type === 'all' || command.type === type)
    })
    if (sortBy === 'default') return matched
    const copy = [...matched]
    if (sortBy === 'uses') return copy.sort((a, b) => b.uses - a.uses)
    return copy.sort((a, b) => a.trigger.localeCompare(b.trigger))
  }, [commands, query, sortBy, type])

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

  async function removeImmediate(target: Command) {
    const previous = commands
    onChange(commands.filter((command) => command.id !== target.id))
    try {
      await api.deleteCommand(target.id)
      notify(`.${target.trigger} removed.`, 'success')
    } catch (error) {
      onChange(previous)
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
          <p>{enabledCount} active triggers ready after any sentence across Windows applications. Swipe rows left for quick actions.</p>
        </div>
        <Button variant="primary" icon={<PlusCreateIcon size={16} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setEditing(blankCommand())}>New command</Button>
      </section>

      <SpotlightCard className="command-table-card">
        <div className="table-toolbar">
          <div className="filter-search">
            <SearchIcon size={16} strokeWidth={1.85} morphed={Boolean(query)} aria-hidden="true" />
            <input
              name="command-search"
              aria-label="Search commands"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands…"
            />
          </div>
          <JellyRadio
            ariaLabel="Command type filter"
            value={type}
            onChange={(val) => setType(val as 'all' | CommandType)}
            chipColor="var(--surface-2)"
            activeColor="var(--accent)"
            textColor="var(--text-soft)"
            activeTextColor="#110d18"
            size="sm"
            gap={6}
            radius={14}
            swell={0.14}
            barge={4}
            shrink={0.04}
            jelly={1}
            bounce={0.25}
            stagger={20}
            stiffness={580}
            items={[
              { value: 'all', label: 'All' },
              { value: 'ai', label: 'AI', icon: <ProvidersIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
              { value: 'style', label: 'Local style', icon: <SparkleIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
              { value: 'replacer-text', label: 'Text', icon: <TypeGlyphIcon size={13} strokeWidth={1.9} aria-hidden="true" /> },
            ]}
          />
          <GlideSelect
            ariaLabel="Sort commands"
            value={sortBy}
            onChange={(val) => setSortBy(val as 'default' | 'uses' | 'alpha')}
            showTags
            size="md"
            radius={11}
            menuWidth={188}
            options={[
              { value: 'default', label: 'Default order', tag: 'Curated' },
              { value: 'uses', label: 'Most used', tag: 'Activity' },
              { value: 'alpha', label: 'Trigger A–Z', tag: 'Alpha' },
            ]}
          />
          <span className="table-count">{filtered.length} command{filtered.length === 1 ? '' : 's'}</span>
        </div>

        <section className="command-table" aria-label="Commands">
          <div className="command-row command-header" aria-hidden="true">
            <span>Trigger</span>
            <span>Instruction</span>
            <span>Kind</span>
            <span>Uses</span>
            <span>Active</span>
            <span><span className="sr-only">Actions</span></span>
          </div>
          <div className="command-rows-list">
            {filtered.map((command) => {
              const meta = typeMeta[command.type]
              const Icon = meta.icon
              const canTry = Boolean(onTryCommand) && (command.type === 'ai' || command.type === 'style')
              const swipeActions: SwipeAction[] = command.type === 'system'
                ? []
                : [
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: <TrashBinIcon size={17} strokeWidth={1.9} aria-hidden="true" />,
                    },
                    {
                      id: 'edit',
                      label: 'Edit',
                      color: 'var(--swipe-action-edit, #2e2c44)',
                      icon: <EditPenIcon size={16} strokeWidth={1.9} aria-hidden="true" />,
                      onSelect: () => setEditing({ ...command }),
                    },
                    ...(canTry
                      ? [
                          {
                            id: 'try',
                            label: 'Try',
                            color: 'var(--swipe-action-try, #26384a)',
                            icon: <PlayActionIcon size={16} strokeWidth={1.9} aria-hidden="true" />,
                            onSelect: () => onTryCommand?.(command.trigger),
                          },
                        ]
                      : []),
                  ]

              return (
                <SwipeRow
                  key={command.id}
                  className="command-swipe-row"
                  label={`Command ${prefix}${command.trigger}`}
                  actions={swipeActions}
                  height={58}
                  radius={0}
                  actionWidth={74}
                  rowColor="rgba(18, 18, 26, 0.56)"
                  drawerColor="var(--swipe-drawer, #242334)"
                  actionColor="var(--swipe-action-danger, #e5484d)"
                  textColor="var(--text)"
                  onCommit={() => {
                    void removeImmediate(command)
                  }}
                >
                  <div className="command-row">
                    <div className="command-trigger"><span className="trigger-prefix">{prefix}</span><strong>{command.trigger}</strong></div>
                    <div className="command-behavior">
                      <strong>{command.prompt || command.value || 'Built-in action'}</strong>
                      <small>{command.type === 'ai' ? 'Uses active provider' : 'Runs offline on device'}</small>
                    </div>
                    <div><Badge tone={meta.tone}><Icon size={12} strokeWidth={1.85} aria-hidden="true" />{meta.label}</Badge></div>
                    <span className="uses-count">{command.uses}</span>
                    <div>
                      {command.type === 'system'
                        ? <Badge tone="neutral">Built in</Badge>
                        : <Switch checked={command.enabled} onChange={(value) => toggle(command, value)} label={`${command.enabled ? 'Disable' : 'Enable'} .${command.trigger}`} />}
                    </div>
                    <div className="row-actions">
                      {canTry ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Try .${command.trigger} in Playground`}
                          title={`Try ${prefix}${command.trigger}`}
                          icon={<PlayActionIcon size={14} strokeWidth={1.85} aria-hidden="true" />}
                          onClick={() => onTryCommand?.(command.trigger)}
                        />
                      ) : null}
                      {command.type === 'system' ? null : (
                        <>
                          <Button variant="ghost" size="icon" aria-label={`Edit .${command.trigger}`} icon={<EditPenIcon size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setEditing({ ...command })} />
                          <Button variant="ghost" size="icon" aria-label={`Delete .${command.trigger}`} icon={<TrashBinIcon size={15} strokeWidth={1.85} aria-hidden="true" />} onClick={() => setConfirmDelete(command)} />
                        </>
                      )}
                    </div>
                  </div>
                </SwipeRow>
              )
            })}
          </div>
          {!filtered.length ? (
            <div className="empty-table">
              <SearchIcon size={26} strokeWidth={1.85} aria-hidden="true" />
              <strong>No commands found</strong>
              <span>Try another search or filter.</span>
            </div>
          ) : null}
        </section>
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
                  name="command-trigger"
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
            <div className="field">
              <span className="field-label">Command type</span>
              <RubberSegment
                aria-label="Command type"
                className="command-type-rubber"
                value={editing.type}
                onChange={(nextType) => setEditing({ ...editing, type: nextType as CommandType })}
                trackColor="rgba(5, 5, 8, 0.55)"
                thumbColor="var(--accent)"
                textColor="var(--text-soft)"
                activeTextColor="#110d18"
                size="md"
                radius={10}
                inset={3}
                equalSlots
                stretch={100}
                squash={3}
                items={[
                  { value: 'ai', label: 'AI prompt', icon: <ProvidersIcon size={14} strokeWidth={1.9} aria-hidden="true" /> },
                  { value: 'replacer-text', label: 'Text snippet', icon: <TypeGlyphIcon size={14} strokeWidth={1.9} aria-hidden="true" /> },
                  { value: 'style', label: 'Local style', icon: <SparkleIcon size={14} strokeWidth={1.9} aria-hidden="true" /> },
                ]}
              />
            </div>
            {editing.type === 'ai' ? (
              <Field label="Transformation instruction" hint="The selected text is fenced separately to reduce prompt injection risk.">
                <textarea name="command-prompt" rows={5} value={editing.prompt} onChange={(event) => setEditing({ ...editing, prompt: event.target.value })} placeholder="Describe how the text should be transformed…" />
              </Field>
            ) : (
              <Field label={editing.type === 'style' ? 'Style identifier' : 'Replacement text'}>
                <textarea name="command-value" rows={4} spellCheck={editing.type !== 'style'} value={editing.value} onChange={(event) => setEditing({ ...editing, value: event.target.value })} placeholder={editing.type === 'style' ? 'e.g. bold…' : 'Enter replacement text…'} />
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
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <HoldButton
              size="sm"
              radius={10}
              holdTime={900}
              resetAfter={800}
              backgroundColor="var(--surface-3)"
              fillColor="#e5484d"
              textColor="var(--text)"
              fillTextColor="#ffffff"
              icon={<TrashBinIcon size={15} strokeWidth={1.9} aria-hidden="true" />}
              doneIcon={<CheckMarkIcon size={15} strokeWidth={2.1} aria-hidden="true" />}
              doneLabel="Deleted"
              onHold={() => {
                void remove()
              }}
              onTap={() => notify('Press and hold to delete command.')}
            >
              Hold to delete
            </HoldButton>
          </>
        }
      >
        <div className="delete-warning"><TrashBinIcon size={18} strokeWidth={1.85} aria-hidden="true" /><p>This cannot be undone, but you can recreate the command later.</p></div>
      </Modal>
    </div>
  )
}
