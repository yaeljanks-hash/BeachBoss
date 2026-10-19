import Phaser from 'phaser';
import { OrderState } from './Order.js';
import ProgressBar from '../ui/ProgressBar.js';
import { createMenuIcon } from '../ui/icons.js';
import { LAYOUT, SCALE } from '../config.js';

const SLOT_PREPARING_ALPHA = 0.45;

/**
 * The beach bar, where every order is prepared.
 *
 * It has one counter slot per table, so each order always has a place. Orders
 * are prepared in parallel; each slot shows the item, its table number and a
 * progress bar, then a "READY" tag once it can be picked up.
 *
 * The container origin is the top-left corner of the roof. The artwork is
 * drawn at its original size and scaled by SCALE.bar.
 */
export default class BeachBar extends Phaser.GameObjects.Container {
  constructor(scene, slotCount) {
    const { x, bottom, width, height } = LAYOUT.bar;
    super(scene, x, bottom - height * SCALE.bar);

    this.barWidth = width;
    this.barHeight = height;
    this.serviceSpot = LAYOUT.barServiceSpot;

    this.add(this.drawBar(scene));
    this.slots = this.createSlots(scene, slotCount);

    this.setScale(SCALE.bar);
    scene.add.existing(this);
  }

  containsPoint(px, py) {
    const s = this.scaleX;
    return (
      px >= this.x - 10 * s &&
      px <= this.x + (this.barWidth + 10) * s &&
      py >= this.y - 5 * s &&
      py <= this.y + (this.barHeight + 10) * s
    );
  }

  /** Where messages about the bar appear, in world space. */
  get messagePoint() {
    return { x: this.x + (this.barWidth / 2) * this.scaleX, y: this.y - 10 };
  }

  get readyOrders() {
    return this.slots
      .map(slot => slot.order)
      .filter(order => order?.fsm.is(OrderState.READY_FOR_PICKUP));
  }

  get hasReadyOrder() {
    return this.readyOrders.length > 0;
  }

  /**
   * Start preparing an order. `onReady(order)` runs when it is done.
   * Returns false if the order could not be accepted.
   */
  startPreparing(order, onReady) {
    const slot = this.slots.find(s => s.order === null);
    if (!slot || !order.fsm.transition(OrderState.PREPARING)) return false;

    slot.order = order;
    slot.icon.add(createMenuIcon(this.scene, order.item));
    slot.icon.setAlpha(SLOT_PREPARING_ALPHA);
    slot.label.setText(`T${order.table.number}`).setVisible(true);
    slot.progress.setProgress(0).setVisible(true);

    slot.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: order.item.prepTimeMs,
      onUpdate: tween => slot.progress.setProgress(tween.getValue()),
      onComplete: () => {
        slot.tween = null;
        if (slot.order !== order || !order.fsm.transition(OrderState.READY_FOR_PICKUP)) return;
        slot.progress.setVisible(false);
        slot.icon.setAlpha(1);
        slot.readyTag.setVisible(true);
        this.scene.tweens.add({
          targets: slot.readyTag,
          y: slot.readyTag.y - 4,
          duration: 350,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        onReady?.(order);
      }
    });
    return true;
  }

  /** Remove the ready order that has waited longest from the counter. */
  takeReadyOrder() {
    const slot = this.slots.find(s => s.order?.fsm.is(OrderState.READY_FOR_PICKUP));
    if (!slot) return null;

    const order = slot.order;
    this.clearSlot(slot);
    return order;
  }

  /** Throw away an order (preparing or ready) whose guest has left. */
  discardOrder(order) {
    const slot = this.slots.find(s => s.order === order);
    if (slot) this.clearSlot(slot);
  }

  clearSlot(slot) {
    slot.tween?.destroy();
    slot.tween = null;
    slot.order = null;
    slot.icon.removeAll(true);
    slot.label.setVisible(false);
    slot.progress.setVisible(false);
    this.scene.tweens.killTweensOf(slot.readyTag);
    slot.readyTag.setVisible(false).setY(slot.readyTagY);
  }

  createSlots(scene, count) {
    const counterTop = 87; // local y of the countertop surface
    const spacing = this.barWidth / count;

    return Array.from({ length: count }, (_, i) => {
      const x = spacing * (i + 0.5);
      const icon = scene.add.container(x, counterTop);
      const label = scene.add
        .text(x, counterTop + 18, '', { fontSize: '12px', color: '#fff3e0', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setVisible(false);
      const progress = new ProgressBar(scene, x, counterTop - 46, 40, 7, 0x66bb6a);

      const readyTagY = counterTop - 48;
      const readyTag = scene.add.container(x, readyTagY).setVisible(false);
      const tagBg = scene.add.graphics();
      tagBg.fillStyle(0x43a047);
      tagBg.fillRoundedRect(-22, -9, 44, 18, 9);
      readyTag.add([
        tagBg,
        scene.add.text(0, 0, 'READY', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      ]);

      this.add([icon, label, progress, readyTag]);
      return { order: null, icon, label, progress, readyTag, readyTagY, tween: null };
    });
  }

  drawBar(scene) {
    const w = this.barWidth;
    const h = this.barHeight;
    const g = scene.add.graphics();

    // Back wall with shelves and bottles
    g.fillStyle(0x7a4a2c);
    g.fillRect(8, 26, w - 16, 64);
    g.fillStyle(0x5d3a22);
    g.fillRect(8, 52, w - 16, 4);
    [0x81c784, 0xffb74d, 0x4fc3f7, 0xf06292, 0xfff176, 0xba68c8].forEach((color, i) => {
      const bx = 22 + i * 27;
      g.fillStyle(color, 0.9);
      g.fillRoundedRect(bx, 36, 8, 16, 2);
      g.fillRect(bx + 2.5, 31, 3, 6);
    });

    // Posts
    g.fillStyle(0x5d3a22);
    g.fillRect(4, 20, 8, h - 20);
    g.fillRect(w - 12, 20, 8, h - 20);

    // Counter front (same warm brown as the original bar) with planks
    g.fillStyle(0xa66b43);
    g.fillRect(0, 92, w, h - 92);
    g.lineStyle(2, 0x8b5a3c);
    for (let px = 30; px < w; px += 30) g.lineBetween(px, 96, px, h);
    g.fillStyle(0xc68a5a);
    g.fillRoundedRect(-6, 85, w + 12, 9, 3);

    // Thatched roof
    g.fillStyle(0xd4a35a);
    g.fillPoints([{ x: -12, y: 30 }, { x: w + 12, y: 30 }, { x: w - 6, y: 0 }, { x: 6, y: 0 }], true);
    g.fillStyle(0xc28e45);
    for (let fx = -12; fx < w + 12; fx += 12) g.fillTriangle(fx, 30, fx + 12, 30, fx + 6, 38);
    g.lineStyle(1.5, 0xb07a35);
    for (let lx = 14; lx < w; lx += 16) g.lineBetween(lx, 4, lx - 6, 28);

    const sign = scene.add
      .text(w / 2, 15, 'BEACH BAR', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#8d5a2b', 3);

    return [g, sign];
  }
}
