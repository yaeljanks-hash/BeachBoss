import Phaser from 'phaser';

/** A small rounded progress bar, centred on its position. */
export default class ProgressBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width = 56, height = 8, color = 0x66bb6a) {
    super(scene, x, y);

    this.barWidth = width;
    this.barHeight = height;
    this.color = color;

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, (height + 4) / 2);
    bg.fillStyle(0xffffff, 0.9);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);

    this.fill = scene.add.graphics();
    this.add([bg, this.fill]);
    this.setProgress(0);
    this.setVisible(false);
  }

  /** p goes from 0 (empty) to 1 (full). */
  setProgress(p) {
    const { barWidth: w, barHeight: h } = this;
    const fillWidth = Math.max(0, Math.min(1, p)) * w;
    this.fill.clear();
    if (fillWidth > 0) {
      this.fill.fillStyle(this.color);
      this.fill.fillRoundedRect(-w / 2, -h / 2, Math.max(fillWidth, h), h, h / 2);
    }
    return this;
  }
}
