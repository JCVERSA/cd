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

const providerAssets: Record<ProviderId, { src: string; className: string; accent: string; scale: number; portalUrl?: string }> = {
  gemini: {
    src: geminiLogo,
    className: 'provider-gemini',
    accent: '#5fa4ff',
    scale: 1,
    portalUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    src: groqLogo,
    className: 'provider-groq',
    accent: '#f55036',
    scale: 1.06,
    portalUrl: 'https://console.groq.com/keys',
  },
  cerebras: {
    src: cerebrasLogo,
    className: 'provider-cerebras',
    accent: '#ff6a33',
    scale: 0.98,
    portalUrl: 'https://cloud.cerebras.ai/',
  },
  sambanova: {
    src: sambanovaLogo,
    className: 'provider-sambanova',
    accent: '#f27c2c',
    scale: 0.94,
    portalUrl: 'https://cloud.sambanova.ai/apis',
  },
  openai: {
    src: openaiLogo,
    className: 'provider-openai',
    accent: '#10a37f',
    scale: 0.96,
    portalUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    src: openrouterLogo,
    className: 'provider-openrouter',
    accent: '#c8ff00',
    scale: 0.9,
    portalUrl: 'https://openrouter.ai/keys',
  },
  cohere: {
    src: cohereLogo,
    className: 'provider-cohere',
    accent: '#39d99f',
    scale: 0.96,
    portalUrl: 'https://dashboard.cohere.com/api-keys',
  },
  huggingface: {
    src: huggingfaceLogo,
    className: 'provider-huggingface',
    accent: '#ffd21e',
    scale: 1,
    portalUrl: 'https://huggingface.co/settings/tokens',
  },
  mistral: {
    src: mistralLogo,
    className: 'provider-mistral',
    accent: '#ff8205',
    scale: 0.92,
    portalUrl: 'https://console.mistral.ai/api-keys',
  },
  deepseek: {
    src: deepseekLogo,
    className: 'provider-deepseek',
    accent: '#4d6bfe',
    scale: 1,
    portalUrl: 'https://platform.deepseek.com/api_keys',
  },
  nvidia: {
    src: nvidiaLogo,
    className: 'provider-nvidia',
    accent: '#76b900',
    scale: 0.96,
    portalUrl: 'https://build.nvidia.com/settings/api-keys',
  },
  xai: {
    src: xaiLogo,
    className: 'provider-xai',
    accent: '#d8dce8',
    scale: 0.95,
    portalUrl: 'https://console.x.ai',
  },
  qwen: {
    src: qwenLogo,
    className: 'provider-qwen',
    accent: '#7c6cff',
    scale: 0.95,
    portalUrl: 'https://bailian.console.alibabacloud.com/?apiKey=1',
  },
  ollama: {
    src: ollamaLogo,
    className: 'provider-ollama',
    accent: '#e4e7f1',
    scale: 1.05,
    portalUrl: 'https://ollama.com/download',
  },
  lmstudio: {
    src: lmstudioLogo,
    className: 'provider-lmstudio',
    accent: '#818cf8',
    scale: 0.98,
    portalUrl: 'https://lmstudio.ai',
  },
  custom: {
    src: customLogo,
    className: 'provider-custom',
    accent: '#60d5ff',
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

export function getProviderAccentColor(id: string): string {
  return providerAssets[id as ProviderId]?.accent || '#60d5ff'
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
