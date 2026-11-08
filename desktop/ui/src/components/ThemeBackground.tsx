import { useCallback, useRef } from 'react'
import type { ThemeId } from '../types'
import AeroShards from './AeroShards'
import './ThemeBackground.css'

export interface ThemeBackgroundMeta {
  id: string
  label: string
}

export const THEME_BACKGROUNDS: Partial<Record<ThemeId, ThemeBackgroundMeta>> = {
  lavender: {
    id: 'aero-shards',
    label: 'Aero Shards',
  },
}

export interface ThemeBackgroundProps {
  theme: ThemeId
  reducedMotion?: boolean
}

export function ThemeBackground({ theme, reducedMotion = false }: ThemeBackgroundProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const activeMeta = THEME_BACKGROUNDS[theme]

  const handleGpuError = useCallback(() => {
    if (stageRef.current) {
      stageRef.current.dataset.gpuFallback = 'true'
    }
  }, [])

  return (
    <div
      ref={stageRef}
      className="theme-background"
      data-theme-background={theme}
      data-background-id={activeMeta?.id ?? 'ambient'}
      aria-hidden="true"
    >
      <div className="ambient" />
      {theme === 'lavender' ? (
        <div className="theme-background-layer">
          <AeroShards
            shardColor="#8b6cc8"
            accentColor="#c9a8ff"
            placement="full"
            material="glass"
            markers="plus"
            count={950}
            depthOfField={0.78}
            glow={0.34}
            grain={0.05}
            vignette={0.32}
            speed={0.85}
            mouseInteraction={!reducedMotion}
            pulseOnClick={!reducedMotion}
            holdToGather={!reducedMotion}
            paused={reducedMotion}
            dpr={1.75}
            onError={handleGpuError}
          />
        </div>
      ) : null}
      <div className="theme-background-scrim" />
    </div>
  )
}
