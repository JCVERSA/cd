import { useCallback, useRef } from 'react'
import type { ThemeId } from '../types'
import AeroShards from './AeroShards'
import Lightfall from './Lightfall'
import LightPillar from './LightPillar'
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
  sapphire: {
    id: 'lightfall',
    label: 'Lightfall',
  },
  rose: {
    id: 'light-pillar',
    label: 'Light Pillar',
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
      {theme === 'sapphire' ? (
        <div className="theme-background-layer">
          <Lightfall
            colors={['#e4efff', '#88b8ff', '#5b8eee', '#3898ff']}
            backgroundColor="#4b7fe8"
            speed={0.65}
            streakCount={6}
            streakWidth={0.72}
            streakLength={1.05}
            density={0.9}
            twinkle={0.5}
            backgroundGlow={0.14}
            headGlow={0.62}
            bloom={0.52}
            glow={1.15}
            fade={0.12}
            mouseInteraction={!reducedMotion}
            mouseStrength={0.85}
            mouseRadius={0.34}
            holdToWarp={!reducedMotion}
            intro={!reducedMotion}
            paused={reducedMotion}
            dpr={1.75}
          />
        </div>
      ) : null}
      {theme === 'rose' ? (
        <div className="theme-background-layer">
          <LightPillar
            topColor="#9c3d61"
            bottomColor="#ffafc8"
            intensity={1.08}
            glowAmount={0.0022}
            bloom={0.52}
            pillarWidth={4.8}
            pillarHeight={0.4}
            pillarRotation={25}
            rotationSpeed={0.28}
            noiseIntensity={0.42}
            fade={0.22}
            quality="high"
            mixBlendMode="screen"
            interactive={!reducedMotion}
            clickPulse={!reducedMotion}
            intro={!reducedMotion}
            paused={reducedMotion}
          />
        </div>
      ) : null}
      <div className="theme-background-scrim" />
    </div>
  )
}
