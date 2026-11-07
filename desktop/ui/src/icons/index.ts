import { createElement } from 'react'
import type { GlyphName } from './glyphCatalog'
import { SlateIcon, type SlateIconProps } from './SlateIcon'

export { GLYPH_CATALOG, type GlyphName, type GlyphPathSpec } from './glyphCatalog'
export { pathSignature } from './glyphGeometry'
export { SlateIcon, type SlateIconProps } from './SlateIcon'

function bindGlyph(name: GlyphName, defaultMode: 'interactive' | 'state' = 'interactive') {
  const Component = (props: SlateIconProps) =>
    createElement(SlateIcon, { name, mode: props.mode ?? defaultMode, ...props })
  Component.displayName = `SlateGlyph(${name})`
  return Component
}

/* 1. Workspace Navigation Tabs */
export const OverviewIcon = bindGlyph('overview')
export const PlaygroundIcon = bindGlyph('playground')
export const ProvidersIcon = bindGlyph('providers')
export const CommandsIcon = bindGlyph('commands')
export const StylesIcon = bindGlyph('styles')
export const SettingsIcon = bindGlyph('settings')
export const DiagnosticsIcon = bindGlyph('diagnostics')

/* 2. True State-Toggle Morphs */
export const PlayPauseIcon = bindGlyph('playPause', 'state')
export const PlayPauseCircleIcon = bindGlyph('playPauseCircle', 'state')
export const PlayActionIcon = bindGlyph('playAction')
export const CopyCheckIcon = bindGlyph('copyCheck', 'state')
export const EyeToggleIcon = bindGlyph('eyeToggle', 'state')
export const ChevronMorphIcon = bindGlyph('chevronDown', 'state')
export const ChevronRightIcon = bindGlyph('chevronRight')
export const SidebarToggleIcon = bindGlyph('sidebarToggle', 'state')

/* 3. Shell, Writing & Command Actions */
export const SearchIcon = bindGlyph('search')
export const ThemeSwatchIcon = bindGlyph('themeSwatch')
export const SparkleIcon = bindGlyph('sparkle')
export const WandIcon = bindGlyph('wand')
export const TypeGlyphIcon = bindGlyph('typeGlyph')
export const CursorSparkIcon = bindGlyph('cursorSpark')
export const SwapChainIcon = bindGlyph('swapChain')
export const EraserSweepIcon = bindGlyph('eraserSweep')
export const PlusCreateIcon = bindGlyph('plusCreate')
export const EditPenIcon = bindGlyph('editPen')
export const TrashBinIcon = bindGlyph('trashBin')

/* 4. Providers, Security & System Hardware */
export const ShieldCheckIcon = bindGlyph('shieldCheck')
export const KeyVaultIcon = bindGlyph('keyVault')
export const ServerStackIcon = bindGlyph('serverStack')
export const TuneSlidersIcon = bindGlyph('tuneSliders')
export const ProbeFlaskIcon = bindGlyph('probeFlask')
export const SyncArrowsIcon = bindGlyph('syncArrows')
export const ExternalLaunchIcon = bindGlyph('externalLaunch')
export const OfflineCloudIcon = bindGlyph('offlineCloud')
export const KeyboardDeckIcon = bindGlyph('keyboardDeck')
export const WindowLaunchIcon = bindGlyph('windowLaunch')
export const MotionEaseIcon = bindGlyph('motionEase')
export const SaveVaultIcon = bindGlyph('saveVault')
export const ResetArcIcon = bindGlyph('resetArc')

/* 5. Status, Telemetry & Directional Vectors */
export const TerminalPromptIcon = bindGlyph('terminalPrompt')
export const ClockPulseIcon = bindGlyph('clockPulse')
export const BoltInstantIcon = bindGlyph('boltInstant')
export const CheckMarkIcon = bindGlyph('checkMark')
export const CheckCircleIcon = bindGlyph('checkCircle')
export const AlertCircleIcon = bindGlyph('alertCircle')
export const AlertTriangleIcon = bindGlyph('alertTriangle')
export const InfoCircleIcon = bindGlyph('infoCircle')
export const XCircleIcon = bindGlyph('xCircle')
export const CloseXIcon = bindGlyph('closeX')
export const SpinnerRingIcon = bindGlyph('spinnerRing')
export const ArrowRightIcon = bindGlyph('arrowRight')
export const ArrowLeftIcon = bindGlyph('arrowLeft')
export const ArrowUpRightIcon = bindGlyph('arrowUpRight')
