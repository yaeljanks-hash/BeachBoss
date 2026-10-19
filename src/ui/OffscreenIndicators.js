import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH, PATIENCE } from '../config.js';
import { createMenuIcon, drawBroom } from './icons.js';

/** What a request needs from the player. */
export const AttentionKind = {
  ORDER: 'order', // a guest is ready to order
  DELIVER: 'deliver', // the order on the tray belongs to this table
  PICKUP: 'pickup', // an order is ready at the bar
  SEAT: 'seat', // guests are waiting and this table is free
  CLEAN: 'clean' // the table is dirty
};

const BUBBLE_WIDTH = 64;
const BUBBLE_HEIGHT = 68;
const ARROW_LENGTH = 14;
const EDGE_GAP = 6;
const CENTER_Y = 300; // below the HUD, over the open ocean and sand
const HIT_PADDING = 10;

// A target counts as visible once its centre is this far inside the screen
const VISIBLE_MARGIN = 60;

const COLORS = {
  good: 0x66bb6a,
  warning: 0xffca28,
  critical: 0xef5350,
  calm: 0x4fc3f7 // requests without a patience meter (cleaning)
};

function colorFor(item) {
  if (item.patience === null) return COLORS.calm;
  if (item.patience < PATIENCE.criticalBelow) return COLORS.critical;
  if (item.patience < PATIENCE.warningBelow) return COLORS.warning;
  return COLORS.good;
}

/**
 * Arrows at the left and right screen edges pointing at requests the player
 * can't see. Each edge shows only its most urgent request, plus a "+N" badge
 * when more are waiting on that side, to keep clutter down.
 *
 * Items come from the scene each frame:
 *   { key, kind, x, panX?, label, patience (0..1, or null), urgency, item? }
 * `x` is the world position the player needs to see, `panX` (default `x`) where
 * the camera centres when the indicator is tapped; higher `urgency` wins.
 */
export default class OffscreenIndicators {
  constructor(scene) {
    this.scene = scene;
    this.edges = [new EdgeIndicator(scene, -1), new EdgeIndicator(scene, 1)];
  }

  /** Refresh from the current requests and camera view. */
  update(items, viewLeft, viewWidth) {
    const left = items.filter(item => item.x < viewLeft + VISIBLE_MARGIN);
    const right = items.filter(item => item.x > viewLeft + viewWidth - VISIBLE_MARGIN);
    [left, right].forEach((sideItems, i) => {
      const sorted = [...sideItems].sort((a, b) => b.urgency - a.urgency);
      this.edges[i].show(sorted[0] ?? null, sorted.length - 1);
    });
  }

  hide() {
    this.edges.forEach(edge => edge.show(null, 0));
  }

  /** The request under a screen point, if an indicator is there. */
  hitTest(screenX, screenY) {
    return this.edges.find(edge => edge.contains(screenX, screenY))?.item ?? null;
  }
}

/** One edge's indicator: a bubble with an icon and label, and an arrow pointing off screen. */
class EdgeIndicator extends Phaser.GameObjects.Container {
  constructor(scene, side) {
    const x = side < 0 ? EDGE_GAP + ARROW_LENGTH + BUBBLE_WIDTH / 2 : GAME_WIDTH - EDGE_GAP - ARROW_LENGTH - BUBBLE_WIDTH / 2;
    super(scene, x, CENTER_Y);

    this.side = side;
    this.item = null;
    this.contentKey = null;
    this.color = null;

    this.bg = scene.add.graphics();
    this.icon = scene.add.container(0, -8);
    this.label = scene.add
      .text(0, 22, '', { fontSize: '14px', color: '#4e342e', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.badge = scene.add.container(side < 0 ? BUBBLE_WIDTH / 2 - 4 : -BUBBLE_WIDTH / 2 + 4, -BUBBLE_HEIGHT / 2 + 4);
    const badgeBg = scene.add.graphics();
    badgeBg.fillStyle(0x37474f);
    badgeBg.fillCircle(0, 0, 11);
    this.badgeText = scene.add.text(0, 0, '', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.badge.add([badgeBg, this.badgeText]);

    this.add([this.bg, this.icon, this.label, this.badge]);
    this.setScrollFactor(0).setDepth(DEPTH.hud).setVisible(false);
    scene.add.existing(this);
  }

  /** Point at `item` (or hide when null); `others` more requests wait on this side. */
  show(item, others) {
    this.item = item;
    if (!item) {
      if (this.visible) {
        this.setVisible(false);
        this.setPulse(false);
      }
      return;
    }
    this.setVisible(true);

    const color = colorFor(item);
    if (color !== this.color) {
      this.color = color;
      this.drawBackground(color);
      this.setPulse(color === COLORS.critical);
    }

    const contentKey = `${item.key}|${item.item?.id ?? ''}`;
    if (contentKey !== this.contentKey) {
      this.contentKey = contentKey;
      this.drawIcon(item);
      this.label.setText(item.label);
    }

    this.badge.setVisible(others > 0);
    if (others > 0) this.badgeText.setText(`+${others}`);
  }

  /** Generous hit box covering the bubble and the arrow. */
  contains(sx, sy) {
    if (!this.visible) return false;
    const halfWidth = BUBBLE_WIDTH / 2 + ARROW_LENGTH / 2 + HIT_PADDING;
    const centerX = this.x + (this.side * ARROW_LENGTH) / 2; // the arrow sticks out on the outer side
    return Math.abs(sx - centerX) <= halfWidth && Math.abs(sy - this.y) <= BUBBLE_HEIGHT / 2 + HIT_PADDING;
  }

  drawBackground(color) {
    const g = this.bg;
    const w = BUBBLE_WIDTH;
    const h = BUBBLE_HEIGHT;
    g.clear();

    // Arrow on the outer side, pointing off screen
    const baseX = (this.side * w) / 2;
    const tipX = baseX + this.side * ARROW_LENGTH;
    g.fillStyle(color);
    g.fillTriangle(baseX - this.side * 2, -14, baseX - this.side * 2, 14, tipX, 0);

    // Bubble with a coloured border
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 14);
    g.fillStyle(color);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0xfffdf5);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 10);
  }

  drawIcon(item) {
    const scene = this.scene;
    this.icon.removeAll(true);

    switch (item.kind) {
      case AttentionKind.ORDER: {
        this.icon.add(scene.add.circle(0, 0, 15, 0xfff176).setStrokeStyle(2, 0xf9a825));
        this.icon.add(scene.add.text(0, 0, '!', { fontSize: '22px', color: '#e65100', fontStyle: 'bold' }).setOrigin(0.5));
        break;
      }
      case AttentionKind.DELIVER:
      case AttentionKind.PICKUP: {
        // Menu icons are bottom-anchored and about 32 units tall
        this.icon.add(createMenuIcon(scene, item.item).setScale(0.8).setPosition(0, 13));
        break;
      }
      case AttentionKind.SEAT: {
        const g = scene.add.graphics();
        g.fillStyle(0x43a047);
        g.fillCircle(0, -8, 7);
        g.fillRoundedRect(-9, 0, 18, 13, 5);
        this.icon.add(g);
        break;
      }
      case AttentionKind.CLEAN: {
        const g = scene.add.graphics();
        drawBroom(g);
        this.icon.add(g.setScale(1.7));
        break;
      }
      default:
        break;
    }
  }

  setPulse(on) {
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    if (on) this.scene.tweens.add({ targets: this, scale: 1.12, duration: 320, yoyo: true, repeat: -1 });
  }
}
