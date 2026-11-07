import { arcCubic, circleCubic, n, polyPath, roundedRectCubic, sparkleCubic } from './glyphGeometry'

export type GlyphPathSpec = {
  rest: string
  morph: string
  filled?: boolean
  strokeWidth?: number
  opacity?: readonly [number, number]
}

export type GlyphName =
  | 'overview'
  | 'playground'
  | 'providers'
  | 'commands'
  | 'styles'
  | 'settings'
  | 'diagnostics'
  | 'playPause'
  | 'playPauseCircle'
  | 'playAction'
  | 'copyCheck'
  | 'eyeToggle'
  | 'chevronDown'
  | 'chevronRight'
  | 'sidebarToggle'
  | 'search'
  | 'themeSwatch'
  | 'sparkle'
  | 'wand'
  | 'typeGlyph'
  | 'cursorSpark'
  | 'swapChain'
  | 'eraserSweep'
  | 'plusCreate'
  | 'editPen'
  | 'trashBin'
  | 'shieldCheck'
  | 'keyVault'
  | 'serverStack'
  | 'tuneSliders'
  | 'probeFlask'
  | 'syncArrows'
  | 'externalLaunch'
  | 'offlineCloud'
  | 'keyboardDeck'
  | 'windowLaunch'
  | 'motionEase'
  | 'saveVault'
  | 'resetArc'
  | 'terminalPrompt'
  | 'clockPulse'
  | 'boltInstant'
  | 'checkMark'
  | 'checkCircle'
  | 'alertCircle'
  | 'alertTriangle'
  | 'infoCircle'
  | 'xCircle'
  | 'closeX'
  | 'spinnerRing'
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUpRight'

/** Connected 270-degree corner loop for the Command (`⌘`) glyph with G1 tangent continuity. */
function commandCornerLoop(cx: number, cy: number, r: number, startDeg: number): string {
  return arcCubic(cx, cy, r, startDeg, startDeg + 270, 3)
}

/** 4-cubic horizontal pill with identical M + 4xC + Z topology to `sparkleCubic`. */
function cursorPillCubic(cx: number, cy: number, rx: number, ry: number): string {
  const kx = rx * 0.55
  const ky = ry * 0.55
  return [
    `M ${n(cx)} ${n(cy - ry)}`,
    `C ${n(cx + kx)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ky)} ${n(cx + rx)} ${n(cy)}`,
    `C ${n(cx + rx)} ${n(cy + ky)} ${n(cx + kx)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)}`,
    `C ${n(cx - kx)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ky)} ${n(cx - rx)} ${n(cy)}`,
    `C ${n(cx - rx)} ${n(cy - ky)} ${n(cx - kx)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)}`,
    'Z',
  ].join(' ')
}

export const GLYPH_CATALOG: Record<GlyphName, readonly GlyphPathSpec[]> = {
  /* 1. Navigation & Core Workspace */
  overview: [
    {
      rest: arcCubic(12, 14, 8.4, -205, 25, 3),
      morph: arcCubic(12, 14, 8.7, -212, 32, 3),
    },
    {
      rest: polyPath([[12, 14], [7.8, 9.8]]),
      morph: polyPath([[12, 14], [16.5, 9.5]]),
    },
    {
      rest: circleCubic(12, 14, 1.75),
      morph: sparkleCubic(12, 14, 2.6, 0.24),
      filled: true,
    },
  ],

  playground: [
    {
      rest: roundedRectCubic(3, 4, 18, 16, 3.6),
      morph: roundedRectCubic(2.8, 3.8, 18.4, 16.4, 4),
    },
    {
      rest: polyPath([[6.8, 9.5], [9.3, 12], [6.8, 14.5]]),
      morph: polyPath([[7.4, 9.2], [10.2, 12], [7.4, 14.8]]),
    },
    {
      rest: cursorPillCubic(14.8, 14.2, 2.4, 0.9),
      morph: sparkleCubic(15, 12, 3.3, 0.2),
      filled: true,
    },
  ],

  providers: [
    {
      rest: roundedRectCubic(4.5, 5.5, 15, 13, 3.8),
      morph: roundedRectCubic(5, 5, 14, 14, 7),
    },
    {
      rest: circleCubic(12, 12, 2.1),
      morph: sparkleCubic(12, 12, 3.5, 0.22),
      filled: true,
    },
    {
      rest: polyPath([[2, 12], [4.5, 12]]),
      morph: polyPath([[1.8, 12], [5, 12]]),
    },
    {
      rest: polyPath([[19.5, 12], [22, 12]]),
      morph: polyPath([[19, 12], [22.2, 12]]),
    },
    {
      rest: polyPath([[12, 2.5], [12, 5.5]]),
      morph: polyPath([[12, 2], [12, 5]]),
    },
  ],

  commands: [
    {
      rest: polyPath([[9, 9], [15, 9], [15, 15], [9, 15]], true),
      morph: polyPath([[8.6, 8.6], [15.4, 8.6], [15.4, 15.4], [8.6, 15.4]], true),
    },
    {
      rest: commandCornerLoop(6.5, 6.5, 2.5, 90),
      morph: commandCornerLoop(6.1, 6.1, 2.5, 90),
    },
    {
      rest: commandCornerLoop(17.5, 6.5, 2.5, 180),
      morph: commandCornerLoop(17.9, 6.1, 2.5, 180),
    },
    {
      rest: commandCornerLoop(17.5, 17.5, 2.5, 270),
      morph: commandCornerLoop(17.9, 17.9, 2.5, 270),
    },
    {
      rest: commandCornerLoop(6.5, 17.5, 2.5, 0),
      morph: commandCornerLoop(6.1, 17.9, 2.5, 0),
    },
  ],

  styles: [
    {
      rest: polyPath([[12, 3], [18, 13.39], [15.5, 17.72], [15.5, 20.2], [8.5, 20.2], [8.5, 17.72], [6, 13.39]], true),
      morph: polyPath([[13, 2.8], [18.6, 13.2], [15.5, 17.72], [15.5, 20.2], [8.5, 20.2], [8.5, 17.72], [6.2, 13.1]], true),
    },
    {
      rest: polyPath([[12, 3], [12, 11.2]]),
      morph: polyPath([[13, 2.8], [12.4, 10.8]]),
    },
    {
      rest: circleCubic(12, 12.8, 1.55),
      morph: sparkleCubic(12.3, 12.5, 2.35, 0.24),
      filled: true,
    },
  ],

  settings: [
    { rest: polyPath([[3.5, 7], [20.5, 7]]), morph: polyPath([[3.5, 7], [20.5, 7]]) },
    { rest: circleCubic(9, 7, 2.1), morph: circleCubic(15.2, 7, 2.2), filled: true },
    { rest: polyPath([[3.5, 12], [20.5, 12]]), morph: polyPath([[3.5, 12], [20.5, 12]]) },
    { rest: circleCubic(15.5, 12, 2.1), morph: circleCubic(8.8, 12, 2.2), filled: true },
    { rest: polyPath([[3.5, 17], [20.5, 17]]), morph: polyPath([[3.5, 17], [20.5, 17]]) },
    { rest: circleCubic(10.5, 17, 2.1), morph: circleCubic(16.2, 17, 2.2), filled: true },
  ],

  diagnostics: [
    {
      rest: roundedRectCubic(3, 4, 18, 16, 3.8),
      morph: roundedRectCubic(2.8, 3.8, 18.4, 16.4, 4.2),
    },
    {
      rest: polyPath([[6, 12], [8.8, 12], [10.4, 9.23], [13.6, 14.77], [15.2, 12], [18, 12]]),
      morph: polyPath([[5.5, 12], [8.4, 12], [10.4, 6.8], [13.6, 17.2], [15.6, 12], [18.5, 12]]),
    },
  ],

  /* 2. True State-Toggle Morphs */
  playPause: [
    {
      rest: polyPath([[6.8, 5.5], [10.3, 5.5], [10.3, 18.5], [6.8, 18.5]], true),
      morph: polyPath([[7.5, 5.2], [13.2, 8.8], [13.2, 15.2], [7.5, 18.8]], true),
      filled: true,
    },
    {
      rest: polyPath([[13.7, 5.5], [17.2, 5.5], [17.2, 18.5], [13.7, 18.5]], true),
      morph: polyPath([[13.1, 8.75], [18.6, 12], [18.6, 12], [13.1, 15.25]], true),
      filled: true,
    },
  ],

  playPauseCircle: [
    {
      rest: circleCubic(12, 12, 9.2),
      morph: circleCubic(12, 12, 9.4),
    },
    {
      rest: polyPath([[9, 8.5], [11.1, 8.5], [11.1, 15.5], [9, 15.5]], true),
      morph: polyPath([[9.6, 8.2], [13, 10.2], [13, 13.8], [9.6, 15.8]], true),
      filled: true,
    },
    {
      rest: polyPath([[12.9, 8.5], [15, 8.5], [15, 15.5], [12.9, 15.5]], true),
      morph: polyPath([[12.9, 10.15], [16.2, 12], [16.2, 12], [12.9, 13.85]], true),
      filled: true,
    },
  ],

  playAction: [
    {
      rest: polyPath([[7, 5.42], [18.4, 12], [7, 18.58]], true),
      morph: polyPath([[8.2, 4.96], [20.4, 12], [8.2, 19.04]], true),
      filled: true,
    },
    {
      rest: polyPath([[3.5, 12], [5.2, 12]]),
      morph: polyPath([[3.2, 12], [5.8, 12]]),
      opacity: [0, 1],
    },
  ],

  copyCheck: [
    {
      rest: roundedRectCubic(7.5, 6.5, 11.5, 13.5, 2.4),
      morph: roundedRectCubic(3.2, 3.2, 17.6, 17.6, 8.8),
    },
    {
      rest: polyPath([[5, 15.5], [5, 4.5], [14.5, 4.5]]),
      morph: polyPath([[7.8, 12.2], [10.6, 15], [16.2, 9.4]]),
    },
  ],

  eyeToggle: [
    {
      rest: 'M 2.5 12 C 6.2 6.2 17.8 6.2 21.5 12',
      morph: 'M 2.5 12 C 6.2 7.8 17.8 7.8 21.5 12',
    },
    {
      rest: 'M 2.5 12 C 6.2 17.8 17.8 17.8 21.5 12',
      morph: 'M 2.5 12 C 6.2 16.2 17.8 16.2 21.5 12',
    },
    {
      rest: circleCubic(12, 12, 2.4),
      morph: circleCubic(12, 12, 1.8),
      opacity: [1, 0.35],
    },
    {
      rest: polyPath([[19.5, 4.5], [19.5, 4.5]]),
      morph: polyPath([[4.5, 19.5], [19.5, 4.5]]),
      opacity: [0, 1],
    },
  ],

  chevronDown: [
    {
      rest: polyPath([[6.2, 9.2], [12, 15], [17.8, 9.2]]),
      morph: polyPath([[6.2, 14.8], [12, 9], [17.8, 14.8]]),
    },
  ],

  chevronRight: [
    {
      rest: polyPath([[9.2, 6.2], [15, 12], [9.2, 17.8]]),
      morph: polyPath([[10.6, 6.2], [16.4, 12], [10.6, 17.8]]),
    },
  ],

  sidebarToggle: [
    {
      rest: roundedRectCubic(3, 4, 18, 16, 3.4),
      morph: roundedRectCubic(3, 4, 18, 16, 3.4),
    },
    {
      rest: polyPath([[9, 4.2], [9, 19.8]]),
      morph: polyPath([[6.8, 4.2], [6.8, 19.8]]),
    },
    {
      rest: polyPath([[15.2, 9.2], [12.4, 12], [15.2, 14.8]]),
      morph: polyPath([[12.2, 9.2], [15, 12], [12.2, 14.8]]),
    },
  ],

  /* 3. Shell, Writing & Command Actions */
  search: [
    {
      rest: circleCubic(10.8, 10.8, 6.6),
      morph: circleCubic(10.5, 10.5, 7),
    },
    {
      rest: polyPath([[15.6, 15.6], [20, 20]]),
      morph: polyPath([[15.6, 15.6], [20.8, 20.8]]),
    },
    {
      rest: arcCubic(10.8, 10.8, 3.6, -150, -70, 2),
      morph: arcCubic(10.5, 10.5, 4, -135, -35, 2),
      strokeWidth: 1.45,
    },
  ],

  themeSwatch: [
    {
      rest: circleCubic(12, 12, 8.8),
      morph: circleCubic(12, 12, 9.2),
    },
    {
      rest: circleCubic(9.2, 9.6, 1.4),
      morph: sparkleCubic(9, 9.4, 2, 0.25),
      filled: true,
    },
    {
      rest: circleCubic(14.8, 9.6, 1.4),
      morph: circleCubic(15.2, 9.4, 1.6),
      filled: true,
    },
    {
      rest: circleCubic(12, 15, 1.5),
      morph: circleCubic(12, 15.4, 1.8),
      filled: true,
    },
  ],

  sparkle: [
    {
      rest: sparkleCubic(11, 12.5, 7.6, 0.2),
      morph: sparkleCubic(11, 12.5, 8.6, 0.17),
    },
    {
      rest: sparkleCubic(18.2, 6, 2.6, 0.24),
      morph: sparkleCubic(18.6, 5.4, 3.3, 0.2),
      filled: true,
    },
  ],

  wand: [
    {
      rest: polyPath([[4.5, 19.5], [15, 9]]),
      morph: polyPath([[4, 20], [15.6, 8.4]]),
    },
    {
      rest: sparkleCubic(17.5, 6.5, 3.2, 0.22),
      morph: sparkleCubic(18, 6, 4.1, 0.18),
      filled: true,
    },
    {
      rest: circleCubic(11.5, 5, 1.1),
      morph: circleCubic(10.8, 4.4, 1.35),
      filled: true,
    },
    {
      rest: circleCubic(19, 12.5, 1.1),
      morph: circleCubic(19.6, 13.2, 1.35),
      filled: true,
    },
  ],

  typeGlyph: [
    {
      rest: polyPath([[5, 7.5], [5, 5], [19, 5], [19, 7.5]]),
      morph: polyPath([[4.2, 8.2], [4.2, 4.8], [19.8, 4.8], [19.8, 8.2]]),
    },
    {
      rest: polyPath([[12, 5], [12, 19]]),
      morph: polyPath([[12, 4.8], [12, 19.2]]),
    },
    {
      rest: polyPath([[9, 19], [15, 19]]),
      morph: polyPath([[8.2, 19.2], [15.8, 19.2]]),
    },
  ],

  cursorSpark: [
    {
      rest: polyPath([[5.5, 4.5], [18.5, 10.8], [12.5, 12.8], [10.5, 18.8]], true),
      morph: polyPath([[5, 4], [19.2, 10.6], [12.8, 12.8], [10.6, 19.4]], true),
    },
    {
      rest: circleCubic(18, 17.5, 1.4),
      morph: sparkleCubic(18.2, 17.6, 2.8, 0.22),
      filled: true,
    },
  ],

  swapChain: [
    {
      rest: polyPath([[4.5, 9], [18.5, 9]]),
      morph: polyPath([[5.5, 9], [20, 9]]),
    },
    {
      rest: polyPath([[15, 5.5], [18.5, 9], [15, 12.5]]),
      morph: polyPath([[16.5, 5.5], [20, 9], [16.5, 12.5]]),
    },
    {
      rest: polyPath([[19.5, 15], [5.5, 15]]),
      morph: polyPath([[18.5, 15], [4, 15]]),
    },
    {
      rest: polyPath([[9, 11.5], [5.5, 15], [9, 18.5]]),
      morph: polyPath([[7.5, 11.5], [4, 15], [7.5, 18.5]]),
    },
  ],

  eraserSweep: [
    {
      rest: polyPath([[14.5, 4.5], [20, 10], [11.5, 18.5], [5.5, 18.5], [4, 17]], true),
      morph: polyPath([[15.5, 4], [21, 9.5], [12, 18.5], [6.5, 18.5], [5, 17]], true),
    },
    {
      rest: polyPath([[11.5, 18.5], [20, 18.5]]),
      morph: polyPath([[14, 18.5], [20.5, 18.5]]),
    },
  ],

  plusCreate: [
    {
      rest: polyPath([[12, 5.5], [12, 18.5]]),
      morph: polyPath([[12, 4.2], [12, 19.8]]),
    },
    {
      rest: polyPath([[5.5, 12], [18.5, 12]]),
      morph: polyPath([[4.2, 12], [19.8, 12]]),
    },
  ],

  editPen: [
    {
      rest: polyPath([[15.5, 4.5], [19.5, 8.5], [8.5, 19.5], [4.5, 19.5], [4.5, 15.5]], true),
      morph: polyPath([[16.2, 3.8], [20.2, 7.8], [8.2, 19.8], [4, 20], [4.2, 15.8]], true),
    },
    {
      rest: polyPath([[13, 7], [17, 11]]),
      morph: polyPath([[13.7, 6.3], [17.7, 10.3]]),
    },
  ],

  trashBin: [
    {
      rest: polyPath([[4.5, 7], [19.5, 7]]),
      morph: polyPath([[4.2, 5.8], [19.6, 4.6]]),
    },
    {
      rest: polyPath([[9.5, 7], [9.5, 4.5], [14.5, 4.5], [14.5, 7]]),
      morph: polyPath([[9.2, 5.4], [9, 3.2], [14, 2.8], [14.2, 5]]),
    },
    {
      rest: polyPath([[6.5, 7.5], [7.5, 19.5], [16.5, 19.5], [17.5, 7.5]]),
      morph: polyPath([[6.5, 8], [7.5, 19.8], [16.5, 19.8], [17.5, 8]]),
    },
    {
      rest: polyPath([[10.5, 11], [10.5, 16.5]]),
      morph: polyPath([[10.5, 11.2], [10.5, 16.8]]),
    },
    {
      rest: polyPath([[13.5, 11], [13.5, 16.5]]),
      morph: polyPath([[13.5, 11.2], [13.5, 16.8]]),
    },
  ],

  /* 4. Providers, Security & System Hardware */
  shieldCheck: [
    {
      rest: 'M 12 3 L 19.5 6.2 C 19.5 13.2 16.5 18 12 21 C 7.5 18 4.5 13.2 4.5 6.2 L 12 3 Z',
      morph: 'M 12 2.6 L 20 6 C 20 13.5 16.8 18.4 12 21.4 C 7.2 18.4 4 13.5 4 6 L 12 2.6 Z',
    },
    {
      rest: polyPath([[8.6, 12.1], [11.1, 14.6], [15.8, 9.9]]),
      morph: polyPath([[8.3, 12.1], [11, 14.8], [16.1, 9.7]]),
    },
  ],

  keyVault: [
    {
      rest: circleCubic(8.2, 12, 4.2),
      morph: circleCubic(7.8, 12, 4.5),
    },
    {
      rest: polyPath([[12.4, 12], [20.5, 12], [20.5, 15.2]]),
      morph: polyPath([[12.3, 12], [21.2, 12], [21.2, 15.8]]),
    },
    {
      rest: polyPath([[16.8, 12], [16.8, 14.6]]),
      morph: polyPath([[17.2, 12], [17.2, 15.2]]),
    },
  ],

  serverStack: [
    {
      rest: roundedRectCubic(3.5, 4.5, 17, 6.2, 2),
      morph: roundedRectCubic(3.2, 4.2, 17.6, 6.4, 2.2),
    },
    {
      rest: roundedRectCubic(3.5, 13.3, 17, 6.2, 2),
      morph: roundedRectCubic(3.2, 13.4, 17.6, 6.4, 2.2),
    },
    {
      rest: circleCubic(7.2, 7.6, 1),
      morph: circleCubic(7.6, 7.4, 1.25),
      filled: true,
    },
    {
      rest: circleCubic(7.2, 16.4, 1),
      morph: circleCubic(7.6, 16.6, 1.25),
      filled: true,
    },
  ],

  tuneSliders: [
    { rest: polyPath([[4, 8.5], [20, 8.5]]), morph: polyPath([[4, 8.5], [20, 8.5]]) },
    { rest: circleCubic(9.5, 8.5, 2.3), morph: circleCubic(14.8, 8.5, 2.4), filled: true },
    { rest: polyPath([[4, 15.5], [20, 15.5]]), morph: polyPath([[4, 15.5], [20, 15.5]]) },
    { rest: circleCubic(14.8, 15.5, 2.3), morph: circleCubic(9.5, 15.5, 2.4), filled: true },
  ],

  probeFlask: [
    {
      rest: polyPath([[9.5, 3.5], [14.5, 3.5]]),
      morph: polyPath([[9, 3.5], [15, 3.5]]),
    },
    {
      rest: polyPath([[10.5, 3.5], [10.5, 8.6], [5.2, 17.78], [6.5, 20.03], [17.5, 20.03], [18.8, 17.78], [13.5, 8.6], [13.5, 3.5]], true),
      morph: polyPath([[10.5, 3.5], [10.5, 8.4], [4.8, 17.8], [6.2, 20.2], [17.8, 20.2], [19.2, 17.8], [13.5, 8.4], [13.5, 3.5]], true),
    },
    {
      rest: 'M 7.6 14.8 C 9.8 13.8 14.2 15.8 16.4 14.8',
      morph: 'M 7.4 14.5 C 9.8 15.8 14.2 13.4 16.6 14.5',
    },
  ],

  syncArrows: [
    {
      rest: arcCubic(12, 12, 8, -155, -20, 2),
      morph: arcCubic(12, 12, 8.2, -135, 0, 2),
    },
    {
      rest: polyPath([[16.5, 4.8], [19.6, 8.8], [15.4, 9.2]]),
      morph: polyPath([[18.4, 7.8], [20.2, 12], [16, 11.4]]),
    },
    {
      rest: arcCubic(12, 12, 8, 25, 160, 2),
      morph: arcCubic(12, 12, 8.2, 45, 180, 2),
    },
    {
      rest: polyPath([[7.5, 19.2], [4.4, 15.2], [8.6, 14.8]]),
      morph: polyPath([[5.6, 16.2], [3.8, 12], [8, 12.6]]),
    },
  ],

  externalLaunch: [
    {
      rest: polyPath([[13, 5], [19, 5], [19, 11]]),
      morph: polyPath([[13.8, 4.2], [19.8, 4.2], [19.8, 10.2]]),
    },
    {
      rest: polyPath([[10.5, 13.5], [19, 5]]),
      morph: polyPath([[10, 14], [19.8, 4.2]]),
    },
    {
      rest: polyPath([[19, 14.5], [19, 19], [5, 19], [5, 5], [9.5, 5]]),
      morph: polyPath([[19, 14.5], [19, 19.2], [4.8, 19.2], [4.8, 4.8], [9.5, 4.8]]),
    },
  ],

  offlineCloud: [
    {
      rest: 'M 6.5 17.5 L 18 17.5 C 20.2 17.5 21.5 15.8 21 13.8 C 20.6 12.2 19 11.2 17.5 11.2 C 16.8 7.8 13.8 6 10.5 6.8 C 7.8 7.4 6.2 9.8 6.2 12.2 C 4.4 12.6 3.5 14.4 4.2 16 C 4.6 17 5.5 17.5 6.5 17.5 Z',
      morph: 'M 6.2 17.8 L 18.2 17.8 C 20.4 17.8 21.8 16 21.2 13.8 C 20.8 12 19.2 11 17.6 11 C 16.8 7.5 13.8 5.8 10.4 6.6 C 7.6 7.2 6 9.6 6 12.2 C 4.2 12.6 3.2 14.4 4 16.2 C 4.4 17.2 5.3 17.8 6.2 17.8 Z',
    },
    {
      rest: polyPath([[4, 4], [20, 20]]),
      morph: polyPath([[3.5, 3.5], [20.5, 20.5]]),
    },
  ],

  keyboardDeck: [
    {
      rest: roundedRectCubic(2.5, 5.5, 19, 13, 2.8),
      morph: roundedRectCubic(2.5, 5.2, 19, 13.6, 3),
    },
    { rest: polyPath([[6.5, 9.5], [8, 9.5]]), morph: polyPath([[6.5, 9.5], [8.2, 9.5]]) },
    { rest: polyPath([[11.2, 9.5], [12.8, 9.5]]), morph: polyPath([[11.2, 9.5], [12.8, 9.5]]) },
    { rest: polyPath([[16, 9.5], [17.5, 9.5]]), morph: polyPath([[15.8, 9.5], [17.5, 9.5]]) },
    {
      rest: polyPath([[7.5, 14.5], [16.5, 14.5]]),
      morph: polyPath([[7, 15.2], [17, 15.2]]),
    },
  ],

  windowLaunch: [
    {
      rest: roundedRectCubic(3, 4, 18, 12.5, 2.6),
      morph: roundedRectCubic(2.8, 3.8, 18.4, 12.8, 2.8),
    },
    {
      rest: polyPath([[8.5, 20], [15.5, 20]]),
      morph: polyPath([[8, 20.2], [16, 20.2]]),
    },
    {
      rest: polyPath([[12, 13.5], [12, 8]]),
      morph: polyPath([[12, 12.8], [12, 6.8]]),
    },
    {
      rest: polyPath([[9.5, 10.3], [12, 7.8], [14.5, 10.3]]),
      morph: polyPath([[9.5, 9.1], [12, 6.6], [14.5, 9.1]]),
    },
  ],

  motionEase: [
    {
      rest: circleCubic(12, 12, 9),
      morph: circleCubic(12, 12, 9.3),
    },
    {
      rest: circleCubic(12, 7.4, 1.3),
      morph: circleCubic(12, 7.1, 1.45),
      filled: true,
    },
    {
      rest: polyPath([[7.5, 10.5], [12, 11.2], [16.5, 10.5]]),
      morph: polyPath([[7.2, 9.6], [12, 10.8], [16.8, 9.6]]),
    },
    {
      rest: polyPath([[10, 17.2], [12, 13.2], [14, 17.2]]),
      morph: polyPath([[9.6, 17.5], [12, 13], [14.4, 17.5]]),
    },
  ],

  saveVault: [
    {
      rest: polyPath([[5, 4], [16.5, 4], [19.5, 7], [19.5, 19.5], [5, 19.5]], true),
      morph: polyPath([[4.8, 3.8], [16.8, 3.8], [19.8, 6.8], [19.8, 19.8], [4.8, 19.8]], true),
    },
    {
      rest: roundedRectCubic(8, 4, 7, 4.5, 1),
      morph: roundedRectCubic(8, 4.4, 7, 5, 1.2),
    },
    {
      rest: roundedRectCubic(7.5, 12.5, 9, 7, 1.4),
      morph: roundedRectCubic(7.5, 12.2, 9, 7.6, 1.6),
    },
  ],

  resetArc: [
    {
      rest: arcCubic(12, 12, 8, -145, 135, 3),
      morph: arcCubic(12, 12, 8.3, -165, 120, 3),
    },
    {
      rest: polyPath([[4.5, 4.8], [4.8, 9.4], [9.4, 9]]),
      morph: polyPath([[3.8, 6], [4.2, 10.6], [8.8, 10]]),
    },
  ],

  /* 5. Status, Telemetry & Directional Vectors */
  terminalPrompt: [
    {
      rest: polyPath([[5, 7], [10, 12], [5, 17]]),
      morph: polyPath([[5.8, 6.8], [11, 12], [5.8, 17.2]]),
    },
    {
      rest: polyPath([[12.2, 17], [19, 17]]),
      morph: polyPath([[13, 17], [19.8, 17]]),
    },
  ],

  clockPulse: [
    {
      rest: circleCubic(12, 12, 8.8),
      morph: circleCubic(12, 12, 9.1),
    },
    {
      rest: polyPath([[12, 7.2], [12, 12], [15.5, 14.02]]),
      morph: polyPath([[12, 6.8], [12, 12], [16.4, 12]]),
    },
  ],

  boltInstant: [
    {
      rest: polyPath([[13.2, 2.8], [5.5, 13.2], [11.6, 13.2], [10.8, 21.2], [18.5, 10.8], [12.4, 10.8]], true),
      morph: polyPath([[13.8, 2.2], [5, 13.4], [11.8, 13.4], [10.2, 21.8], [19, 10.6], [12.2, 10.6]], true),
    },
  ],

  checkMark: [
    {
      rest: polyPath([[5, 12.4], [9.6, 17], [19, 7.6]]),
      morph: polyPath([[4.6, 12.4], [9.6, 17.4], [19.4, 7.6]]),
    },
  ],

  checkCircle: [
    {
      rest: circleCubic(12, 12, 9),
      morph: circleCubic(12, 12, 9.3),
    },
    {
      rest: polyPath([[8.2, 12.2], [10.8, 14.8], [16, 9.6]]),
      morph: polyPath([[7.9, 12.2], [10.8, 15.1], [16.3, 9.6]]),
    },
  ],

  alertCircle: [
    {
      rest: circleCubic(12, 12, 9),
      morph: circleCubic(12, 12, 9.3),
    },
    {
      rest: polyPath([[12, 7.8], [12, 12.8]]),
      morph: polyPath([[12, 7.2], [12, 13]]),
    },
    {
      rest: circleCubic(12, 16.2, 0.9),
      morph: circleCubic(12, 16.4, 1.15),
      filled: true,
    },
  ],

  alertTriangle: [
    {
      rest: polyPath([[12, 3.8], [20.8, 19.04], [3.2, 19.04]], true),
      morph: polyPath([[12, 3.2], [21.2, 19.13], [2.8, 19.13]], true),
    },
    {
      rest: polyPath([[12, 9.5], [12, 13.8]]),
      morph: polyPath([[12, 9], [12, 14]]),
    },
    {
      rest: circleCubic(12, 16.8, 0.85),
      morph: circleCubic(12, 17, 1.1),
      filled: true,
    },
  ],

  infoCircle: [
    {
      rest: circleCubic(12, 12, 9),
      morph: circleCubic(12, 12, 9.3),
    },
    {
      rest: polyPath([[12, 11.2], [12, 16.4]]),
      morph: polyPath([[12, 10.8], [12, 16.8]]),
    },
    {
      rest: circleCubic(12, 8, 0.9),
      morph: circleCubic(12, 7.8, 1.15),
      filled: true,
    },
  ],

  xCircle: [
    {
      rest: circleCubic(12, 12, 9),
      morph: circleCubic(12, 12, 9.3),
    },
    {
      rest: polyPath([[9, 9], [15, 15]]),
      morph: polyPath([[8.6, 8.6], [15.4, 15.4]]),
    },
    {
      rest: polyPath([[15, 9], [9, 15]]),
      morph: polyPath([[15.4, 8.6], [8.6, 15.4]]),
    },
  ],

  closeX: [
    {
      rest: polyPath([[6.5, 6.5], [17.5, 17.5]]),
      morph: polyPath([[5.8, 5.8], [18.2, 18.2]]),
    },
    {
      rest: polyPath([[17.5, 6.5], [6.5, 17.5]]),
      morph: polyPath([[18.2, 5.8], [5.8, 18.2]]),
    },
  ],

  spinnerRing: [
    {
      rest: arcCubic(12, 12, 8.5, -90, 175, 3),
      morph: arcCubic(12, 12, 8.5, -90, 175, 3),
    },
  ],

  arrowRight: [
    {
      rest: polyPath([[5, 12], [18.5, 12]]),
      morph: polyPath([[4.5, 12], [20, 12]]),
    },
    {
      rest: polyPath([[13, 6.5], [18.5, 12], [13, 17.5]]),
      morph: polyPath([[14.5, 6.5], [20, 12], [14.5, 17.5]]),
    },
  ],

  arrowLeft: [
    {
      rest: polyPath([[19, 12], [5.5, 12]]),
      morph: polyPath([[19.5, 12], [4, 12]]),
    },
    {
      rest: polyPath([[11, 6.5], [5.5, 12], [11, 17.5]]),
      morph: polyPath([[9.5, 6.5], [4, 12], [9.5, 17.5]]),
    },
  ],

  arrowUpRight: [
    {
      rest: polyPath([[7, 17], [17, 7]]),
      morph: polyPath([[6.5, 17.5], [18.2, 5.8]]),
    },
    {
      rest: polyPath([[9.5, 7], [17, 7], [17, 14.5]]),
      morph: polyPath([[10.5, 5.8], [18.2, 5.8], [18.2, 13.5]]),
    },
  ],
}
