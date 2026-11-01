import { demoSnapshot } from './data'
import type { AppSnapshot, Command, Provider, RuntimeState } from './types'

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
const sessionToken = hashParams.get('session') || ''
if (sessionToken) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
}

const isDesktopHost = Boolean(sessionToken)
const headers = (): HeadersInit => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
})

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { ...headers(), ...(init?.headers || {}) },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }))
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  isDesktopHost,

  async snapshot(): Promise<AppSnapshot> {
    if (!isDesktopHost) return structuredClone(demoSnapshot)
    return request<AppSnapshot>('/api/v1/snapshot')
  },

  async setPaused(paused: boolean): Promise<RuntimeState> {
    if (!isDesktopHost) return { ...demoSnapshot.runtime, paused }
    return request<RuntimeState>('/api/v1/runtime/pause', {
      method: 'PUT',
      body: JSON.stringify({ paused }),
    })
  },

  async saveRuntime(patch: Partial<RuntimeState>): Promise<RuntimeState> {
    if (!isDesktopHost) return { ...demoSnapshot.runtime, ...patch }
    return request<RuntimeState>('/api/v1/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  async saveProvider(provider: Provider, apiKey?: string, active = false): Promise<Provider> {
    if (!isDesktopHost) return { ...provider, connected: active, keyConfigured: provider.local || Boolean(apiKey) || provider.keyConfigured }
    return request<Provider>(`/api/v1/providers/${provider.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...provider, apiKey, active }),
    })
  },

  async fetchModels(provider: Provider, apiKey?: string): Promise<{ models: string[] }> {
    const id = provider.id
    if (!isDesktopHost) {
      const demoProvider = demoSnapshot.providers.find((item) => item.id === id)
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      return { models: demoProvider?.models || [demoProvider?.model || 'default'].filter(Boolean) }
    }
    return request<{ models: string[] }>(`/api/v1/providers/${id}/models`, {
      method: 'POST',
      body: JSON.stringify({ endpoint: provider.endpoint, apiKey }),
    })
  },

  async testProvider(provider: Provider, apiKey?: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const id = provider.id
    if (!isDesktopHost) {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
      return { ok: true, latencyMs: 684, message: `${id} is ready.` }
    }
    return request(`/api/v1/providers/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ endpoint: provider.endpoint, model: provider.model, apiKey }),
    })
  },

  async saveCommand(command: Command): Promise<Command> {
    if (!isDesktopHost) return command
    return request<Command>(`/api/v1/commands/${encodeURIComponent(command.id)}`, {
      method: 'PUT',
      body: JSON.stringify(command),
    })
  },

  async deleteCommand(id: string): Promise<void> {
    if (!isDesktopHost) return
    await request(`/api/v1/commands/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  async runPlayground(payload: { command: string; input: string }): Promise<{ output: string; durationMs: number; local: boolean }> {
    if (!isDesktopHost) {
      await new Promise((resolve) => window.setTimeout(resolve, 650))
      return {
        output: payload.command === 'shorten'
          ? payload.input.split(/\s+/).slice(0, Math.max(4, Math.ceil(payload.input.split(/\s+/).length * 0.55))).join(' ')
          : `Here is a polished version: ${payload.input}`,
        durationMs: 648,
        local: false,
      }
    }
    return request('/api/v1/playground', { method: 'POST', body: JSON.stringify(payload) })
  },

  async logs(): Promise<AppSnapshot['logs']> {
    if (!isDesktopHost) return demoSnapshot.logs
    return request<AppSnapshot['logs']>('/api/v1/logs')
  },

  async runDiagnostics(): Promise<AppSnapshot['diagnostics']> {
    if (!isDesktopHost) {
      await new Promise((resolve) => window.setTimeout(resolve, 650))
      return demoSnapshot.diagnostics
    }
    return request('/api/v1/diagnostics/run', { method: 'POST', body: '{}' })
  },
}
