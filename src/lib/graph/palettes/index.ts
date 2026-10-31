import type { PaletteSection } from '../palette';
import { CORE_PALETTES } from './core';
import { EXTRA_PALETTES } from './extra';

export const ALL_PALETTES: PaletteSection[] = [...CORE_PALETTES, ...EXTRA_PALETTES];

/** Libraries shown until the user picks others. */
export const DEFAULT_LIBRARIES = ['general', 'flowchart'];
