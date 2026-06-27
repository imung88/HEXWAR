/**
 * TopBar - HUD bar showing per-faction gold/oil, income/min, maintenance drain.
 *
 * Uses a runtime-installed bitmap font (dynamicFill) so per-tick string updates
 * only reposition glyph quads — no canvas re-draw (RPD performance note).
 *
 * Reads prepared FactionEconomyState from the GameController; GameScreen calls
 * `update()` after each economy tick.
 */

import { BitmapFont, BitmapText, Container, Graphics } from "pixi.js";

import { HUD_FONT_NAME, UI_COLORS } from "../../game/config/GameConfig";
import type { FactionEconomyState } from "../../game/economy/EconomySystem";

let fontInstalled = false;

/** Install the HUD bitmap font once (dynamicFill allows per-instance fill). */
function ensureFont(): void {
  if (fontInstalled) return;
  try {
    BitmapFont.install({
      name: HUD_FONT_NAME,
      style: {
        fontFamily: "Arial",
        fontSize: 18,
        fill: 0xffffff,
      },
      dynamicFill: true,
    });
  } catch {
    // Already installed under this name; safe to ignore.
  }
  fontInstalled = true;
}

export interface TopBarUpdate {
  friendly: FactionEconomyState;
  enemy: FactionEconomyState;
  tickMs: number;
}

export class TopBar extends Container {
  private readonly friendlyLabel: BitmapText;
  private readonly enemyLabel: BitmapText;
  private readonly title: BitmapText;
  private readonly bg: Graphics;
  private barWidth: number;
  private barHeight: number;

  constructor() {
    super();
    ensureFont();

    this.barWidth = 520;
    this.barHeight = 70;

    this.bg = new Graphics();
    this.addChild(this.bg);

    this.title = new BitmapText({
      text: "HEXWAR",
      style: { fontFamily: HUD_FONT_NAME, fontSize: 18, fill: UI_COLORS.gold },
    });
    this.title.anchor.set(0.5);
    this.addChild(this.title);

    this.friendlyLabel = new BitmapText({
      text: "",
      style: {
        fontFamily: HUD_FONT_NAME,
        fontSize: 18,
        fill: UI_COLORS.friendly,
      },
    });
    this.addChild(this.friendlyLabel);

    this.enemyLabel = new BitmapText({
      text: "",
      style: { fontFamily: HUD_FONT_NAME, fontSize: 18, fill: UI_COLORS.enemy },
    });
    this.addChild(this.enemyLabel);

    this.drawBackground();
  }

  private drawBackground(): void {
    this.bg.clear();
    this.bg
      .roundRect(0, 0, this.barWidth, this.barHeight, 8)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.85 })
      .stroke({ width: 1.5, color: UI_COLORS.panelBorder });
  }

  /** Refresh displayed values from economy state. */
  public update(data: TopBarUpdate): void {
    const perMin = 60000 / data.tickMs;
    this.friendlyLabel.text = this.formatLine(
      "FRIENDLY",
      data.friendly,
      perMin,
      UI_COLORS.friendly,
    );
    this.enemyLabel.text = this.formatLine(
      "ENEMY",
      data.enemy,
      perMin,
      UI_COLORS.enemy,
    );
  }

  private formatLine(
    label: string,
    state: FactionEconomyState,
    perMin: number,
    fill: number,
  ): string {
    // Bitmap text with dynamicFill is colored per-instance via fill override;
    // but multi-color within one string isn't supported, so we keep one color.
    void fill;
    const goldIn = Math.round(state.income.gold * perMin);
    const oilIn = Math.round(state.income.oil * perMin);
    const goldMaint = Math.round(state.maintenance.gold * perMin);
    const oilMaint = Math.round(state.maintenance.oil * perMin);
    return `${label}  G:${Math.floor(state.gold)} (+${goldIn}/min -${goldMaint})  O:${Math.floor(state.oil)} (+${oilIn}/min -${oilMaint})`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public resize(width: number, _height: number): void {
    this.title.position.set(this.barWidth * 0.5, 14);
    this.friendlyLabel.position.set(12, 32);
    this.enemyLabel.position.set(12, 52);
    // Anchor the bar to top-center of the viewport.
    this.position.set(Math.round((width - this.barWidth) * 0.5), 8);
  }
}
