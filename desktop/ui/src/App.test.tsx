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

  it('shows runtime status and navigates between screens', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByText('SwiftSlate is listening')).toBeInTheDocument()
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(mainNav).queryByRole('button', { name: 'Providers' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add provider/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch or configure model/i })).toBeInTheDocument()
    const providerPod = screen.getByRole('button', { name: /Switch engine/i })
    await user.click(providerPod)
    expect(await screen.findByText('Choose where SwiftSlate thinks')).toBeInTheDocument()
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

  it('pauses and resumes inline commands', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    expect(screen.getByText('Engine active')).toBeInTheDocument()
    expect(screen.getByText('Listening globally')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByText('SwiftSlate is paused')).toBeInTheDocument()
    expect(screen.getByText('Engine paused')).toBeInTheDocument()
    expect(screen.getByText('Triggers suspended')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })

  it('uses Windows-native chrome and passes axe across Commands, Styles, Settings, and Diagnostics', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')

    // Windows Ctrl K shortcut badge and no dead Notifications button
    expect(screen.getByText('Ctrl K')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument()

    // Commands screen: aria-pressed filter state + axe
    await user.click(screen.getByRole('button', { name: 'Commands' }))
    await screen.findByText('Your command library')
    const allFilter = screen.getByRole('button', { name: 'All' })
    const aiFilter = screen.getByRole('button', { name: 'AI' })
    expect(allFilter).toHaveAttribute('aria-pressed', 'true')
    expect(aiFilter).toHaveAttribute('aria-pressed', 'false')
    await user.click(aiFilter)
    expect(aiFilter).toHaveAttribute('aria-pressed', 'true')
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
      const filterGroup = screen.getByRole('group', { name: 'Provider filter' })
      await user.click(within(filterGroup).getByRole('button', { name: 'Free tier' }))
      expect(screen.getByText('14 of 16 providers')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'OpenAI' })).not.toBeInTheDocument()

      await user.click(within(filterGroup).getByRole('button', { name: 'Local' }))
      expect(screen.getByText('2 of 16 providers')).toBeInTheDocument()

      await user.click(within(filterGroup).getByRole('button', { name: 'All' }))
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

    // Clicking Pause morphs PlayPauseIcon (false -> true) and SidebarToggleIcon morphs on collapse
    const pauseBtn = screen.getByRole('button', { name: 'Pause' })
    expect(pauseBtn.querySelector('[data-slate-glyph="playPause"]')).toHaveAttribute('data-morphed', 'false')
    await user.click(pauseBtn)
    const resumeBtn = await screen.findByRole('button', { name: 'Resume' })
    expect(resumeBtn.querySelector('[data-slate-glyph="playPause"]')).toHaveAttribute('data-morphed', 'true')

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
})
