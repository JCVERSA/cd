import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { Badge, Button, Field, Select, SpotlightCard, Switch, cn } from '../components/ui'
import {
  CheckMarkIcon,
  KeyboardDeckIcon,
  MotionEaseIcon,
  ResetArcIcon,
  SaveVaultIcon,
  ShieldCheckIcon,
  ThemeSwatchIcon,
  WindowLaunchIcon,
} from '../icons'
import type { RuntimeState, ThemeId } from '../types'

const themes: Array<{ id: ThemeId; name: string; colors: string[] }> = [
  { id: 'lavender', name: 'Sparkle Lavender', colors: ['#d9c7ff', '#9b7ae8', '#17131f'] },
  { id: 'amber', name: 'Cyber Amber', colors: ['#ffc76b', '#ef8f2f', '#21170c'] },
  { id: 'sapphire', name: 'Sapphire', colors: ['#88b8ff', '#4b7fe8', '#0e1727'] },
  { id: 'emerald', name: 'Emerald', colors: ['#75e5bc', '#2ba879', '#0d1e18'] },
  { id: 'rose', name: 'Rose', colors: ['#ffafc8', '#e65e8e', '#241119'] },
]

export function SettingsScreen({
  runtime,
  onChange,
  notify,
}: {
  runtime: RuntimeState
  onChange: (runtime: RuntimeState) => void
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [draft, setDraft] = useState(runtime)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(runtime), [runtime])

  const isDirty = useMemo(
    () =>
      draft.prefix !== runtime.prefix
      || draft.keyDelay !== runtime.keyDelay
      || draft.spinner !== runtime.spinner
      || draft.launchAtStartup !== runtime.launchAtStartup
      || draft.reducedMotion !== runtime.reducedMotion
      || draft.theme !== runtime.theme,
    [draft, runtime],
  )

  async function save() {
    setSaving(true)
    try {
      const saved = await api.saveRuntime(draft)
      onChange(saved)
      notify('Settings saved.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Settings could not be saved.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen settings-screen-shell">
      <div className={cn('settings-commit-bar', isDirty && 'settings-commit-bar-dirty')}>
        <div className="settings-commit-status">
          <Badge tone={isDirty ? 'warning' : 'success'}>
            {isDirty ? 'Unsaved changes' : <><CheckMarkIcon size={12} strokeWidth={1.85} aria-hidden="true" /> Synced</>}
          </Badge>
          <span>{isDirty ? 'Save to apply changes to the background engine.' : 'Changes apply immediately after saving.'}</span>
        </div>
        <div className="settings-actions">
          <Button
            variant="ghost"
            disabled={!isDirty}
            icon={<ResetArcIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
            onClick={() => setDraft(runtime)}
          >
            Reset changes
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!isDirty && !saving}
            icon={<SaveVaultIcon size={15} strokeWidth={1.85} aria-hidden="true" />}
            onClick={save}
          >
            Save settings
          </Button>
        </div>
      </div>

      <div className="settings-layout-reversed">
        <div className="settings-rail">
          <SpotlightCard className="theme-card">
            <div className="settings-card-heading">
              <span className="settings-heading-icon" aria-hidden="true"><ThemeSwatchIcon size={17} strokeWidth={1.85} /></span>
              <div><h2>Color theme</h2><p>Surfaces stay dark and calm; only the active accent shifts.</p></div>
            </div>
            <div className="theme-options">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option ${draft.theme === theme.id ? 'theme-option-active' : ''}`}
                  aria-pressed={draft.theme === theme.id}
                  onClick={() => setDraft({ ...draft, theme: theme.id })}
                >
                  <span className="theme-dots" aria-hidden="true">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <strong>{theme.name}</strong>
                  {draft.theme === theme.id ? <span>Selected</span> : null}
                </button>
              ))}
            </div>
          </SpotlightCard>

          <div className="assurance-strip">
            <ShieldCheckIcon size={17} strokeWidth={1.85} aria-hidden="true" />
            <p><strong>Zero telemetry:</strong> Preferences and diagnostics remain stored under your Windows profile.</p>
          </div>
        </div>

        <div className="settings-column">
          <SpotlightCard className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-heading-icon" aria-hidden="true"><KeyboardDeckIcon size={17} strokeWidth={1.85} /></span>
              <div><h2>Command behavior</h2><p>Control how inline triggers are detected and pasted.</p></div>
            </div>
            <div className="settings-form-grid">
              <Field label="Trigger prefix" hint={`Commands look like ${draft.prefix || '.'}fix and ${draft.prefix || '.'}bold.`}>
                <input value={draft.prefix} maxLength={4} spellCheck={false} autoComplete="off" onChange={(event) => setDraft({ ...draft, prefix: event.target.value })} />
              </Field>
              <Field label="Replacement delay" hint="Increase if clipboard paste lags in heavier legacy apps.">
                <div className="range-field">
                  <input type="range" min="30" max="500" step="10" value={draft.keyDelay} onChange={(event) => setDraft({ ...draft, keyDelay: Number(event.target.value) })} />
                  <output>{draft.keyDelay} ms</output>
                </div>
              </Field>
              <Field label="Processing indicator">
                <Select<RuntimeState['spinner']>
                  label="Processing indicator"
                  value={draft.spinner}
                  options={[
                    { value: 'animated', label: 'Animated spinner', detail: 'Show animated progress while AI runs' },
                    { value: 'static', label: 'Static message', detail: 'Show a calm status indicator without motion' },
                    { value: 'off', label: 'Hidden', detail: 'Replace text silently with no indicator' },
                  ]}
                  onChange={(spinner) => setDraft({ ...draft, spinner })}
                />
              </Field>
            </div>
          </SpotlightCard>

          <SpotlightCard className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-heading-icon" aria-hidden="true"><WindowLaunchIcon size={17} strokeWidth={1.85} /></span>
              <div><h2>Windows integration</h2><p>Startup registration and background tray lifecycle.</p></div>
            </div>
            <div className="setting-list">
              <div className="setting-row">
                <div><strong>Start at login</strong><span>Launch the background engine automatically for this Windows user.</span></div>
                <Switch checked={draft.launchAtStartup} onChange={(value) => setDraft({ ...draft, launchAtStartup: value })} label="Start at login" />
              </div>
              <div className="setting-row">
                <div><strong>Close dashboard to tray</strong><span>Release WebView memory while keeping triggers active in the tray.</span></div>
                <Switch checked disabled onChange={() => undefined} label="Close dashboard to tray (always enabled)" />
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-heading-icon" aria-hidden="true"><MotionEaseIcon size={17} strokeWidth={1.85} /></span>
              <div><h2>Accessibility</h2><p>SwiftSlate also honors the Windows OS reduced-motion preference.</p></div>
            </div>
            <div className="setting-list">
              <div className="setting-row">
                <div><strong>Reduce motion</strong><span>Disable spatial transitions in favor of instant calm state swaps.</span></div>
                <Switch checked={draft.reducedMotion} onChange={(value) => setDraft({ ...draft, reducedMotion: value })} label="Reduce motion" />
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  )
}
