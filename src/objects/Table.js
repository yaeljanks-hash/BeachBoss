import Phaser from 'phaser';
import StateMachine from '../systems/StateMachine.js';
import SpeechBubble from '../ui/SpeechBubble.js';
import ProgressBar from '../ui/ProgressBar.js';
import { createMenuIcon } from '../ui/icons.js';

const WOOD = 0x8b5a3c;
const WOOD_DARK = 0x6b4129;
const WOOD_LIGHT = 0xa8714d;

export const TableState = {
  EMPTY: 'empty',
  RESERVED: 'reserved', // a guest is walking over
  OCCUPIED: 'occupied',
  DIRTY: 'dirty',
  CLEANING: 'cleaning'
};

const TRANSITIONS = {
  [TableState.EMPTY]: [TableState.RESERVED],
  [TableState.RESERVED]: [TableState.OCCUPIED],
  [TableState.OCCUPIED]: [TableState.DIRTY, TableState.EMPTY], // EMPTY: guest walked out unserved
  [TableState.DIRTY]: [TableState.CLEANING],
  [TableState.CLEANING]: [TableState.EMPTY, TableState.DIRTY]
};

export const GlowColor = {
  SEAT: 0x66bb6a, // can take a waiting guest
  DELIVER: 0xffca28 // the order on the waitress's tray goes here
};

/**
 * A beach table with a stool on its left. The container origin is the floor
 * point under the table's centre.
 */
export default class Table extends Phaser.GameObjects.Container {
  constructor(scene, x, floorY, number) {
    super(scene, x, floorY);

    this.number = number;
    this.customer = null;
    this.fsm = new StateMachine(`Table ${number}`, TableState.EMPTY, TRANSITIONS);

    // Where a guest sits and where the waitress stands to serve
    this.seatSpot = { x: x - 75, y: floorY };
    this.serviceSpot = { x: x + 78, y: floorY + 8 };

    this.glow = scene.add.ellipse(-10, 0, 190, 26, 0xffffff, 0.35).setVisible(false);
    this.glowColor = null;
    this.dirt = this.drawDirt(scene).setVisible(false);
    this.servedItem = scene.add.container(-28, -54); // item on the tabletop
    this.bubble = new SpeechBubble(scene, -72, -100); // above the guest's patience bar
    this.progress = new ProgressBar(scene, 0, -76, 64, 8, 0x4fc3f7);

    this.add([
      this.glow,
      this.drawFurniture(scene),
      this.dirt,
      this.servedItem,
      scene.add
        .text(0, 16, `Table ${number}`, { fontSize: '14px', color: '#6b4a2b', fontStyle: 'bold' })
        .setOrigin(0.5, 0),
      this.progress,
      this.bubble
    ]);

    // Tables sit just behind anyone standing on the same floor line
    this.setDepth(floorY - 1);
    scene.add.existing(this);
  }

  get isAvailable() {
    return this.fsm.is(TableState.EMPTY);
  }

  get isOccupied() {
    return this.fsm.is(TableState.RESERVED, TableState.OCCUPIED);
  }

  get isDirty() {
    return this.fsm.is(TableState.DIRTY);
  }

  /** Tap area covers the table, the stool and a little margin for fingers. */
  containsPoint(px, py) {
    return px >= this.x - 100 && px <= this.x + 65 && py >= this.y - 75 && py <= this.y + 35;
  }

  // --- State changes --------------------------------------------------------

  /** Claim the table for a guest who is on their way. */
  reserve(customer) {
    if (!this.fsm.transition(TableState.RESERVED)) return false;
    this.customer = customer;
    return true;
  }

  /** The reserved guest has sat down. */
  occupy() {
    return this.fsm.transition(TableState.OCCUPIED);
  }

  /** The guest has left; leave the mess behind. */
  vacate() {
    if (!this.fsm.transition(TableState.DIRTY)) return false;
    this.customer = null;
    this.clearServedItem();
    this.dirt.setVisible(true);
    this.bubble.showDirty();
    return true;
  }

  /** The guest walked out before eating: nothing to clean, free straight away. */
  release() {
    if (!this.fsm.transition(TableState.EMPTY)) return false;
    this.customer = null;
    this.clearServedItem();
    this.bubble.hide();
    return true;
  }

  startCleaning() {
    if (!this.fsm.transition(TableState.CLEANING)) return false;
    this.bubble.hide();
    this.progress.setProgress(0).setVisible(true);
    return true;
  }

  setCleaningProgress(p) {
    this.progress.setProgress(p);
    this.dirt.setAlpha(1 - p);
  }

  /** Cleaning was interrupted: back to dirty. */
  cancelCleaning() {
    if (!this.fsm.transition(TableState.DIRTY)) return false;
    this.progress.setVisible(false);
    this.dirt.setAlpha(1);
    this.bubble.showDirty();
    return true;
  }

  finishCleaning() {
    if (!this.fsm.transition(TableState.EMPTY)) return false;
    this.progress.setVisible(false);
    this.dirt.setVisible(false).setAlpha(1);
    return true;
  }

  // --- Visuals --------------------------------------------------------------

  /** Pulsing glow under the table, or null to hide it. */
  setGlow(color) {
    if (this.glowColor === color) return;
    this.glowColor = color;
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.setVisible(color !== null);
    if (color !== null) {
      this.glow.setFillStyle(color, 0.35).setAlpha(1);
      this.scene.tweens.add({ targets: this.glow, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  /** Put the delivered item on the tabletop. */
  showServedItem(item) {
    this.clearServedItem();
    this.servedItem.add(createMenuIcon(this.scene, item)).setScale(1).setAlpha(1);
  }

  /** Shrink the item as the guest consumes it (p from 0 to 1). */
  setConsumedProgress(p) {
    this.servedItem.setScale(1 - p * 0.5).setAlpha(1 - p * 0.6);
  }

  clearServedItem() {
    this.servedItem.removeAll(true);
  }

  drawFurniture(scene) {
    const g = scene.add.graphics();

    // Shadows
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(0, 0, 120, 12);
    g.fillEllipse(-75, 0, 36, 8);

    // Table: centre post, foot and top
    g.fillStyle(WOOD_DARK);
    g.fillRect(-4, -46, 8, 46);
    g.fillRoundedRect(-20, -5, 40, 5, 2);
    g.fillStyle(WOOD);
    g.fillRoundedRect(-55, -54, 110, 10, 3);
    g.fillStyle(WOOD_LIGHT);
    g.fillRect(-52, -54, 104, 3);

    // Little coconut drink as decoration
    g.fillStyle(0x795548);
    g.fillCircle(30, -60, 6);
    g.lineStyle(2, 0xff4081);
    g.lineBetween(30, -60, 36, -72);

    // Stool
    g.fillStyle(WOOD_DARK);
    g.fillRect(-77, -22, 4, 22);
    g.fillRoundedRect(-87, -3, 24, 3, 1);
    g.fillStyle(WOOD);
    g.fillRoundedRect(-90, -26, 30, 6, 2);

    return g;
  }

  /** Empty dish, spills and crumbs left by a departed guest. */
  drawDirt(scene) {
    const g = scene.add.graphics();

    // Spills on the tabletop
    g.fillStyle(0x6d4c41, 0.55);
    g.fillEllipse(-12, -50, 26, 4);
    g.fillEllipse(14, -49, 12, 3);

    // Used plate and knocked-over cup
    g.fillStyle(0xb0bec5);
    g.fillEllipse(-28, -56, 30, 7);
    g.fillStyle(0xeceff1);
    g.fillEllipse(-28, -57, 24, 5);
    g.fillStyle(0xbcaaa4);
    g.fillCircle(-33, -58, 2);
    g.fillCircle(-24, -58, 1.5);
    g.fillStyle(0xe1f5fe);
    g.fillRoundedRect(-6, -63, 16, 8, 2);

    // Crumbs and a napkin on the sand
    g.fillStyle(0xffffff);
    g.fillTriangle(16, -2, 30, -4, 24, 2);
    g.fillStyle(0x8d6e63);
    [[-30, -2], [-20, -1], [-8, -3], [6, -1]].forEach(([x, y]) => g.fillCircle(x, y, 1.5));

    return g;
  }
}
