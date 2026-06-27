/**
 * Pointy-top axial hex math.
 *
 * Pure logic, no PixiJS dependency. Used by HexGrid (data) and HexGridView (render).
 */

/** Axial coordinate. */
export interface Axial {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Convert axial coordinates to pixel space (pointy-top hexes).
 * x = size * sqrt(3) * (q + r/2)
 * y = size * 1.5 * r
 */
export function hexToPixel(q: number, r: number, size: number): Point {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * 1.5 * r;
  return { x, y };
}

/**
 * Six vertex coordinates of a pointy-top hex centered at the origin.
 * Returns a flat array suitable for PixiJS Graphics.poly(): [x0,y0,x1,y1,...].
 * First vertex at angle PI/6, stepping PI/3.
 */
export function hexPolygonPoints(size: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i;
    points.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return points;
}

/**
 * Pixel bounds of a rhombus map covering q in [0,width), r in [0,height).
 * Computes min/max over all hex centers. Useful for centering the grid.
 */
export function gridPixelBounds(
  width: number,
  height: number,
  size: number,
): Bounds {
  const limit = (size * Math.sqrt(3)) / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let r = 0; r < height; r++) {
    for (let q = 0; q < width; q++) {
      const { x, y } = hexToPixel(q, r, size);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Expand by one hex span so tile edges (not just centers) are inside bounds.
  return {
    minX: minX - limit,
    minY: minY - size,
    maxX: maxX + limit,
    maxY: maxY + size,
  };
}
