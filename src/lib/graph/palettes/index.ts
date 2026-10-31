import type { PaletteSection } from '../palette';
import { CORE_PALETTES } from './core';
import { PASSIVES_SECTION, SEMIS_SECTION, SWITCHES_SECTION, WIRES_SECTION } from './electrical';
import { EXTRA_PALETTES } from './extra';
import { FRC_PALETTES } from './frc';

export const ALL_PALETTES: PaletteSection[] = [
  ...CORE_PALETTES,
  ...EXTRA_PALETTES,
  WIRES_SECTION,
  PASSIVES_SECTION,
  SEMIS_SECTION,
  SWITCHES_SECTION,
  ...FRC_PALETTES,
];

/** Libraries shown until the user picks others. */
export const DEFAULT_LIBRARIES = ['general', 'flowchart'];
