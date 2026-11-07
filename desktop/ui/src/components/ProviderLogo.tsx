import cerebrasLogo from '../assets/providers/cerebras.svg'
import cohereLogo from '../assets/providers/cohere.svg'
import customLogo from '../assets/providers/custom.svg'
import deepseekLogo from '../assets/providers/deepseek.svg'
import geminiLogo from '../assets/providers/gemini.svg'
import groqLogo from '../assets/providers/groq.svg'
import huggingfaceLogo from '../assets/providers/huggingface.svg'
import lmstudioLogo from '../assets/providers/lmstudio.svg'
import mistralLogo from '../assets/providers/mistral.svg'
import nvidiaLogo from '../assets/providers/nvidia.svg'
import ollamaLogo from '../assets/providers/ollama.svg'
import openaiLogo from '../assets/providers/openai.svg'
import openrouterLogo from '../assets/providers/openrouter.svg'
import qwenLogo from '../assets/providers/qwen.svg'
import sambanovaLogo from '../assets/providers/sambanova.svg'
import xaiLogo from '../assets/providers/xai.svg'
import type { ProviderId } from '../types'

const providerAssets: Record<ProviderId, { src: string; className: string; scale: number; portalUrl?: string }> = {
  gemini: {
    src: geminiLogo,
    className: 'provider-gemini',
    scale: 1,
    portalUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    src: groqLogo,
    className: 'provider-groq',
    scale: 1.06,
    portalUrl: 'https://console.groq.com/keys',
  },
  cerebras: {
    src: cerebrasLogo,
    className: 'provider-cerebras',
    scale: 0.98,
    portalUrl: 'https://cloud.cerebras.ai/',
  },
  sambanova: {
    src: sambanovaLogo,
    className: 'provider-sambanova',
    scale: 0.94,
    portalUrl: 'https://cloud.sambanova.ai/apis',
  },
  openai: {
    src: openaiLogo,
    className: 'provider-openai',
    scale: 0.96,
    portalUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    src: openrouterLogo,
    className: 'provider-openrouter',
    scale: 0.9,
    portalUrl: 'https://openrouter.ai/keys',
  },
  cohere: {
    src: cohereLogo,
    className: 'provider-cohere',
    scale: 0.96,
    portalUrl: 'https://dashboard.cohere.com/api-keys',
  },
  huggingface: {
    src: huggingfaceLogo,
    className: 'provider-huggingface',
    scale: 1,
    portalUrl: 'https://huggingface.co/settings/tokens',
  },
  mistral: {
    src: mistralLogo,
    className: 'provider-mistral',
    scale: 0.92,
    portalUrl: 'https://console.mistral.ai/api-keys',
  },
  deepseek: {
    src: deepseekLogo,
    className: 'provider-deepseek',
    scale: 1,
    portalUrl: 'https://platform.deepseek.com/api_keys',
  },
  nvidia: {
    src: nvidiaLogo,
    className: 'provider-nvidia',
    scale: 0.96,
    portalUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  xai: {
    src: xaiLogo,
    className: 'provider-xai',
    scale: 0.95,
    portalUrl: 'https://console.x.ai',
  },
  qwen: {
    src: qwenLogo,
    className: 'provider-qwen',
    scale: 0.95,
    portalUrl: 'https://bailian.console.alibabacloud.com/?apiKey=1',
  },
  ollama: {
    src: ollamaLogo,
    className: 'provider-ollama',
    scale: 1.05,
    portalUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    src: lmstudioLogo,
    className: 'provider-lmstudio',
    scale: 0.98,
    portalUrl: 'https://lmstudio.ai',
  },
  custom: {
    src: customLogo,
    className: 'provider-custom',
    scale: 1.05,
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
  const opticalSize = Math.round(size * asset.scale)
  return (
    <img
      src={asset.src}
      width={opticalSize}
      height={opticalSize}
      className={`provider-logo-img ${className}`.trim()}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
