/**
 * SelectionController - tracks hex hover/selection state (RPD interaction layer).
 *
 * Logic-only: holds the currently hovered and selected hex. The view layer
 * (GameScreen) forwards pointer events into here and reacts to the emitted
 * changes to draw hover/selection rings and update the tooltip.
 *
 * Scope (Milestone 2): single-hex inspection only. The RPD's multi-hex priority
 * panel (up to three Attack/Defend hexes) is deferred to Milestone 6.
 */

import type { Axial } from "./hex/hexMath";

export type HexRef = Axial;

type ChangeCb = (hex: HexRef | null) => void;

export class SelectionController {
  private selected: HexRef | null = null;
  private hovered: HexRef | null = null;

  private readonly selectionListeners = new Set<ChangeCb>();
  private readonly hoverListeners = new Set<ChangeCb>();

  public update(): void {
    // No per-frame work yet; reserved for future cooldowns/animations.
  }

  /** Select a hex (left-click). Replaces any prior selection. */
  public select(hex: HexRef): void {
    if (this.selected?.q === hex.q && this.selected?.r === hex.r) return;
    this.selected = { q: hex.q, r: hex.r };
    this.emit(this.selectionListeners, this.selected);
  }

  /** Set the hovered hex (or null when the pointer leaves the grid). */
  public hover(hex: HexRef | null): void {
    if (this.hovered) {
      if (hex && this.hovered.q === hex.q && this.hovered.r === hex.r) return;
    } else if (!hex) {
      return;
    }
    this.hovered = hex ? { q: hex.q, r: hex.r } : null;
    this.emit(this.hoverListeners, this.hovered);
  }

  public clearSelection(): void {
    if (!this.selected) return;
    this.selected = null;
    this.emit(this.selectionListeners, this.selected);
  }

  public getSelected(): HexRef | null {
    return this.selected;
  }

  public getHovered(): HexRef | null {
    return this.hovered;
  }

  public onSelectionChange(cb: ChangeCb): void {
    this.selectionListeners.add(cb);
  }

  public onHoverChange(cb: ChangeCb): void {
    this.hoverListeners.add(cb);
  }

  private emit(listeners: Set<ChangeCb>, hex: HexRef | null): void {
    listeners.forEach((cb) => cb(hex));
  }
}
