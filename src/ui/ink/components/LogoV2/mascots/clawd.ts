/**
 * Clawd — 紫色方块吉祥物（默认角色）
 */

import type { MascotDefinition } from './types.js';

export const clawdMascot: MascotDefinition = {
  id: 'clawd',
  name: 'Clawd',
  color: 'magenta',
  bgColor: 'magentaBright',
  poses: {
    default:      { r1L: ' ▐', r1E: '▛███▜', r1R: '▌', r2L: '▝▜', r2R: '▛▘' },
    'look-left':  { r1L: ' ▐', r1E: '▟███▟', r1R: '▌', r2L: '▝▜', r2R: '▛▘' },
    'look-right': { r1L: ' ▐', r1E: '▙███▙', r1R: '▌', r2L: '▝▜', r2R: '▛▘' },
    'arms-up':    { r1L: '▗▟', r1E: '▛███▜', r1R: '▙▖', r2L: ' ▜', r2R: '▛ ' },
  },
  appleEyes: {
    default:      ' ▗   ▖ ',
    'look-left':  ' ▘   ▘ ',
    'look-right': ' ▝   ▝ ',
    'arms-up':    ' ▗   ▖ ',
  },
  bodyFill: '█████',
  footRow: '  ▘▘ ▝▝  ',
};
