/**
 * Cat — 橙色小猫吉祥物
 */

import type { MascotDefinition } from './types.js';

export const catMascot: MascotDefinition = {
  id: 'cat',
  name: 'Cat',
  color: 'yellow',
  bgColor: 'yellowBright',
  poses: {
    default:      { r1L: ' ╱', r1E: '◉ ▼ ◉', r1R: '╲', r2L: '▝▜', r2R: '▛▘' },
    'look-left':  { r1L: ' ╱', r1E: '◉ ▼ ·', r1R: '╲', r2L: '▝▜', r2R: '▛▘' },
    'look-right': { r1L: ' ╱', r1E: '· ▼ ◉', r1R: '╲', r2L: '▝▜', r2R: '▛▘' },
    'arms-up':    { r1L: '╱╱', r1E: '◉ ▼ ◉', r1R: '╲╲', r2L: ' ▜', r2R: '▛ ' },
  },
  appleEyes: {
    default:      ' ◉   ◉ ',
    'look-left':  ' ◉   · ',
    'look-right': ' ·   ◉ ',
    'arms-up':    ' ◉   ◉ ',
  },
  bodyFill: '▓▓▓▓▓',
  footRow: '  ╰╯ ╰╯  ',
};
