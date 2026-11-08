import { render, screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { api } from './api'
import App from './App'
import { ChromaGrid } from './components/ChromaGrid'
import { GlideSelect } from './components/GlideSelect'
import { HoldButton } from './components/HoldButton'
import { JellyRadio } from './components/JellyRadio'
import { RubberSegment } from './components/RubberSegment'
import { SlideCommit } from './components/SlideCommit'
import { SwipeRow } from './components/SwipeRow'
import { Select } from './components/ui'
import { GLYPH_CATALOG, pathSignature } from './icons'

describe('SwiftSlate dashboard', () => {
  it('has no automatically detectable accessibility violations', async () => {
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    const result = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(result.violations).toEqual([])
  })

  it('shows runtime status and navigates between screens without duplicated shortcut buttons', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('SwiftSlate is listening')).toBeInTheDocument()
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(mainNav).queryByRole('button', { name: 'Providers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add provider/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Switch or configure model/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open playground/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create command/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Typography foundry/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /View logs/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Pause|Resume)$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change color theme' })).not.toBeInTheDocument()
    const providerPod = screen.getByRole('button', { name: /Switch engine/i })
    await user.click(providerPod)
    expect(await screen.findByText('Choose where SwiftSlate thinks')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit active routing/i })).not.toBeInTheDocument()
    expect(providerPod).toHaveAttribute('aria-current', 'page')
  })

  it('opens provider configuration without exposing a saved key', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')
    const configureButtons = screen.getAllByRole('button', { name: 'Configure' })
    await user.click(configureButtons[0])
    expect(screen.getByRole('dialog', { name: /Configure Google Gemini/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••••••••••')).toHaveValue('')
  })

  it('closes dialogs with Escape and restores keyboard focus', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')
    const configure = screen.getAllByRole('button', { name: 'Configure' })[0]
    await user.click(configure)
    const dialog = screen.getByRole('dialog', { name: /Configure Google Gemini/ })
    expect(dialog).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(configure).toHaveFocus()
  })

  it('pauses and resumes inline commands solely via the Overview SlideCommit control', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    expect(screen.getByText('Engine active')).toBeInTheDocument()
    expect(screen.getByText('Listening globally')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Pause|Resume)$/i })).not.toBeInTheDocument()

    const pauseSlider = screen.getByRole('slider', { name: 'Slide to pause hook' })
    pauseSlider.focus()
    await user.keyboard('{End}')
    expect(await screen.findByText('SwiftSlate is paused')).toBeInTheDocument()
    expect(screen.getByText('Engine paused')).toBeInTheDocument()
    expect(screen.getByText('Triggers suspended')).toBeInTheDocument()

    const resumeSlider = await screen.findByRole('slider', { name: 'Slide to resume hook' })
    await waitFor(
      () => expect(resumeSlider.closest('.slide-commit')).toHaveAttribute('data-phase', 'idle'),
      { timeout: 2000 },
    )
    resumeSlider.focus()
    await user.keyboard('{End}')
    expect(await screen.findByText('SwiftSlate is listening')).toBeInTheDocument()
    expect(screen.getByText('Engine active')).toBeInTheDocument()
  })

  it('uses Windows-native chrome and passes axe across Commands, Styles, Settings, and Diagnostics', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Windows Ctrl K shortcut badge and no dead Notifications button
    expect(screen.getByText('Ctrl K')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument()

    // Commands screen: JellyRadio aria-checked filter state + axe
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByText('Your command library')
    const commandTypeGroup = screen.getByRole('radiogroup', { name: 'Command type filter' })
    const allFilter = within(commandTypeGroup).getByRole('radio', { name: 'All' })
    const aiFilter = within(commandTypeGroup).getByRole('radio', { name: 'AI' })
    expect(allFilter).toHaveAttribute('aria-checked', 'true')
    expect(aiFilter).toHaveAttribute('aria-checked', 'false')
    await user.click(aiFilter)
    expect(aiFilter).toHaveAttribute('aria-checked', 'true')
    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

    // Styles screen: axe
    await user.click(screen.getByRole('button', { name: 'Styles' }))
    await screen.findByText('Style text without a network request')
    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

    // Settings screen: Reset changes disabled until dirty + axe
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByText('Command behavior')
    expect(screen.getByRole('button', { name: 'Reset changes' })).toBeDisabled()
    const prefixInput = screen.getByLabelText(/Trigger prefix/i)
    await user.clear(prefixInput)
    await user.type(prefixInput, '/')
    expect(screen.getByRole('button', { name: 'Reset changes' })).toBeEnabled()
    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

    // Diagnostics screen: Windows debug.log console bar + axe
    await user.click(screen.getByRole('button', { name: 'Diagnostics' }))
    await screen.findByRole('button', { name: 'Run all checks' })
    expect(screen.getByText('debug.log')).toBeInTheDocument()
    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])
  })

  it('opens search with the keyboard shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('dialog', { name: 'Search SwiftSlate' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search screens and commands…')).toHaveFocus()
  })

  it('unrolls themed custom dropdowns in Playground and Settings with full accessibility', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: 'Playground' }))
    await screen.findByText('Command playground')
    expect(document.querySelectorAll('select')).toHaveLength(0)

    const commandTrigger = screen.getByRole('button', { name: 'Command' })
    await user.click(commandTrigger)
    const commandListbox = await screen.findByRole('listbox', { name: 'Command' })
    expect(commandListbox.closest('.app')).not.toBeNull()

    const openPlaygroundAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(openPlaygroundAxe.violations).toEqual([])

    await user.click(screen.getByRole('option', { name: /\.shorten/i }))
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Command' })).not.toBeInTheDocument())
    expect(commandTrigger).toHaveTextContent('.shorten')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByText('Command behavior')
    expect(document.querySelectorAll('select')).toHaveLength(0)
    const spinnerTrigger = screen.getByRole('button', { name: 'Processing indicator' })
    await user.click(spinnerTrigger)
    await screen.findByRole('listbox', { name: 'Processing indicator' })
    await user.click(screen.getByRole('option', { name: /Static message/i }))
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Processing indicator' })).not.toBeInTheDocument())
    expect(spinnerTrigger).toHaveTextContent('Static message')
  })

  it('unrolls the Provider model dropdown and closes it with Escape before the dialog', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')
    await user.click(screen.getAllByRole('button', { name: 'Configure' })[0])
    const dialog = screen.getByRole('dialog', { name: /Configure Google Gemini/ })
    expect(dialog).toBeInTheDocument()
    expect(document.querySelectorAll('select')).toHaveLength(0)

    const modelTrigger = screen.getByRole('button', { name: 'Model' })
    await user.click(modelTrigger)
    expect(await screen.findByRole('listbox', { name: 'Model' })).toBeInTheDocument()

    const openProviderAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(openProviderAxe.violations).toEqual([])

    // Escape closes the unrolled listbox without dismissing the parent modal
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Model' })).not.toBeInTheDocument())
    expect(dialog).toBeInTheDocument()

    // Reopen and choose another model with keyboard
    await user.click(modelTrigger)
    const reopenedListbox = await screen.findByRole('listbox', { name: 'Model' })
    await waitFor(() => expect(reopenedListbox).toHaveFocus())
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Model' })).not.toBeInTheDocument())
    expect(modelTrigger).toHaveTextContent('gemini-3.6-flash')
  })

  it('supports themed filtering and keyboard selection for large fetched model lists', async () => {
    const models = Array.from({ length: 12 }, (_, idx) => ({
      value: `provider/model-${idx + 1}`,
      label: `provider/model-${idx + 1}`,
      mono: true,
    }))
    function Harness() {
      const [model, setModel] = useState(models[0].value)
      return (
        <main className="app" data-theme="amber">
          <label htmlFor="model-select">Model</label>
          <Select id="model-select" label="Model" value={model} options={models} onChange={setModel} />
        </main>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Model' })
    await user.click(trigger)

    const filterInput = await screen.findByRole('combobox', { name: 'Filter Model' })
    await waitFor(() => expect(filterInput).toHaveFocus())

    const axeResult = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(axeResult.violations).toEqual([])

    await user.type(filterInput, 'model-11')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Model' })).not.toBeInTheDocument())
    expect(trigger).toHaveTextContent('provider/model-11')
  })

  it('renders official provider logos, custom SwiftSlate endpoint icon, and API key portal buttons', async () => {
    window.localStorage.setItem('swiftslate.onboarded', 'true')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      const user = userEvent.setup()
      const { container } = render(<App />)
      await screen.findByText('SwiftSlate is listening')

      await user.click(screen.getByRole('button', { name: /Switch engine/i }))
      await screen.findByText('Choose where SwiftSlate thinks')

      const logos = Array.from(container.querySelectorAll<HTMLImageElement>('.provider-card img.provider-logo-img'))
      expect(logos).toHaveLength(16)
      const uniqueSources = new Set(logos.map((img) => img.getAttribute('src')))
      expect(uniqueSources.size).toBe(16)

      expect(screen.getByRole('button', { name: 'Get Google Gemini API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Groq API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Cerebras API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get SambaNova API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get OpenAI API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get OpenRouter API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Cohere API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Hugging Face API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Mistral AI API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get DeepSeek API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get NVIDIA NIM API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get xAI (Grok) API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Qwen (Alibaba) API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Ollama' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get LM Studio' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Get Custom endpoint/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Get Cerebras API key' }))
      expect(openSpy).toHaveBeenCalledWith('https://cloud.cerebras.ai/', '_blank', 'noopener,noreferrer')

      // Filter bar: Free tier (14 of 16), Local (2 of 16), search, and reset
      const filterGroup = screen.getByRole('radiogroup', { name: 'Provider filter' })
      await user.click(within(filterGroup).getByRole('radio', { name: 'Free tier' }))
      expect(screen.getByText('14 of 16 providers')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'OpenAI' })).not.toBeInTheDocument()

      await user.click(within(filterGroup).getByRole('radio', { name: 'Local' }))
      expect(screen.getByText('2 of 16 providers')).toBeInTheDocument()

      await user.click(within(filterGroup).getByRole('radio', { name: 'All' }))
      const searchInput = screen.getByLabelText('Search providers')
      await user.type(searchInput, 'DeepSeek')
      expect(screen.getByText('2 of 16 providers')).toBeInTheDocument()

      const deepseekCard = screen.getByRole('heading', { name: 'DeepSeek' }).closest('.provider-card') as HTMLElement
      await user.click(within(deepseekCard).getByRole('button', { name: 'Configure' }))
      const dialog = await screen.findByRole('dialog', { name: /Configure DeepSeek/i })
      const modalKeyButton = within(dialog).getByRole('button', { name: 'Get DeepSeek API key' })
      await user.click(modalKeyButton)
      expect(openSpy).toHaveBeenLastCalledWith('https://platform.deepseek.com/api_keys', '_blank', 'noopener,noreferrer')

      const axeResult = await axe.run(document.body, {
        rules: { 'color-contrast': { enabled: false } },
      })
      expect(axeResult.violations).toEqual([])
    } finally {
      openSpy.mockRestore()
    }
  })

  it('supports skip link, Overview trigger handoff, and Playground Ctrl+Enter with output chaining', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skipLink).toHaveAttribute('href', '#main-content')

    await user.click(screen.getByRole('button', { name: '.shorten' }))
    expect(await screen.findByRole('heading', { name: 'Command playground' })).toBeInTheDocument()
    expect(screen.getByLabelText('Command')).toHaveTextContent('.shorten')

    const inputArea = screen.getByLabelText('Source draft') as HTMLTextAreaElement
    inputArea.focus()
    await user.keyboard('{Control>}{Enter}{/Control}')

    const useAsInputButton = await screen.findByRole('button', { name: 'Use as input' })
    expect(useAsInputButton).toBeInTheDocument()

    const axeResult = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(axeResult.violations).toEqual([])

    await user.click(useAsInputButton)
    expect(inputArea.value).not.toContain('because the current time')
  })

  it('toggles API key visibility with SecretInput and renders danger alerts on failed provider tests', async () => {
    const user = userEvent.setup()
    const testSpy = vi.spyOn(api, 'testProvider').mockRejectedValueOnce(new Error('401 Invalid API key'))
    try {
      render(<App />)
      await screen.findByText('SwiftSlate is listening')
      await user.click(screen.getByRole('button', { name: /Switch engine/i }))
      await screen.findByText('Choose where SwiftSlate thinks')

      const deepseekCard = screen.getByRole('heading', { name: 'DeepSeek' }).closest('.provider-card') as HTMLElement
      await user.click(within(deepseekCard).getByRole('button', { name: 'Configure' }))
      const dialog = await screen.findByRole('dialog', { name: /Configure DeepSeek/i })

      const keyInput = within(dialog).getByLabelText('API key') as HTMLInputElement
      expect(keyInput.type).toBe('password')
      await user.type(keyInput, 'sk-test-secret')

      const revealBtn = within(dialog).getByRole('button', { name: 'Show API key' })
      expect(revealBtn).toHaveAttribute('aria-pressed', 'false')
      await user.click(revealBtn)
      expect(keyInput.type).toBe('text')

      const hideBtn = within(dialog).getByRole('button', { name: 'Hide API key' })
      expect(hideBtn).toHaveAttribute('aria-pressed', 'true')
      await user.click(hideBtn)
      expect(keyInput.type).toBe('password')

      await user.click(within(dialog).getByRole('button', { name: 'Test provider' }))
      const alertBanner = await within(dialog).findByRole('alert')
      expect(alertBanner).toHaveTextContent('401 Invalid API key')
      expect(alertBanner).toHaveClass('inline-message-danger')
    } finally {
      testSpy.mockRestore()
    }
  })

  it('supports provider search and Enter navigation inside the Ctrl+K command palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Search SwiftSlate' })
    const searchInput = within(dialog).getByPlaceholderText('Search screens and commands…')
    await user.type(searchInput, 'Cerebras{Enter}')

    expect(await screen.findByText('Choose where SwiftSlate thinks')).toBeInTheDocument()
  })

  it('maintains isomorphic SVG morph paths across all bespoke glyphs and morphs on tab/control interactions', async () => {
    for (const [name, specs] of Object.entries(GLYPH_CATALOG)) {
      expect(specs.length, name).toBeGreaterThan(0)
      for (const spec of specs) {
        expect(pathSignature(spec.rest), name).toBe(pathSignature(spec.morph))
      }
    }

    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Active Overview tab starts morphed; inactive Playground tab morphs on pointerenter and resets on pointerleave
    const overviewNav = screen.getByRole('button', { name: 'Overview' })
    const playgroundNav = screen.getByRole('button', { name: 'Playground' })
    const overviewSvg = overviewNav.querySelector('[data-slate-glyph="overview"]') as SVGElement
    const playgroundSvg = playgroundNav.querySelector('[data-slate-glyph="playground"]') as SVGElement

    expect(overviewSvg).toHaveAttribute('data-morphed', 'true')
    expect(playgroundSvg).toHaveAttribute('data-morphed', 'false')

    fireEvent.pointerEnter(playgroundNav)
    expect(playgroundSvg).toHaveAttribute('data-morphed', 'true')
    fireEvent.pointerLeave(playgroundNav)
    expect(playgroundSvg).toHaveAttribute('data-morphed', 'false')

    // Collapsing and expanding the rail morphs SidebarToggleIcon (false -> true)
    const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(collapseBtn.querySelector('[data-slate-glyph="sidebarToggle"]')).toHaveAttribute('data-morphed', 'false')
    await user.click(collapseBtn)
    const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(expandBtn.querySelector('[data-slate-glyph="sidebarToggle"]')).toHaveAttribute('data-morphed', 'true')
  })

  it('integrates ChromaGrid spotlight across Providers and Styles and supports photo/link cards', async () => {
    const user = userEvent.setup()
    const { container, unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')

    const providerGrid = container.querySelector('.chroma-grid.provider-grid') as HTMLElement
    expect(providerGrid).not.toBeNull()
    expect(providerGrid).toHaveAttribute('data-reveal', 'spotlight')
    const chromaCards = providerGrid.querySelectorAll('.chroma-card.provider-card')
    expect(chromaCards).toHaveLength(16)

    // Distinct brand chroma accents are applied per provider card
    const accents = new Set(Array.from(chromaCards).map((card) => (card as HTMLElement).style.getPropertyValue('--chroma-accent')))
    expect(accents.size).toBeGreaterThanOrEqual(12)

    fireEvent.pointerMove(providerGrid, { clientX: 160, clientY: 120 })
    await waitFor(() => {
      expect(Number(providerGrid.style.getPropertyValue('--chroma-power'))).toBeGreaterThan(0)
    })

    await user.click(screen.getByRole('button', { name: 'Styles' }))
    await screen.findByText('Style text without a network request')
    const specimenGrid = container.querySelector('.chroma-grid.specimen-grid') as HTMLElement
    expect(specimenGrid).not.toBeNull()
    expect(specimenGrid.querySelectorAll('.chroma-card.specimen-card')).toHaveLength(6)

    unmount()

    // Standalone React Bits ChromaGrid API verification (image + link + frame)
    const { container: mediaContainer } = render(
      <ChromaGrid
        frame
        columns={2}
        radius={240}
        items={[
          { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', title: 'Canola Field', subtitle: 'Midday', accent: '#ffd23f' },
          { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', title: 'The Pier', subtitle: 'Clear sky', accent: '#3fb8ff', url: 'https://example.com' },
        ]}
      />,
    )
    expect(mediaContainer.querySelector('.chroma-grid.has-frame')).not.toBeNull()
    expect(mediaContainer.querySelectorAll('img.chroma-mono')).toHaveLength(2)
    expect(mediaContainer.querySelectorAll('img.chroma-color')).toHaveLength(2)
    expect(mediaContainer.querySelector('a.chroma-card')).toHaveAttribute('href', 'https://example.com')
  })

  it('integrates GlideSelect with gliding pill physics, tags, keyboard typeahead, and axe compliance', async () => {
    const user = userEvent.setup()
    const { container, unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')

    const sortProviders = screen.getByRole('combobox', { name: 'Sort providers' })
    expect(sortProviders).toHaveTextContent('Recommended')

    fireEvent.pointerDown(sortProviders, { button: 0 })
    const listbox = await screen.findByRole('listbox', { name: 'Sort providers' })
    expect(within(listbox).getByText('Offline')).toBeInTheDocument()

    // Hovering option index 3 ('Local first') glides the pill vertically
    const localOption = within(listbox).getByRole('option', { name: /Local first/i })
    fireEvent.pointerOver(localOption)
    const pill = listbox.querySelector('.glide-select__pill') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.style.transform).toContain('translateY(')

    const openGlideAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(openGlideAxe.violations).toEqual([])

    await user.click(localOption)
    expect(sortProviders).toHaveTextContent('Local first')
    const firstCardHeading = container.querySelector('.provider-card h3')
    expect(firstCardHeading?.textContent).toMatch(/Ollama|LM Studio/)

    unmount()

    // Standalone React Bits GlideSelect uncontrolled + keyboard typeahead verification
    const onPick = vi.fn()
    render(
      <main className="app">
        <GlideSelect
          ariaLabel="Export format"
          defaultValue="png"
          onChange={onPick}
          showTags
          options={[
            { value: 'png', label: 'PNG', tag: 'Lossless' },
            { value: 'webp', label: 'WebP', tag: 'Modern' },
            { value: 'svg', label: 'SVG', tag: 'Vector' },
          ]}
        />
      </main>,
    )
    const formatTrigger = screen.getByRole('combobox', { name: 'Export format' })
    formatTrigger.focus()
    await user.keyboard('{Enter}w{Enter}')
    expect(onPick).toHaveBeenCalledWith('webp', expect.objectContaining({ value: 'webp', tag: 'Modern' }))
    expect(formatTrigger).toHaveTextContent('WebP')
  })

  it('integrates SwipeRow across Commands and Overview with pointer drag, full-swipe commit, keyboard actions, and axe compliance', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Overview Recent executions rows are wrapped in SwipeRow
    const overviewRow = screen.getByRole('group', { name: /Execution \.fix/i })
    expect(overviewRow).toHaveClass('swipe-row', 'activity-swipe-row')

    // Navigate to Commands screen and verify SwipeRow drawer + Switch click preservation + axe compliance
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByText('Your command library')

    const fixRow = screen.getByRole('group', { name: 'Command .fix' })
    expect(fixRow).toHaveClass('swipe-row', 'command-swipe-row')
    expect(fixRow).not.toHaveAttribute('data-open')

    // Inner Switch clicks are never hijacked by SwipeRow surface pointer listener
    const fixSwitch = within(fixRow).getByRole('switch', { name: /Disable \.fix/i })
    await user.click(fixSwitch)
    expect(within(fixRow).getByRole('switch', { name: /Enable \.fix/i })).toBeInTheDocument()

    // Keyboard toggle opens action rail, passes axe-core while open, and Delete commits removal
    const toggleBtn = within(fixRow).getByRole('button', { name: /Command \.fix: 3 actions/i })
    toggleBtn.focus()
    await user.keyboard('{ArrowLeft}')
    expect(fixRow).toHaveAttribute('data-open')

    const openRowAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(openRowAxe.violations).toEqual([])

    // Secondary drawer action ('Edit') opens edit modal and closes the drawer
    await user.click(within(fixRow).getByRole('button', { name: 'Edit' }))
    const editDialog = await screen.findByRole('dialog', { name: 'Edit command' })
    await user.click(within(editDialog).getByRole('button', { name: 'Cancel' }))

    // Re-open with keyboard and commit primary Delete via Delete key
    toggleBtn.focus()
    await user.keyboard('{ArrowLeft}{Delete}')
    expect(fixRow).toHaveAttribute('data-phase', 'collapsing')
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Command .fix' })).not.toBeInTheDocument()
    })

    unmount()

    // Standalone React Bits SwipeRow pointer drag, snap-open, tap-to-close, right direction, and full-swipe commit
    const onCommit = vi.fn()
    const onAction = vi.fn()
    const onOpenChange = vi.fn()
    const { container } = render(
      <main className="app">
        <SwipeRow
          label="Draft note"
          collapseMs={40}
          actionWidth={80}
          onCommit={onCommit}
          onAction={onAction}
          onOpenChange={onOpenChange}
          actions={[
            { id: 'delete', label: 'Delete' },
            { id: 'pin', label: 'Pin', color: '#eab308' },
          ]}
        >
          <span>Quarterly roadmap</span>
        </SwipeRow>
        <SwipeRow direction="right" label="Right swipe item" disabled>
          <span>Locked item</span>
        </SwipeRow>
      </main>,
    )

    const draftRow = screen.getByRole('group', { name: 'Draft note' })
    const surface = container.querySelector('.swipe-row__surface') as HTMLElement

    // Drag left by 130px (> HYST 10 and > D/2 = 80, < commitPoint 216) -> snaps open
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 300, clientY: 20 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 280, clientY: 20 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 160, clientY: 20 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 160, clientY: 20 })

    expect(draftRow).toHaveAttribute('data-open')
    expect(onOpenChange).toHaveBeenCalledWith(true)

    // Tapping surface without dragging closes the open drawer
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 20 })
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 200, clientY: 20 })
    expect(draftRow).not.toHaveAttribute('data-open')
    expect(onOpenChange).toHaveBeenCalledWith(false)

    // Full-swipe past commitPoint (w=360, commitAt=0.6 => 216px exposed) commits primary action
    fireEvent.pointerDown(surface, { pointerId: 3, button: 0, clientX: 350, clientY: 20 })
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 330, clientY: 20 })
    fireEvent.pointerMove(window, { pointerId: 3, clientX: 10, clientY: 20 })
    fireEvent.pointerUp(window, { pointerId: 3, clientX: 10, clientY: 20 })

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ id: 'delete', label: 'Delete' }))
    })

    const lockedRow = screen.getByRole('group', { name: 'Right swipe item' })
    expect(lockedRow).toHaveAttribute('data-direction', 'right')
    expect(lockedRow).toHaveAttribute('data-disabled')
  })

  it('integrates JellyRadio across Providers, Commands, and Diagnostics with spring transforms, roving keyboard navigation, and axe compliance', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Navigate to Diagnostics and test Log level filter JellyRadio + axe
    await user.click(screen.getByRole('button', { name: 'Diagnostics' }))
    await screen.findByRole('button', { name: 'Run all checks' })

    const logFilterGroup = screen.getByRole('radiogroup', { name: 'Log level filter' })
    expect(logFilterGroup).toHaveClass('jelly-radio')

    const allChip = within(logFilterGroup).getByRole('radio', { name: 'All' })
    const errorChip = within(logFilterGroup).getByRole('radio', { name: 'Error' })
    expect(allChip).toHaveAttribute('aria-checked', 'true')
    expect(allChip).toHaveAttribute('tabindex', '0')
    expect(errorChip).toHaveAttribute('tabindex', '-1')

    // Active chip swells (scale > 1) while unchosen neighbors shrink and barge aside
    expect(allChip.style.transform).toContain('scale(1.13')
    expect(errorChip.style.transform).toContain('scale(0.96')

    await user.click(errorChip)
    expect(errorChip).toHaveAttribute('aria-checked', 'true')
    expect(errorChip).toHaveAttribute('tabindex', '0')
    expect(allChip).toHaveAttribute('tabindex', '-1')

    const diagAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(diagAxe.violations).toEqual([])

    unmount()

    // Standalone React Bits JellyRadio: string items + disabled item skipping + ArrowRight/Home/End
    const onPick = vi.fn()
    render(
      <main className="app">
        <JellyRadio defaultValue="Medium" onChange={onPick} ariaLabel="Intensity" />
        <JellyRadio
          ariaLabel="View mode"
          defaultValue="list"
          items={[
            { value: 'list', label: 'List' },
            { value: 'map', label: 'Map', disabled: true },
            { value: 'grid', label: 'Grid' },
          ]}
        />
      </main>,
    )

    const intensityGroup = screen.getByRole('radiogroup', { name: 'Intensity' })
    const mediumRadio = within(intensityGroup).getByRole('radio', { name: 'Medium' })
    expect(mediumRadio).toHaveAttribute('aria-checked', 'true')
    expect(mediumRadio.style.transform).toContain('scale(1.2, 1.2)')

    mediumRadio.focus()
    await user.keyboard('{ArrowRight}')
    expect(onPick).toHaveBeenCalledWith('High', 3)
    expect(within(intensityGroup).getByRole('radio', { name: 'High' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(onPick).toHaveBeenLastCalledWith('Off', 0)

    // Disabled item ('Map') is skipped by keyboard arrow navigation
    const viewGroup = screen.getByRole('radiogroup', { name: 'View mode' })
    const listRadio = within(viewGroup).getByRole('radio', { name: 'List' })
    expect(within(viewGroup).getByRole('radio', { name: 'Map' })).toBeDisabled()
    listRadio.focus()
    await user.keyboard('{ArrowRight}')
    expect(within(viewGroup).getByRole('radio', { name: 'Grid' })).toHaveAttribute('aria-checked', 'true')

    const standaloneAxe = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(standaloneAxe.violations).toEqual([])
  })

  it('integrates RubberSegment across Playground, Styles, and Commands modal with rubber drag, clipPath thumb, and axe compliance', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // 1. Playground Output view mode (Result vs Compare)
    await user.click(screen.getByRole('button', { name: 'Playground' }))
    await screen.findByText('Command playground')
    await user.click(screen.getByRole('button', { name: 'Run command' }))
    await screen.findByText('Ready')

    const outputModeGroup = screen.getByRole('radiogroup', { name: 'Output view mode' })
    expect(outputModeGroup).toHaveClass('rubber-segment')
    const compareRadio = within(outputModeGroup).getByRole('radio', { name: 'Compare' })
    await user.click(compareRadio)
    expect(compareRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/Source ·/i)).toBeInTheDocument()
    expect(screen.getByText(/Replaced ·/i)).toBeInTheDocument()

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

    // 2. Styles foundry stage selector (equalSlots={false})
    await user.click(screen.getByRole('button', { name: 'Styles' }))
    await screen.findByText('Style text without a network request')
    const styleRubber = screen.getByRole('radiogroup', { name: 'Active Unicode style' })
    expect(styleRubber).not.toHaveAttribute('data-equal')
    const bubbleRadio = within(styleRubber).getByRole('radio', { name: 'Bubble' })
    await user.click(bubbleRadio)
    expect(bubbleRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('.bubble', { selector: '.badge' })).toBeInTheDocument()

    // 3. Commands New command modal Command type RubberSegment + axe
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByText('Your command library')
    await user.click(screen.getByRole('button', { name: 'New command' }))
    const createDialog = await screen.findByRole('dialog', { name: 'Create command' })
    const cmdTypeGroup = within(createDialog).getByRole('radiogroup', { name: 'Command type' })
    expect(cmdTypeGroup).toHaveAttribute('data-equal')
    await user.click(within(cmdTypeGroup).getByRole('radio', { name: 'Text snippet' }))
    expect(within(createDialog).getByText('Replacement text')).toBeInTheDocument()

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])
    await user.click(within(createDialog).getByRole('button', { name: 'Cancel' }))

    unmount()

    // 4. Standalone React Bits RubberSegment: thumb drag across slots, keyboard navigation, and disabled prop
    const onPick = vi.fn()
    const { container } = render(
      <main className="app">
        <RubberSegment
          aria-label="Timeframe"
          items={['Day', 'Week', 'Month', 'Year']}
          defaultValue="Day"
          onChange={onPick}
          inset={3}
        />
        <RubberSegment aria-label="Disabled segment" items={['One', 'Two']} disabled />
      </main>,
    )

    const timeframe = screen.getByRole('radiogroup', { name: 'Timeframe' })
    const thumb = container.querySelector('.rubber-segment__thumb') as HTMLElement
    expect(thumb.style.clipPath).toContain('inset(0')

    const dayBtn = within(timeframe).getByRole('radio', { name: 'Day' })
    // Grab thumb on slot 0 (fallback slot width 44px -> 0..44, inset 3 => clientX=20 -> localX=17) and drag to slot 2 ('Month', midpoint 110)
    fireEvent.pointerDown(dayBtn, { pointerId: 1, button: 0, clientX: 20, timeStamp: 10 })
    fireEvent.pointerMove(timeframe, { pointerId: 1, clientX: 35, timeStamp: 30 })
    expect(timeframe).toHaveAttribute('data-held')
    fireEvent.pointerMove(timeframe, { pointerId: 1, clientX: 115, timeStamp: 150 })
    fireEvent.pointerUp(timeframe, { pointerId: 1, clientX: 115, timeStamp: 170 })

    expect(timeframe).not.toHaveAttribute('data-held')
    expect(onPick).toHaveBeenCalledWith('Month', 2)
    expect(within(timeframe).getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'true')

    // Keyboard End -> Year
    const monthBtn = within(timeframe).getByRole('radio', { name: 'Month' })
    monthBtn.focus()
    await user.keyboard('{End}')
    expect(onPick).toHaveBeenLastCalledWith('Year', 3)

    expect(screen.getByRole('radiogroup', { name: 'Disabled segment' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('integrates HoldButton across Commands delete modal and Settings factory defaults with tap abort, hold completion, and axe compliance', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // 1. Settings screen Hold to reset button + axe
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByText('Command behavior')
    const resetHoldBtn = screen.getByRole('button', { name: 'Hold to reset' })
    expect(resetHoldBtn).toHaveClass('hold-button')
    expect(resetHoldBtn).toHaveAttribute('data-phase', 'idle')

    // 2. Commands Delete command? modal HoldButton + short tap does NOT delete
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByText('Your command library')
    await user.click(screen.getByRole('button', { name: 'Delete .fix' }))
    const deleteDialog = await screen.findByRole('dialog', { name: 'Delete command?' })
    const holdDeleteBtn = within(deleteDialog).getByRole('button', { name: 'Hold to delete' })
    expect(holdDeleteBtn).toHaveClass('hold-button')

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

    // Quick pointer tap (< 250ms) aborts without deleting .fix
    fireEvent.pointerDown(holdDeleteBtn, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    expect(holdDeleteBtn).toHaveAttribute('data-phase', 'holding')
    fireEvent.pointerUp(holdDeleteBtn, { pointerId: 1, clientX: 10, clientY: 10 })
    expect(holdDeleteBtn).toHaveAttribute('data-phase', 'idle')
    expect(screen.getByRole('dialog', { name: 'Delete command?' })).toBeInTheDocument()
    await user.click(within(deleteDialog).getByRole('button', { name: 'Cancel' }))

    unmount()

    // 3. Standalone React Bits HoldButton: early tap callback + full hold completion + auto-reset
    const onHold = vi.fn()
    const onTap = vi.fn()
    render(
      <main className="app">
        <HoldButton
          holdTime={70}
          releaseTime={30}
          resetAfter={80}
          fillDirection="up"
          doneLabel="Purged"
          onHold={onHold}
          onTap={onTap}
        >
          Hold to purge
        </HoldButton>
      </main>,
    )

    const purgeBtn = screen.getByRole('button', { name: 'Hold to purge' })
    expect(purgeBtn).toHaveAttribute('data-direction', 'up')

    fireEvent.pointerDown(purgeBtn, { pointerId: 2, button: 0, clientX: 5, clientY: 5 })
    fireEvent.pointerUp(purgeBtn, { pointerId: 2, clientX: 5, clientY: 5 })
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onHold).not.toHaveBeenCalled()

    // Hold past holdTime (70ms) -> completes and transitions to done -> resets back to idle
    fireEvent.pointerDown(purgeBtn, { pointerId: 3, button: 0, clientX: 5, clientY: 5 })
    await waitFor(() => {
      expect(onHold).toHaveBeenCalledTimes(1)
    })
    fireEvent.pointerUp(purgeBtn, { pointerId: 3, clientX: 5, clientY: 5 })
    await waitFor(() => {
      expect(purgeBtn).toHaveAttribute('data-phase', 'idle')
    })

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])
  })

  it('integrates SlideCommit across Overview engine stage, Providers activation modal, and async promise pending/done/error states', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // 1. Overview hero SlideCommit toggles global keyboard hook via keyboard End
    const overviewSlider = screen.getByRole('slider', { name: 'Slide to pause hook' })
    expect(overviewSlider).toHaveAttribute('aria-valuenow', '0')
    overviewSlider.focus()
    await user.keyboard('{End}')
    expect(await screen.findByText('SwiftSlate is paused')).toBeInTheDocument()

    // 2. Providers Configure DeepSeek modal renders Slide to activate
    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')
    const deepseekCard = screen.getByRole('heading', { name: 'DeepSeek' }).closest('.provider-card') as HTMLElement
    await user.click(within(deepseekCard).getByRole('button', { name: 'Configure' }))
    const providerDialog = await screen.findByRole('dialog', { name: /Configure DeepSeek/i })
    const activateSlider = within(providerDialog).getByRole('slider', { name: 'Slide to activate' })
    expect(activateSlider).toBeInTheDocument()

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])
    await user.click(within(providerDialog).getByRole('button', { name: 'Cancel' }))

    unmount()

    // 3. Standalone React Bits SlideCommit: pointer drag to end + async Promise resolve & reject
    const onDone = vi.fn()
    const onError = vi.fn()
    let shouldFail = false
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((res, rej) => {
          setTimeout(() => (shouldFail ? rej(new Error('Declined')) : res()), 20)
        }),
    )

    const { container } = render(
      <main className="app">
        <SlideCommit
          label="Slide to deploy"
          doneLabel="Deployed"
          errorLabel="Deploy failed"
          width={280}
          height={56}
          holdMs={120}
          onConfirm={onConfirm}
          onDone={onDone}
          onError={onError}
        />
      </main>,
    )

    const root = container.querySelector('.slide-commit') as HTMLElement
    const track = container.querySelector('.slide-commit__track') as HTMLElement
    const slider = screen.getByRole('slider', { name: 'Slide to deploy' })

    // Drag handle all the way right (TRAVEL = 280 - 8 - 48 = 224)
    fireEvent.pointerDown(track, { pointerId: 10, button: 0, clientX: 10, timeStamp: 10 })
    fireEvent.pointerMove(window, { pointerId: 10, clientX: 10, timeStamp: 20 })
    fireEvent.pointerMove(window, { pointerId: 10, clientX: 250, timeStamp: 60 })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    fireEvent.pointerUp(window, { pointerId: 10, clientX: 250, timeStamp: 80 })

    expect(root).toHaveAttribute('data-phase', 'pending')
    expect(slider).toHaveAttribute('aria-busy', 'true')

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
      expect(root).toHaveAttribute('data-phase', 'done')
    })

    // Wait for holdMs settle back to idle, then test promise rejection -> error phase
    await waitFor(() => {
      expect(root).toHaveAttribute('data-phase', 'idle')
    })

    shouldFail = true
    slider.focus()
    await user.keyboard('{End}')
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
      expect(root).toHaveAttribute('data-phase', 'error')
    })

    expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])
  })

  it('assigns dedicated backgrounds across all 5 themes (Lavender -> AeroShards, Amber -> Radar, Sapphire -> Lightfall, Rose -> LightPillar, Emerald -> Ballpit) with clean switching', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Overview' })

    const stage = container.querySelector('.theme-background') as HTMLElement
    expect(stage).not.toBeNull()
    expect(stage).toHaveAttribute('data-theme-background', 'lavender')
    expect(stage).toHaveAttribute('data-background-id', 'aero-shards')
    expect(stage.querySelector('.aero-shards canvas.aero-shards-canvas')).not.toBeNull()
    expect(stage.querySelector('.radar-container')).toBeNull()
    expect(stage.querySelector('.lightfall-container')).toBeNull()
    expect(stage.querySelector('.light-pillar-container')).toBeNull()
    expect(stage.querySelector('.ballpit-container')).toBeNull()

    await waitFor(() => {
      expect(stage).toHaveAttribute('data-gpu-fallback', 'true')
    })

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByRole('heading', { name: 'Color theme' })
    expect(screen.getByText('Aero Shards')).toBeInTheDocument()
    expect(screen.getByText('Radar')).toBeInTheDocument()
    expect(screen.getByText('Lightfall')).toBeInTheDocument()
    expect(screen.getByText('Light Pillar')).toBeInTheDocument()
    expect(screen.getByText('Ballpit')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Sapphire/i }))
    expect(stage).toHaveAttribute('data-theme-background', 'sapphire')
    expect(stage).toHaveAttribute('data-background-id', 'lightfall')
    expect(stage.querySelector('.aero-shards')).toBeNull()
    expect(stage.querySelector('.lightfall-container canvas.lightfall-canvas')).not.toBeNull()
    expect(stage.querySelector('.light-pillar-container')).toBeNull()
    expect(stage.querySelector('.ballpit-container')).toBeNull()
    expect((await axe.run(container)).violations).toEqual([])

    await user.click(screen.getByRole('button', { name: /Rose/i }))
    expect(stage).toHaveAttribute('data-theme-background', 'rose')
    expect(stage).toHaveAttribute('data-background-id', 'light-pillar')
    expect(stage.querySelector('.aero-shards')).toBeNull()
    expect(stage.querySelector('.lightfall-container')).toBeNull()
    expect(stage.querySelector('.light-pillar-container canvas.light-pillar-canvas')).not.toBeNull()
    expect(stage.querySelector('.ballpit-container')).toBeNull()
    expect((await axe.run(container)).violations).toEqual([])

    await user.click(screen.getByRole('button', { name: /Emerald/i }))
    expect(stage).toHaveAttribute('data-theme-background', 'emerald')
    expect(stage).toHaveAttribute('data-background-id', 'ballpit')
    expect(stage.querySelector('.light-pillar-container')).toBeNull()
    expect(stage.querySelector('.ballpit-container canvas.ballpit-canvas')).not.toBeNull()
    expect((await axe.run(container)).violations).toEqual([])

    await user.click(screen.getByRole('button', { name: /Cyber Amber/i }))
    expect(stage).toHaveAttribute('data-theme-background', 'amber')
    expect(stage).toHaveAttribute('data-background-id', 'radar')
    expect(stage.querySelector('.aero-shards')).toBeNull()
    expect(stage.querySelector('.lightfall-container')).toBeNull()
    expect(stage.querySelector('.light-pillar-container')).toBeNull()
    expect(stage.querySelector('.ballpit-container')).toBeNull()
    expect(stage.querySelector('.radar-container canvas.radar-canvas')).not.toBeNull()
    expect((await axe.run(container)).violations).toEqual([])

    await user.click(screen.getByRole('button', { name: /Sparkle Lavender/i }))
    expect(stage).toHaveAttribute('data-theme-background', 'lavender')
    expect(stage).toHaveAttribute('data-background-id', 'aero-shards')
    expect(stage.querySelector('.radar-container')).toBeNull()
    expect(stage.querySelector('.aero-shards canvas.aero-shards-canvas')).not.toBeNull()
  })

  it('renders liquid-glass surfaces and hides/restores panels via button and Escape to view the background', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    const appRoot = container.querySelector('.app') as HTMLElement
    expect(container.querySelector('canvas.liquid-glass-canvas')).not.toBeNull()
    expect(container.querySelector('.sidebar[data-glass]')).not.toBeNull()
    expect(container.querySelector('.topbar[data-glass]')).not.toBeNull()
    expect(container.querySelectorAll('.glass-card[data-glass][data-glass-hot]').length).toBeGreaterThanOrEqual(3)

    const hideBtn = screen.getByRole('button', { name: 'Hide panels to view background' })
    await user.click(hideBtn)

    expect(appRoot).toHaveAttribute('data-panels-hidden', 'true')
    const showBtn = await screen.findByRole('button', { name: 'Show panels' })
    expect(showBtn).toHaveAttribute('data-glass')
    expect((await axe.run(container)).violations).toEqual([])

    await user.keyboard('{Escape}')
    await waitFor(() => expect(appRoot).not.toHaveAttribute('data-panels-hidden'))
    expect(screen.queryByRole('button', { name: 'Show panels' })).toBeNull()

    // Also verify clicking the floating Show panels pill directly restores panels
    await user.click(screen.getByRole('button', { name: 'Hide panels to view background' }))
    expect(appRoot).toHaveAttribute('data-panels-hidden', 'true')
    await user.click(await screen.findByRole('button', { name: 'Show panels' }))
    await waitFor(() => expect(appRoot).not.toHaveAttribute('data-panels-hidden'))
  })

  it('integrates WakeSlider, CometDial, SquishSwitch, and StatusMark with keyboard, pointer, and axe compliance', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Overview Recent executions renders StatusMark in done state
    expect(container.querySelector('.activity-row .status-mark[data-status="done"]')).not.toBeNull()

    // Playground StatusMark transitions from pending ("Idle") to done ("Ready")
    await user.click(screen.getByRole('button', { name: 'Playground' }))
    expect(await screen.findByText('Idle')).toBeInTheDocument()
    expect(container.querySelector('.result-pane .status-mark[data-status="pending"]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Run command' }))
    expect(await screen.findByText('Ready')).toBeInTheDocument()
    expect(container.querySelector('.result-pane .status-mark[data-status="done"]')).not.toBeNull()

    // Diagnostics StatusMark checklist + axe compliance
    await user.click(screen.getByRole('button', { name: 'Diagnostics' }))
    await screen.findByText('Health checklist')
    expect(container.querySelectorAll('.diagnostic-row .status-mark[data-status="done"]').length).toBeGreaterThanOrEqual(4)
    await user.click(screen.getByRole('button', { name: 'Run all checks' }))
    await screen.findByText('Diagnostics completed.')
    expect((await axe.run(container)).violations).toEqual([])

    // Settings: WakeSlider (Replacement delay), CometDial (Backdrop & glass intensity), and SquishSwitch
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByText('Liquid glass & backdrop')

    const wakeSlider = screen.getByRole('slider', { name: 'Replacement delay' })
    expect(wakeSlider.closest('.wake-slider')).not.toBeNull()
    expect(wakeSlider).toHaveAttribute('aria-valuenow', '200')
    wakeSlider.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(wakeSlider).toHaveAttribute('aria-valuenow', '220')

    const cometDial = screen.getByRole('slider', { name: 'Backdrop and glass intensity' })
    expect(cometDial.closest('.comet-dial')).not.toBeNull()
    cometDial.focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(cometDial).toHaveAttribute('aria-valuenow', '80')
    const appRoot = container.querySelector('.app') as HTMLElement
    expect(appRoot.style.getPropertyValue('--backdrop-opacity')).toBe('0.80')

    const motionSwitch = screen.getByRole('switch', { name: 'Reduce motion' })
    expect(motionSwitch).toHaveClass('squish-switch')
    expect(motionSwitch).toHaveAttribute('aria-checked', 'false')
    await user.click(motionSwitch)
    expect(motionSwitch).toHaveAttribute('aria-checked', 'true')
    expect(motionSwitch).toHaveAttribute('data-on', '')

    expect((await axe.run(container)).violations).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await screen.findByText('Settings saved.')
  })

  it('honors OS prefers-reduced-motion: reduce across ThemeBackground, LiquidGlass, and app root', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    try {
      const { container } = render(<App />)
      await screen.findByText('SwiftSlate is listening')

      expect(document.documentElement.dataset.reducedMotion).toBe('true')
      expect(container.querySelector('.app')).toHaveAttribute('data-reduced-motion', 'true')
      expect(container.querySelector('.liquid-glass-canvas')).toBeNull()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('preserves unsaved Settings edits across screen navigation, displays the sidebar dirty dot, and guards beforeunload', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findByText('Command behavior')
    expect(screen.queryByTestId('settings-dirty-dot')).toBeNull()

    const prefixInput = screen.getByLabelText(/Trigger prefix/i) as HTMLInputElement
    await user.clear(prefixInput)
    await user.type(prefixInput, '!')

    expect(screen.getByTestId('settings-dirty-dot')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    const unloadWhileDirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unloadWhileDirty)
    expect(unloadWhileDirty.defaultPrevented).toBe(true)

    // Navigate away to Commands and return to Settings — unsaved draft persists without loss
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByRole('heading', { name: 'Your command library' })
    expect(screen.getByTestId('settings-dirty-dot')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const restoredPrefixInput = (await screen.findByLabelText(/Trigger prefix/i)) as HTMLInputElement
    expect(restoredPrefixInput.value).toBe('!')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset changes' }))
    expect(screen.queryByTestId('settings-dirty-dot')).toBeNull()

    const unloadWhenClean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unloadWhenClean)
    expect(unloadWhenClean.defaultPrevented).toBe(false)
  })

  it('keeps ChromaGrid within the LiquidGlass 12-slot budget, enforces form hygiene, and clarifies Onboarding Skip for now', async () => {
    const user = userEvent.setup()
    const { container, unmount } = render(<App />)
    await screen.findByText('SwiftSlate is listening')

    await user.click(screen.getByRole('button', { name: /Switch engine/i }))
    await screen.findByText('Choose where SwiftSlate thinks')

    // Zero ChromaGrid tiles carry data-glass, keeping total [data-glass] slots well below MAX_ITEMS (12)
    expect(container.querySelectorAll('.chroma-card[data-glass]').length).toBe(0)
    expect(container.querySelectorAll('[data-glass]').length).toBeLessThanOrEqual(6)

    const searchInput = screen.getByRole('textbox', { name: 'Search providers' })
    expect(searchInput).toHaveAttribute('name', 'provider-search')
    expect(searchInput).toHaveAttribute('autocomplete', 'off')

    const customCard = screen.getByRole('heading', { name: /Custom endpoint/i }).closest('.provider-card') as HTMLElement
    await user.click(within(customCard).getByRole('button', { name: 'Configure' }))
    const dialog = await screen.findByRole('dialog', { name: /Configure Custom/i })
    const endpointInput = within(dialog).getByLabelText(/^Endpoint/i) as HTMLInputElement
    expect(endpointInput.type).toBe('url')
    expect(endpointInput).toHaveAttribute('name', 'provider-endpoint')
    unmount()

    // Onboarding: Liquid Glass panel + explicit "Skip for now" vs "Continue" on cloud Step 2
    const baseSnapshot = await api.snapshot()
    const firstRunSpy = vi.spyOn(api, 'snapshot').mockResolvedValueOnce({
      ...baseSnapshot,
      runtime: { ...baseSnapshot.runtime, firstRun: true },
    })
    try {
      const onboardingRender = render(<App />)
      const onboardingDialog = await screen.findByRole('dialog', { name: /Write faster in every Windows app/i })
      expect(onboardingDialog).toHaveAttribute('data-glass', '')
      expect((await axe.run(onboardingRender.container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([])

      await user.click(within(onboardingDialog).getByRole('button', { name: /Continue/i }))
      await within(onboardingDialog).findByRole('heading', { name: /Choose where SwiftSlate thinks/i })

      // Select Groq and proceed to Step 3 (step index 2)
      await user.click(within(onboardingDialog).getByRole('button', { name: /Groq/i }))
      await user.click(within(onboardingDialog).getByRole('button', { name: /Continue/i }))
      await within(onboardingDialog).findByRole('heading', { name: /Add an API key securely/i })
      expect(within(onboardingDialog).getByRole('button', { name: /Skip for now/i })).toBeInTheDocument()

      const keyField = within(onboardingDialog).getByLabelText('API key')
      await user.type(keyField, 'gsk_live_key')
      expect(within(onboardingDialog).getByRole('button', { name: /^Continue$/i })).toBeInTheDocument()
    } finally {
      firstRunSpy.mockRestore()
    }
  })
})
