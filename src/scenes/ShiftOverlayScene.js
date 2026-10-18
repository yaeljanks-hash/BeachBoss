import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { LEVELS } from '../data/levels.js';
import { drawCoin } from '../ui/icons.js';
import ProgressBar from '../ui/ProgressBar.js';

const CARD_WIDTH = 440;
const CARD_HEIGHT = 330;

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Cards shown over the beach: the level intro before a shift, and the results
 * after it. Runs as its own scene so it keeps animating while the beach scene
 * is paused.
 *
 * Data: { mode: 'intro' | 'results', levelIndex, summary?, totalCoins?, earned? }
 */
export default class ShiftOverlayScene extends Phaser.Scene {
  constructor() {
    super('ShiftOverlay');
  }

  create(data) {
    this.levelIndex = data.levelIndex;
    this.level = LEVELS[data.levelIndex];
    this.actionTaken = false; // buttons fire once, even on a double tap

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b2233, 0.55);
    this.card = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.drawCard(data.mode === 'results' ? (data.summary.succeeded ? 0x2e7d32 : 0xc62828) : 0x0277bd);

    if (data.mode === 'results') this.buildResults(data);
    else this.buildIntro();

    // Pop the card in
    this.card.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: this.card, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
  }

  drawCard(accent) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-CARD_WIDTH / 2 + 4, -CARD_HEIGHT / 2 + 6, CARD_WIDTH, CARD_HEIGHT, 22);
    g.fillStyle(0xfff8e1);
    g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 22);
    g.fillStyle(accent);
    g.fillRoundedRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, 64, { tl: 22, tr: 22, bl: 0, br: 0 });
    this.card.add(g);
  }

  text(x, y, content, size, color = '#4e342e', bold = false) {
    const t = this.add
      .text(x, y, content, {
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? 'bold' : 'normal',
        align: 'center',
        wordWrap: { width: CARD_WIDTH - 60 }
      })
      .setOrigin(0.5);
    this.card.add(t);
    return t;
  }

  // --- Intro ----------------------------------------------------------------

  buildIntro() {
    const { level } = this;
    const top = -CARD_HEIGHT / 2;

    this.text(0, top + 22, `LEVEL ${level.id} OF ${LEVELS.length}`, 14, '#b3e5fc', true);
    this.text(0, top + 44, level.name, 24, '#ffffff', true);
    this.text(0, top + 102, level.description, 16);

    // Goal row: coin target and shift length
    const goal = this.add.graphics();
    drawCoin(goal, -128, top + 162, 13);
    this.card.add(goal);
    this.text(-28, top + 162, `Earn ${level.revenueTarget} coins`, 20, '#4e342e', true);
    this.text(0, top + 196, `Shift length: ${formatDuration(level.shiftDurationMs)}`, 16, '#6d4c41');

    if (this.levelIndex === 0) {
      this.text(0, top + 236, 'Seat guests, take orders, serve them and clean up.\nDon\'t keep them waiting too long!', 14, '#6d4c41');
    }

    this.button(0, CARD_HEIGHT / 2 - 40, 'Start Shift', 0x43a047, () => {
      this.scene.get('BeachScene').startShift();
      this.scene.stop();
    });
  }

  // --- Results --------------------------------------------------------------

  buildResults({ summary, totalCoins, earned }) {
    const top = -CARD_HEIGHT / 2;
    const isLastLevel = this.levelIndex === LEVELS.length - 1;

    let title = 'Target Missed';
    if (summary.succeeded) title = isLastLevel ? 'You Beat Peak Hour!' : 'Shift Complete!';
    this.text(0, top + 22, `LEVEL ${this.level.id} · ${this.level.name}`, 14, '#ffffff', true);
    this.text(0, top + 44, title, 24, '#ffffff', true);

    // Revenue vs target
    this.text(0, top + 92, `Revenue: ${summary.revenue} / ${summary.target}`, 22, '#4e342e', true);
    const bar = new ProgressBar(this, 0, top + 120, 300, 12, summary.succeeded ? 0x66bb6a : 0xef5350);
    bar.setVisible(true).setProgress(0);
    this.card.add(bar);
    this.tweens.addCounter({
      from: 0,
      to: Math.min(1, summary.revenue / summary.target),
      duration: 700,
      delay: 200,
      ease: 'Cubic.easeOut',
      onUpdate: t => bar.setProgress(t.getValue())
    });

    this.text(-80, top + 158, `Guests served\n${summary.served}`, 16, '#2e7d32', true);
    this.text(80, top + 158, `Guests lost\n${summary.lost}`, 16, '#c62828', true);
    this.text(0, top + 204, `Total coins: ${totalCoins}  (+${earned})`, 15, '#6d4c41');

    const bottom = CARD_HEIGHT / 2 - 40;
    if (summary.succeeded && !isLastLevel) {
      this.button(-100, bottom, 'Replay', 0x8d6e63, () => this.goToLevel(this.levelIndex), 160);
      this.button(100, bottom, 'Next Level', 0x43a047, () => this.goToLevel(this.levelIndex + 1), 180);
    } else if (summary.succeeded) {
      this.text(0, top + 232, 'All levels complete - you are the Beach Boss!', 14, '#2e7d32', true);
      this.button(-100, bottom, 'Play Again', 0x8d6e63, () => this.goToLevel(this.levelIndex), 160);
      this.button(100, bottom, 'From Level 1', 0x0277bd, () => this.goToLevel(0), 180);
    } else {
      this.text(0, top + 232, `You needed ${summary.target - summary.revenue} more coins.`, 14, '#6d4c41');
      this.button(0, bottom, 'Try Again', 0xef6c00, () => this.goToLevel(this.levelIndex), 200);
    }
  }

  goToLevel(levelIndex) {
    const beach = this.scene.get('BeachScene');
    this.scene.stop();
    beach.scene.restart({ levelIndex });
  }

  /** A big, touch-friendly button. The action runs at most once per card. */
  button(x, y, label, color, onClick, width = 200) {
    const height = 50;
    const bg = this.add.graphics();
    const draw = shade => {
      bg.clear();
      bg.fillStyle(0x000000, 0.2);
      bg.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 16);
      bg.fillStyle(shade);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    };
    draw(color);

    const text = this.add.text(0, 0, label, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [bg, text, hit]);
    this.card.add(button);

    hit.on('pointerover', () => draw(Phaser.Display.Color.IntegerToColor(color).brighten(10).color));
    hit.on('pointerout', () => draw(color));
    hit.on('pointerdown', () => {
      if (this.actionTaken) return;
      this.actionTaken = true;
      onClick();
    });
    return button;
  }
}
