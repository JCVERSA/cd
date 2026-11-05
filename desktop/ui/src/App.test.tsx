import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from './App'

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
})
