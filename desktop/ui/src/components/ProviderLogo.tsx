import customLogo from '../assets/providers/custom.svg'
import deepseekLogo from '../assets/providers/deepseek.svg'
import geminiLogo from '../assets/providers/gemini.svg'
import groqLogo from '../assets/providers/groq.svg'
import lmstudioLogo from '../assets/providers/lmstudio.svg'
import mistralLogo from '../assets/providers/mistral.svg'
import nvidiaLogo from '../assets/providers/nvidia.svg'
import ollamaLogo from '../assets/providers/ollama.svg'
import openaiLogo from '../assets/providers/openai.svg'
import openrouterLogo from '../assets/providers/openrouter.svg'
import type { ProviderId } from '../types'

const providerAssets: Record<ProviderId, { src: string; className: string; portalUrl?: string }> = {
  gemini: {
    src: geminiLogo,
    className: 'provider-gemini',
    portalUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    src: groqLogo,
    className: 'provider-groq',
    portalUrl: 'https://console.groq.com/keys',
  },
  openai: {
    src: openaiLogo,
    className: 'provider-openai',
    portalUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    src: openrouterLogo,
    className: 'provider-openrouter',
    portalUrl: 'https://openrouter.ai/keys',
  },
  mistral: {
    src: mistralLogo,
    className: 'provider-mistral',
    portalUrl: 'https://console.mistral.ai/api-keys',
  },
  deepseek: {
    src: deepseekLogo,
    className: 'provider-deepseek',
    portalUrl: 'https://platform.deepseek.com/api_keys',
  },
  nvidia: {
    src: nvidiaLogo,
    className: 'provider-nvidia',
    portalUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  ollama: {
    src: ollamaLogo,
    className: 'provider-ollama',
    portalUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    src: lmstudioLogo,
    className: 'provider-lmstudio',
    portalUrl: 'https://lmstudio.ai',
  },
  custom: {
    src: customLogo,
    className: 'provider-custom',
  },
}

export function getProviderPortalUrl(id: ProviderId, portalAvailable?: boolean): string {
  if (portalAvailable === false) return ''
  return providerAssets[id]?.portalUrl || ''
}

export function getProviderTileClass(id: string): string {
  return providerAssets[id as ProviderId]?.className || 'provider-custom'
}

export function ProviderLogo({
  id,
  size = 20,
  className = '',
  label,
}: {
  id: string
  size?: number
  className?: string
  label?: string
}) {
  const asset = providerAssets[id as ProviderId] || providerAssets.custom
  return (
    <img
      src={asset.src}
      width={size}
      height={size}
      className={`provider-logo-img ${className}`.trim()}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
