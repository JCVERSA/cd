import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { Select } from './components/ui'

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
    await user.click(screen.getByRole('button', { name: 'Providers' }))
    expect(await screen.findByText('Choose where SwiftSlate thinks')).toBeInTheDocument()
  })

  it('opens provider configuration without exposing a saved key', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('SwiftSlate is listening')
    await user.click(screen.getByRole('button', { name: 'Providers' }))
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
    await user.click(screen.getByRole('button', { name: 'Providers' }))
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
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(await screen.findByText('SwiftSlate is paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Providers' }))
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
    await screen.findByRole('listbox', { name: 'Model' })
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

      await user.click(screen.getByRole('button', { name: /Providers/i }))
      await screen.findByText('Choose where SwiftSlate thinks')

      const logos = Array.from(container.querySelectorAll<HTMLImageElement>('.provider-card img.provider-logo-img'))
      expect(logos).toHaveLength(10)
      const uniqueSources = new Set(logos.map((img) => img.getAttribute('src')))
      expect(uniqueSources.size).toBe(10)

      expect(screen.getByRole('button', { name: 'Get Google Gemini API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Groq API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get OpenAI API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get OpenRouter API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Mistral AI API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get DeepSeek API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get NVIDIA NIM API key' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get Ollama' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Get LM Studio' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Get Custom endpoint/i })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Get Groq API key' }))
      expect(openSpy).toHaveBeenCalledWith('https://console.groq.com/keys', '_blank', 'noopener,noreferrer')

      const configureButtons = screen.getAllByRole('button', { name: 'Configure' })
      await user.click(configureButtons[5])
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
})
