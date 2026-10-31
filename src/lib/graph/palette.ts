/**
 * Palette entries use the exact style strings diagrams.net uses, so shapes
 * dropped here look the same when the file is opened in draw.io.
 */
export interface PaletteItem {
  id: string;
  title: string;
  style: string;
  width: number;
  height: number;
  value?: string;
  /** Inserts a free-standing edge instead of a vertex. */
  edge?: boolean;
  /** A multi-cell item (e.g. a UML class with rows), as an <mxGraphModel> snippet. */
  xml?: string;
  /** Extra words search matches (part numbers, synonyms). */
  tags?: string;
}

export interface PaletteSection {
  id: string;
  title: string;
  items: PaletteItem[];
  /** Show items as named rows rather than a grid of previews (blocks that look alike). */
  list?: boolean;
}

/** draw.io's default style for connections drawn between shapes. */
export const DEFAULT_EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;';

export { ALL_PALETTES as PALETTES, DEFAULT_LIBRARIES } from './palettes';
