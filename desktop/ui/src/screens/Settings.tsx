import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { CometDial } from '../components/CometDial'
import { HoldButton } from '../components/HoldButton'
import { THEME_BACKGROUNDS } from '../components/ThemeBackground'
import { WakeSlider } from '../components/WakeSlider'
import { Badge, Button, Field, Select, SpotlightCard, Switch, cn } from '../components/ui'
import {
  CheckMarkIcon,
  KeyboardDeckIcon,
  MotionEaseIcon,
  ResetArcIcon,
  SaveVaultIcon,
  ShieldCheckIcon,
  SparkleIcon,
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
  draft: controlledDraft,
  onDraftChange,
  backdropIntensity = 90,
  onBackdropIntensityChange,
  onChange,
  notify,
}: {
  runtime: RuntimeState
  draft?: RuntimeState
  onDraftChange?: (next: RuntimeState) => void
  backdropIntensity?: number
  onBackdropIntensityChange?: (next: number) => void
  onChange: (runtime: RuntimeState) => void
  notify: (message: string, tone?: 'success' | 'danger') => void
}) {
  const [innerDraft, setInnerDraft] = useState(runtime)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!controlledDraft) setInnerDraft(runtime)
  }, [controlledDraft, runtime])

  const draft = controlledDraft ?? innerDraft
  const updateDraft = (updater: RuntimeState | ((prev: RuntimeState) => RuntimeState)) => {
    const next = typeof updater === 'function' ? updater(draft) : updater
    if (!controlledDraft) setInnerDraft(next)
    onDraftChange?.(next)
  }

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
      updateDraft(saved)
      onChange(saved)
      notify('Settings saved.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Settings could not be saved.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function selectTheme(nextTheme: ThemeId) {
    if (draft.theme === nextTheme && runtime.theme === nextTheme) return
    const previousRuntime = runtime
    updateDraft((prev) => ({ ...prev, theme: nextTheme }))
    onChange({ ...runtime, theme: nextTheme })
    try {
      const saved = await api.saveRuntime({ theme: nextTheme })
      updateDraft((prev) => ({ ...prev, theme: saved.theme }))
      onChange(saved)
    } catch (error) {
      updateDraft((prev) => ({ ...prev, theme: previousRuntime.theme }))
      onChange(previousRuntime)
      notify(error instanceof Error ? error.message : 'Theme could not be saved.', 'danger')
    }
  }

  async function restoreFactoryDefaults() {
    setSaving(true)
    try {
      const defaults: Partial<RuntimeState> = {
        prefix: '.',
        keyDelay: 120,
        spinner: 'animated',
        theme: 'lavender',
        reducedMotion: false,
      }
      const saved = await api.saveRuntime(defaults)
      updateDraft(saved)
      onChange(saved)
      onBackdropIntensityChange?.(90)
      notify('Factory defaults restored.', 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Defaults could not be restored.', 'danger')
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
            onClick={() => updateDraft(runtime)}
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
              <div><h2>Color theme</h2><p>Each theme pairs a tuned accent palette with its own atmospheric backdrop.</p></div>
            </div>
            <div className="theme-options">
              {themes.map((theme) => {
                const bgMeta = THEME_BACKGROUNDS[theme.id]
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-option ${draft.theme === theme.id ? 'theme-option-active' : ''}`}
                    aria-pressed={draft.theme === theme.id}
                    onClick={() => void selectTheme(theme.id)}
                  >
                    <span className="theme-dots" aria-hidden="true">{theme.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                    <span className="theme-option-copy">
                      <strong>{theme.name}</strong>
                      {bgMeta ? <small>{bgMeta.label}</small> : null}
                    </span>
                    {draft.theme === theme.id ? <span className="theme-option-selected">Selected</span> : null}
                  </button>
                )
              })}
            </div>
          </SpotlightCard>

          <SpotlightCard className="glass-tuning-card">
            <div className="settings-card-heading">
              <span className="settings-heading-icon" aria-hidden="true"><SparkleIcon size={17} strokeWidth={1.85} /></span>
              <div><h2>Liquid glass &amp; backdrop</h2><p>Dial live GPU shader luminosity and refractive glass bevel glow.</p></div>
            </div>
            <div className="glass-dial-row">
              <CometDial
                value={backdropIntensity}
                min={20}
                max={100}
                step={5}
                unit="%"
                label="Backdrop and glass intensity"
                size={126}
                thickness={5}
                cometReach={165}
                cometWidth={10}
                accent="var(--accent)"
                ink="var(--text)"
                onChange={(next) => onBackdropIntensityChange?.(next)}
              />
              <div className="glass-dial-copy">
                <strong>Atmospheric refraction</strong>
                <p>Spin or use arrow keys to balance background vibrancy behind frosted panels.</p>
              </div>
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
                <input name="trigger-prefix" value={draft.prefix} maxLength={4} spellCheck={false} autoComplete="off" onChange={(event) => updateDraft({ ...draft, prefix: event.target.value })} />
              </Field>
              <div className="field">
                <span className="field-label">Replacement delay</span>
                <WakeSlider
                  value={draft.keyDelay}
                  onChange={(keyDelay) => updateDraft({ ...draft, keyDelay })}
                  min={30}
                  max={500}
                  step={10}
                  bars={28}
                  height={40}
                  restHeight={12}
                  gap={3}
                  fillColor="var(--accent)"
                  crestColor="#ffffff"
                  trackColor="rgba(255, 255, 255, 0.14)"
                  showValue
                  formatValue={(val) => `${val} ms`}
                  ariaLabel="Replacement delay"
                />
                <span className="field-hint">Increase if clipboard paste lags in heavier legacy apps.</span>
              </div>
              <Field label="Processing indicator">
                <Select<RuntimeState['spinner']>
                  label="Processing indicator"
                  value={draft.spinner}
                  options={[
                    { value: 'animated', label: 'Animated spinner', detail: 'Show animated progress while AI runs' },
                    { value: 'static', label: 'Static message', detail: 'Show a calm status indicator without motion' },
                    { value: 'off', label: 'Hidden', detail: 'Replace text silently with no indicator' },
                  ]}
                  onChange={(spinner) => updateDraft({ ...draft, spinner })}
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
                <Switch checked={draft.launchAtStartup} onChange={(value) => updateDraft({ ...draft, launchAtStartup: value })} label="Start at login" />
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
                <Switch checked={draft.reducedMotion} onChange={(value) => updateDraft({ ...draft, reducedMotion: value })} label="Reduce motion" />
              </div>
              <div className="setting-row">
                <div><strong>Restore factory defaults</strong><span>Press and hold to reset prefix, delay, indicator, theme, and motion preferences.</span></div>
                <HoldButton
                  size="sm"
                  radius={10}
                  holdTime={1100}
                  resetAfter={1200}
                  backgroundColor="var(--surface-2)"
                  fillColor="#d9485f"
                  textColor="var(--text-soft)"
                  fillTextColor="#ffffff"
                  disabled={saving}
                  icon={<ResetArcIcon size={14} strokeWidth={1.9} aria-hidden="true" />}
                  doneIcon={<CheckMarkIcon size={14} strokeWidth={2.1} aria-hidden="true" />}
                  doneLabel="Restored"
                  onHold={() => {
                    void restoreFactoryDefaults()
                  }}
                >
                  Hold to reset
                </HoldButton>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  )
}
