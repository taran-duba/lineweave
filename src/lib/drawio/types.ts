export interface Point {
  x: number;
  y: number;
}

export type Attrs = Record<string, string>;

export interface GeometryData {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  relative?: boolean;
  points?: Point[];
  sourcePoint?: Point;
  targetPoint?: Point;
  offset?: Point;
  /** mxGeometry attributes we don't model, kept verbatim. */
  attrs?: Attrs;
  /** mxGeometry children we don't model (e.g. alternateBounds), as raw XML. */
  extraChildren?: string[];
}

export interface CellData {
  id: string;
  parent?: string;
  value?: string;
  style?: string;
  vertex?: boolean;
  edge?: boolean;
  source?: string;
  target?: string;
  geometry?: GeometryData;
  /** Fractional index ordering the cell among its siblings. */
  order: string;
  /** Set when the cell is wrapped in <object>/<UserObject> carrying custom data. */
  objTag?: string;
  objAttrs?: Attrs;
  /** mxCell attributes we don't model (connectable, visible, collapsed, ...). */
  attrs?: Attrs;
  extraChildren?: string[];
}

export interface PageData {
  id: string;
  name: string;
  order: string;
  /** Extra <diagram> attributes. */
  attrs: Attrs;
  /** <mxGraphModel> attributes (grid, gridSize, pageWidth, background, ...). */
  modelAttrs: Attrs;
  cells: CellData[];
}

export interface FileData {
  /** <mxfile> attributes. */
  attrs: Attrs;
  pages: PageData[];
}
