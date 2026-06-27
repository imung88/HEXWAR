/**
 * Legend - overlay panel documenting map colors and glyphs (RPD UI element).
 *
 * Explains owner colors (friendly/neutral/enemy), the river defense tint, the
 * victory-hex border, and resource-node glyphs (town=circle, city=square,
 * oilField=triangle). The sample shapes mirror HexGridView's drawing so the
 * legend matches what the player sees on the map.
 */

import { Container, Graphics, Text } from "pixi.js";

import {
  NODE_COLORS,
  OWNER_COLORS,
  RIVER_COLOR,
  UI_COLORS,
  VICTORY_BORDER_COLOR,
} from "../../game/config/GameConfig";
import type { NodeType, Owner } from "../../game/config/GameConfig";

interface LegendItem {
  draw: (g: Graphics, x: number, y: number) => void;
  label: string;
}

const HEX_PT_RADIUS = 9;
const NODE_R = 4;

function hexPoints(r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (Math.PI / 3) * i;
    pts.push(r * Math.cos(a), r * Math.sin(a));
  }
  return pts;
}

export class Legend extends Container {
  private readonly bg: Graphics;
  private panelWidth = 168;

  constructor() {
    super();

    this.bg = new Graphics();
    this.addChild(this.bg);

    const items = this.buildItems();
    this.layout(items);
  }

  private buildItems(): { g: Graphics; label: Text }[] {
    const makeSwatch = (draw: (g: Graphics) => void) => {
      const g = new Graphics();
      draw(g);
      return g;
    };

    const ownerList: Owner[] = ["friendly", "neutral", "enemy"];
    const ownerItems = ownerList.map<LegendItem>((owner) => ({
      draw: (g, x, y) =>
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS), x, y)).fill({
          color: OWNER_COLORS[owner],
        }),
      label: owner.charAt(0).toUpperCase() + owner.slice(1),
    }));

    const nodeTypes: NodeType[] = ["town", "city", "oilField"];
    const nodeLabels: Record<NodeType, string> = {
      town: "Town (gold)",
      city: "City (gold)",
      oilField: "Oil Field",
    };
    const nodeItems = nodeTypes.map<LegendItem>((type) => ({
      draw: (g, x, y) => {
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS), x, y)).fill({
          color: OWNER_COLORS.neutral,
          alpha: 0.5,
        });
        this.drawNode(g, type, x, y);
      },
      label: nodeLabels[type],
    }));

    const riverItem: LegendItem = {
      draw: (g, x, y) => {
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS), x, y)).fill({
          color: OWNER_COLORS.neutral,
          alpha: 0.5,
        });
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS * 0.7), x, y)).fill({
          color: RIVER_COLOR,
          alpha: 0.55,
        });
      },
      label: "River (+defense)",
    };

    const victoryItem: LegendItem = {
      draw: (g, x, y) => {
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS), x, y)).fill({
          color: OWNER_COLORS.friendly,
          alpha: 0.5,
        });
        g.poly(this.translate(hexPoints(HEX_PT_RADIUS), x, y)).stroke({
          width: 3,
          color: VICTORY_BORDER_COLOR,
        });
      },
      label: "Victory hex",
    };

    const all: LegendItem[] = [
      ...ownerItems,
      riverItem,
      victoryItem,
      ...nodeItems,
    ];

    return all.map((item) => ({
      g: makeSwatch((g) => item.draw(g, 0, 0)),
      label: new Text({
        text: item.label,
        style: {
          fontFamily: "Arial",
          fontSize: 12,
          fill: UI_COLORS.textPrimary,
        },
      }),
    }));
  }

  private drawNode(g: Graphics, type: NodeType, cx: number, cy: number): void {
    const color = NODE_COLORS[type];
    switch (type) {
      case "town":
        g.circle(cx, cy, NODE_R).fill({ color });
        break;
      case "city":
        g.rect(cx - NODE_R, cy - NODE_R, NODE_R * 2, NODE_R * 2).fill({
          color,
        });
        break;
      case "oilField":
        g.poly([
          cx,
          cy - NODE_R,
          cx + NODE_R,
          cy + NODE_R,
          cx - NODE_R,
          cy + NODE_R,
        ]).fill({ color });
        break;
    }
  }

  private translate(points: number[], dx: number, dy: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      out.push(points[i] + dx, points[i + 1] + dy);
    }
    return out;
  }

  private layout(items: { g: Graphics; label: Text }[]): void {
    const padX = 12;
    const padY = 10;
    const rowH = 22;
    const titleH = 22;

    const title = new Text({
      text: "Legend",
      style: {
        fontFamily: "Arial",
        fontSize: 14,
        fontWeight: "bold",
        fill: UI_COLORS.gold,
      },
    });
    title.anchor.set(0, 0.5);
    title.position.set(padX, padY + titleH * 0.5);
    this.addChild(title);

    const startY = padY + titleH;
    items.forEach((item, i) => {
      const y = startY + i * rowH;
      item.g.position.set(padX, y + rowH * 0.5);
      item.label.anchor.set(0, 0.5);
      item.label.position.set(padX + 28, y + rowH * 0.5);
      this.addChild(item.g, item.label);
    });

    const panelHeight = startY + items.length * rowH + padY;
    this.bg.clear();
    this.bg
      .roundRect(0, 0, this.panelWidth, panelHeight, 8)
      .fill({ color: UI_COLORS.panelBg, alpha: 0.82 })
      .stroke({ width: 1.5, color: UI_COLORS.panelBorder });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public resize(width: number, _height: number): void {
    // Anchor to top-right with a small margin.
    this.position.set(width - this.panelWidth - 10, 90);
  }
}
