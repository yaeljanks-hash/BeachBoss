import { GAME_WIDTH, DEPTH, SHIFT } from '../config.js';
import { drawCoin } from './icons.js';
import ProgressBar from './ProgressBar.js';

const PANEL_ALPHA = 0.28;
const WHITE = '#ffffff';
const GOLD = '#ffe082';
const GREEN = '#b9f6ca';
const RED = '#ff8a80';

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Gameplay HUD. Fixed to the screen (scroll factor 0), so it stays put while the
 * camera scrolls across the beach.
 *   Left panel:  level, shift countdown, guests served / lost
 *   Right panel: shift revenue vs target (with progress bar), total coins
 *   Centre:      hint line under the title
 */
export default class Hud {
  constructor(scene, level) {
    this.scene = scene;
    const add = obj => obj.setDepth(DEPTH.hud).setScrollFactor(0);

    // --- Left panel: level and time -----------------------------------------
    const left = add(scene.add.graphics());
    left.fillStyle(0x000000, PANEL_ALPHA);
    left.fillRoundedRect(14, 10, 158, 78, 14);

    add(scene.add.text(28, 24, `LEVEL ${level.id}`, { fontSize: '15px', color: GOLD, fontStyle: 'bold' }).setOrigin(0, 0.5));

    const clock = add(scene.add.graphics());
    clock.fillStyle(0xffffff);
    clock.fillCircle(0, 0, 9);
    clock.lineStyle(2, 0x37474f);
    clock.strokeCircle(0, 0, 9);
    clock.lineBetween(0, 0, 0, -6);
    clock.lineBetween(0, 0, 4, 2);
    clock.setPosition(37, 50);

    this.timeText = add(scene.add.text(52, 50, '', { fontSize: '22px', color: WHITE, fontStyle: 'bold' }).setOrigin(0, 0.5));
    this.statsText = add(scene.add.text(28, 75, '', { fontSize: '13px', color: WHITE }).setOrigin(0, 0.5));
    this.lowTime = false;

    // --- Right panel: revenue vs target -------------------------------------
    const right = add(scene.add.graphics());
    right.fillStyle(0x000000, PANEL_ALPHA);
    right.fillRoundedRect(GAME_WIDTH - 186, 10, 172, 78, 14);

    const coin = add(scene.add.graphics());
    drawCoin(coin, 0, 0, 11);
    coin.setPosition(GAME_WIDTH - 164, 28);
    this.coinIcon = coin;

    this.revenueText = add(
      scene.add.text(GAME_WIDTH - 147, 28, '', { fontSize: '20px', color: WHITE, fontStyle: 'bold' }).setOrigin(0, 0.5)
    );
    this.targetBar = add(new ProgressBar(scene, GAME_WIDTH - 100, 52, 144, 8, 0xffca28)).setVisible(true);
    scene.add.existing(this.targetBar);
    this.totalText = add(scene.add.text(GAME_WIDTH - 172, 75, '', { fontSize: '13px', color: WHITE }).setOrigin(0, 0.5));

    // --- Hint line ----------------------------------------------------------
    this.hintText = add(
      scene.add
        .text(GAME_WIDTH / 2, 92, '', { fontSize: '18px', color: WHITE, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setStroke('#1b4f72', 4)
        .setShadow(1, 1, '#0d2c40', 2)
    );
  }

  /** Where flying coins should land, in screen coordinates. */
  get coinTarget() {
    return { x: this.coinIcon.x, y: this.coinIcon.y };
  }

  setTime(ms) {
    this.timeText.setText(formatTime(ms));
    const low = ms <= SHIFT.lowTimeWarningMs;
    if (low === this.lowTime) return;
    this.lowTime = low;
    this.timeText.setColor(low ? RED : WHITE);
    this.scene.tweens.killTweensOf(this.timeText);
    this.timeText.setScale(1);
    if (low) this.scene.tweens.add({ targets: this.timeText, scale: 1.12, duration: 350, yoyo: true, repeat: -1 });
  }

  setRevenue(revenue, target, bump = false) {
    this.revenueText.setText(`${revenue} / ${target}`);
    this.revenueText.setColor(revenue >= target ? GREEN : WHITE);
    this.targetBar.color = revenue >= target ? 0x66bb6a : 0xffca28;
    this.targetBar.setProgress(revenue / target);
    if (bump) this.bump([this.revenueText, this.coinIcon]);
  }

  setStats(served, lost) {
    this.statsText.setText(`Served ${served}  ·  Lost ${lost}`);
  }

  setTotalCoins(total) {
    this.totalText.setText(`Total coins: ${total}`);
  }

  setHint(text) {
    if (this.hintText.text !== text) this.hintText.setText(text);
  }

  bump(targets) {
    this.scene.tweens.killTweensOf(targets);
    targets.forEach(t => t.setScale(1));
    this.scene.tweens.add({ targets, scale: 1.3, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }
}
