import { Accessibility, Keyboard, MonitorUp, Palette, RotateCcw, Save, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { RuntimeState, ThemeId } from '../types'
import { Button, Field, SpotlightCard, Switch } from '../components/ui'

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
    <div className="screen settings-screen">
      <div className="settings-column">
        <SpotlightCard className="settings-card">
          <div className="settings-card-heading"><span className="settings-heading-icon"><Keyboard size={18}/></span><div><h3>Command behavior</h3><p>Control how triggers are detected and replaced.</p></div></div>
          <div className="settings-form-grid">
            <Field label="Trigger prefix" hint={`Commands look like ${draft.prefix || '.'}fix and ${draft.prefix || '.'}bold.`}>
              <input value={draft.prefix} maxLength={4} onChange={(event) => setDraft({ ...draft, prefix: event.target.value })}/>
            </Field>
            <Field label="Replacement delay" hint="Increase this if paste operations are unreliable on an older PC.">
              <div className="range-field"><input type="range" min="30" max="500" step="10" value={draft.keyDelay} onChange={(event) => setDraft({ ...draft, keyDelay: Number(event.target.value) })}/><output>{draft.keyDelay} ms</output></div>
            </Field>
            <Field label="Processing indicator">
              <select value={draft.spinner} onChange={(event) => setDraft({ ...draft, spinner: event.target.value as RuntimeState['spinner'] })}>
                <option value="animated">Animated spinner</option>
                <option value="static">Static message</option>
                <option value="off">Hidden</option>
              </select>
            </Field>
          </div>
        </SpotlightCard>

        <SpotlightCard className="settings-card" delay={0.04}>
          <div className="settings-card-heading"><span className="settings-heading-icon"><MonitorUp size={18}/></span><div><h3>Windows integration</h3><p>Choose when SwiftSlate starts and how it behaves in the tray.</p></div></div>
          <div className="setting-list">
            <div className="setting-row"><div><strong>Start at login</strong><span>Launch the background engine for this Windows user.</span></div><Switch checked={draft.launchAtStartup} onChange={(value) => setDraft({ ...draft, launchAtStartup: value })} label="Start at login"/></div>
            <div className="setting-row"><div><strong>Close dashboard to tray</strong><span>Keep inline commands active after this window closes.</span></div><Switch checked disabled onChange={() => undefined} label="Close dashboard to tray (always enabled)"/></div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="settings-card" delay={0.08}>
          <div className="settings-card-heading"><span className="settings-heading-icon"><Accessibility size={18}/></span><div><h3>Accessibility</h3><p>SwiftSlate also follows the Windows reduced-motion setting.</p></div></div>
          <div className="setting-list">
            <div className="setting-row"><div><strong>Reduce motion</strong><span>Replace spring movement and ambient animation with simple fades.</span></div><Switch checked={draft.reducedMotion} onChange={(value) => setDraft({ ...draft, reducedMotion: value })} label="Reduce motion"/></div>
          </div>
        </SpotlightCard>
      </div>

      <aside className="settings-side">
        <SpotlightCard className="theme-card">
          <div className="settings-card-heading"><span className="settings-heading-icon"><Palette size={18}/></span><div><h3>Color theme</h3><p>Choose an accent. Surfaces stay dark and focused.</p></div></div>
          <div className="theme-options">
            {themes.map((theme) => (
              <button key={theme.id} type="button" className={`theme-option ${draft.theme === theme.id ? 'theme-option-active' : ''}`} onClick={() => setDraft({ ...draft, theme: theme.id })}>
                <span className="theme-dots">{theme.colors.map((color) => <i key={color} style={{ background: color }}/>)}</span><strong>{theme.name}</strong>{draft.theme === theme.id ? <span>Selected</span> : null}
              </button>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="privacy-mini-card" delay={0.06}>
          <Shield size={19}/><div><strong>No telemetry</strong><p>Settings and diagnostics remain on this device unless you copy them.</p></div>
        </SpotlightCard>

        <div className="settings-actions">
          <Button variant="ghost" icon={<RotateCcw size={15}/>} onClick={() => setDraft(runtime)}>Reset changes</Button>
          <Button variant="primary" loading={saving} icon={<Save size={16}/>} onClick={save}>Save settings</Button>
        </div>
      </aside>
    </div>
  )
}
