import Phaser from 'phaser';
import Character from './Character.js';
import { SPEED } from '../config.js';

const PALETTE = {
  skin: [0xffdbb5, 0xf5c9a0, 0xe0a878, 0xa86b45, 0x7a4a2c],
  shirt: [0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xf06292],
  shorts: [0x3f51b5, 0x5d4037, 0x00897b, 0x37474f],
  hair: [0x2b1b12, 0x6d4c41, 0xe6c27a, 0x111111, 0xb5562f],
  hat: [0xfff3c4, 0xffe082, 0xffccbc]
};

export const CustomerState = {
  ARRIVING: 'arriving',
  WAITING: 'waiting',
  WALKING_TO_TABLE: 'walkingToTable',
  SEATED: 'seated'
};

/** A beach guest with randomised colours. Arrives, waits in line, then sits at a table. */
export default class Customer extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, SPEED.customer);

    this.state = CustomerState.ARRIVING;

    const rnd = Phaser.Math.RND;
    this.colors = {
      skin: rnd.pick(PALETTE.skin),
      shirt: rnd.pick(PALETTE.shirt),
      shorts: rnd.pick(PALETTE.shorts),
      hair: rnd.pick(PALETTE.hair),
      hat: rnd.pick(PALETTE.hat),
      wearsHat: rnd.frac() < 0.5
    };

    // Ring under the feet that shows this guest is selected
    this.selectionRing = scene.add.ellipse(0, 0, 44, 14).setStrokeStyle(3, 0xffeb3b).setVisible(false);
    this.addAt(this.selectionRing, 0);

    this.standingLegs = this.drawStandingLegs(scene);
    this.seatedLegs = this.drawSeatedLegs(scene).setVisible(false);
    this.figure.add([this.standingLegs, this.seatedLegs, this.drawUpperBody(scene)]);
  }

  get isWaiting() {
    return this.state === CustomerState.WAITING;
  }

  /** Generous, finger-friendly hit box around the character. */
  containsPoint(x, y) {
    return Math.abs(x - this.x) <= 24 && y >= this.y - 84 && y <= this.y + 10;
  }

  setSelected(selected) {
    this.selectionRing.setVisible(selected);
  }

  /** Switch to the seated pose (used once the guest reaches their stool). */
  sit() {
    this.state = CustomerState.SEATED;
    this.faceRight();
    this.shadow.setVisible(false);
    this.standingLegs.setVisible(false);
    this.seatedLegs.setVisible(true);
    this.figureBaseY = -6;
    this.figure.y = this.figureBaseY;
  }

  drawStandingLegs(scene) {
    const { skin } = this.colors;
    const g = scene.add.graphics();
    g.fillStyle(skin);
    g.fillRect(-7, -18, 5, 16);
    g.fillRect(2, -18, 5, 16);
    g.fillStyle(0x795548);
    g.fillEllipse(-3, -2, 9, 4);
    g.fillEllipse(6, -2, 9, 4);
    return g;
  }

  drawSeatedLegs(scene) {
    const { skin, shorts } = this.colors;
    const g = scene.add.graphics();
    // Thighs point forward, shins hang down to the sand
    g.fillStyle(shorts);
    g.fillRoundedRect(-8, -24, 20, 9, 3);
    g.fillStyle(skin);
    g.fillRect(8, -16, 5, 20);
    g.fillStyle(0x795548);
    g.fillEllipse(13, 4, 9, 4);
    return g;
  }

  drawUpperBody(scene) {
    const { skin, shirt, shorts, hair, hat, wearsHat } = this.colors;
    const g = scene.add.graphics();

    // Shorts
    g.fillStyle(shorts);
    g.fillRoundedRect(-10, -26, 20, 10, 2);

    // Shirt and arms
    g.fillStyle(shirt);
    g.fillRoundedRect(-11, -48, 22, 24, 5);
    g.fillStyle(skin);
    g.fillRoundedRect(-3, -44, 6, 20, 3);

    // Neck and head
    g.fillRect(-3, -52, 6, 5);
    g.fillCircle(0, -62, 12);

    // Hair
    g.fillStyle(hair);
    g.beginPath();
    g.arc(0, -62, 13, Math.PI, 0);
    g.fillPath();
    g.fillEllipse(-7, -60, 12, 16);

    // Optional sun hat
    if (wearsHat) {
      g.fillStyle(hat);
      g.fillEllipse(0, -70, 36, 7);
      g.fillEllipse(0, -75, 18, 12);
      g.fillStyle(0xe57373);
      g.fillRect(-9, -73, 18, 3);
    }

    // Face
    g.fillStyle(0x222222);
    g.fillCircle(6, -62, 1.8);
    g.lineStyle(1.5, 0x6d3b2e);
    g.beginPath();
    g.arc(5, -58, 3, 0.3, Math.PI - 0.6);
    g.strokePath();

    return g;
  }
}
