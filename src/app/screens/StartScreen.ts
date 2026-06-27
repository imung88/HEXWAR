import type { AnimationPlaybackControls, ObjectTarget } from "motion/react";
import { animate } from "motion";
import type { Ticker } from "pixi.js";
import { Container, Text } from "pixi.js";

import { engine } from "../getEngine";
import { Button } from "../ui/Button";
import { GameScreen } from "./game/GameScreen";

/**
 * Start screen: title + a "Start Battle" button that navigates to the
 * GameScreen with the hex map.
 */
export class StartScreen extends Container {
  /**
   * Assets bundles required by this screen.
   * The main bundle contains the button.png spritesheet frame used by Button.
   */
  public static assetBundles = ["main"];

  private title: Text;
  private subtitle: Text;
  private startButton: Button;
  private paused = false;

  constructor() {
    super();

    this.title = new Text({
      text: "HEXWAR",
      style: {
        fontFamily: "Arial",
        fontSize: 96,
        fontWeight: "bold",
        fill: 0xffffff,
        align: "center",
      },
    });
    this.title.anchor.set(0.5);
    this.addChild(this.title);

    this.subtitle = new Text({
      text: "A hex-based RTS",
      style: {
        fontFamily: "Arial",
        fontSize: 28,
        fill: 0xbbbbbb,
        align: "center",
      },
    });
    this.subtitle.anchor.set(0.5);
    this.addChild(this.subtitle);

    this.startButton = new Button({
      text: "Start Battle",
      width: 320,
      height: 120,
      fontSize: 32,
    });
    this.startButton.onPress.connect(() =>
      engine().navigation.showScreen(GameScreen),
    );
    this.addChild(this.startButton);
  }

  /** Prepare the screen just before showing */
  public prepare() {}

  /** Update the screen */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public update(_time: Ticker) {
    if (this.paused) return;
  }

  /** Pause gameplay - automatically fired when a popup is presented */
  public async pause() {
    this.interactiveChildren = false;
    this.paused = true;
  }

  /** Resume gameplay */
  public async resume() {
    this.interactiveChildren = true;
    this.paused = false;
  }

  /** Fully reset */
  public reset() {}

  /** Resize the screen, fired whenever window size changes */
  public resize(width: number, height: number) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;

    this.title.position.set(centerX, centerY - 160);
    this.subtitle.position.set(centerX, centerY - 80);
    this.startButton.position.set(centerX, centerY + 80);
  }

  /** Show screen with animations */
  public async show(): Promise<void> {
    const elements = [this.title, this.subtitle, this.startButton];

    let finalPromise!: AnimationPlaybackControls;
    for (const element of elements) {
      element.alpha = 0;
      finalPromise = animate(
        element,
        { alpha: 1 } as ObjectTarget<typeof element>,
        { duration: 0.4, delay: 0.2, ease: "backOut" },
      );
    }

    await finalPromise;
  }

  /** Hide screen with animations */
  public async hide(): Promise<void> {
    await animate(this, { alpha: 0 } as ObjectTarget<this>, {
      duration: 0.3,
      ease: "linear",
    });
    this.alpha = 1;
  }

  /** Auto pause the app when window go out of focus */
  public blur() {}
}
