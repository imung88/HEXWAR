/**
 * Color utilities for tinting and shading.
 */

/** Darken a hex color by reducing each RGB channel by the given factor (0–1). */
export function darkenColor(color: number, factor = 0.5): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (
    (Math.round(r * factor) << 16) |
    (Math.round(g * factor) << 8) |
    Math.round(b * factor)
  );
}