import Phaser from 'phaser';
import { createMenuIcon, drawBroom, drawBrokenHeart } from './icons.js';

const PADDING = 8;
const HEIGHT = 34;
const TAIL_HEIGHT = 9;
const TAIL_INSET = 18; // horizontal distance from the bubble's left edge to the tail tip

/**
 * A speech bubble whose tail tip sits at the container's position, so it can be
 * placed right above a character's head and grows from there when it pops in.
 */
export default class SpeechBubble extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);

    // `inner` bobs up and down; the container itself handles the pop-in scale
    this.inner = scene.add.container(0, 0);
    this.bg = scene.add.graphics();
    this.content = scene.add.container(0, 0);
    this.inner.add([this.bg, this.content]);
    this.add(this.inner);

    this.mode = null;
    this.setVisible(false);
  }

  /** Three coloured dots: the guest is settling in / reading the menu. */
  showThinking() {
    this.build('thinking', 52, 0xffffff, content => {
      [0x29b6f6, 0x66bb6a, 0xffa726].forEach((color, i) => {
        content.add(this.scene.add.circle(14 + i * 12, HEIGHT / 2, 4, color));
      });
    });
  }

  /** Bright exclamation mark: the guest wants to order. */
  showReadyToOrder() {
    this.build('ready', 40, 0xfff176, content => {
      content.add(
        this.scene.add
          .text(20, HEIGHT / 2, '!', { fontSize: '24px', color: '#e65100', fontStyle: 'bold' })
          .setOrigin(0.5)
      );
    }, true);
  }

  /** The ordered item's icon and name. */
  showOrder(item) {
    if (this.mode === `order:${item.id}`) return;
    const label = this.scene.add
      .text(0, HEIGHT / 2, item.name, { fontSize: '13px', color: '#4e342e', fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    const iconWidth = 30;
    const width = PADDING + iconWidth + 4 + label.width + PADDING;

    this.build(`order:${item.id}`, width, 0xffffff, content => {
      const icon = createMenuIcon(this.scene, item).setScale(0.8);
      icon.setPosition(PADDING + iconWidth / 2, HEIGHT - 4);
      label.setX(PADDING + iconWidth + 4);
      content.add([icon, label]);
    });
  }

  /** Broom icon: the table needs cleaning. */
  showDirty() {
    this.build('dirty', 40, 0xffe0b2, content => {
      const g = this.scene.add.graphics();
      drawBroom(g);
      g.setPosition(18, HEIGHT / 2);
      content.add(g);
    }, true);
  }

  /** Broken heart: the guest ran out of patience. */
  showAngry() {
    this.build('angry', 40, 0xffcdd2, content => {
      const g = this.scene.add.graphics();
      drawBrokenHeart(g);
      g.setPosition(20, HEIGHT / 2);
      content.add(g);
    }, true);
  }

  hide() {
    this.mode = null;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.inner);
    this.content.removeAll(true);
    this.setVisible(false);
  }

  build(mode, width, color, fillContent, pulse = false) {
    if (this.mode === mode) return;
    this.hide();
    this.mode = mode;

    const left = -TAIL_INSET;
    const top = -(HEIGHT + TAIL_HEIGHT);
    this.inner.setPosition(0, 0);
    this.content.setPosition(left, top);

    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.15);
    g.fillRoundedRect(left + 2, top + 3, width, HEIGHT, 12);
    g.fillStyle(color);
    g.fillRoundedRect(left, top, width, HEIGHT, 12);
    g.fillTriangle(-6, -TAIL_HEIGHT - 1, 6, -TAIL_HEIGHT - 1, 0, 0);
    if (pulse) {
      g.lineStyle(2, 0xff9800);
      g.strokeRoundedRect(left, top, width, HEIGHT, 12);
    }

    fillContent(this.content);

    // Pop in, then bob gently (faster when the bubble wants attention)
    this.setVisible(true).setScale(0);
    this.scene.tweens.add({ targets: this, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: this.inner,
      y: pulse ? -6 : -4,
      duration: pulse ? 380 : 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
}
