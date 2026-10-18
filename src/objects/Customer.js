import Phaser from 'phaser';
import Character from './Character.js';
import { SPEED, PATIENCE } from '../config.js';
import StateMachine from '../systems/StateMachine.js';
import PatienceBar from '../ui/PatienceBar.js';
import SpeechBubble from '../ui/SpeechBubble.js';

const PALETTE = {
  skin: [0xffdbb5, 0xf5c9a0, 0xe0a878, 0xa86b45, 0x7a4a2c],
  shirt: [0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xf06292],
  shorts: [0x3f51b5, 0x5d4037, 0x00897b, 0x37474f],
  hair: [0x2b1b12, 0x6d4c41, 0xe6c27a, 0x111111, 0xb5562f],
  hat: [0xfff3c4, 0xffe082, 0xffccbc]
};

export const CustomerState = {
  ARRIVING: 'arriving', // walking to the line
  WAITING: 'waiting', // in line, can be seated
  WALKING_TO_TABLE: 'walkingToTable',
  SEATED: 'seated', // reading the menu
  READY_TO_ORDER: 'readyToOrder',
  WAITING_FOR_ORDER: 'waitingForOrder', // order taken, waiting for it to arrive
  EATING: 'eating', // eating or drinking
  LEAVING: 'leaving' // walking away (paid, or ran out of patience)
};

// The states in which a guest's patience runs down
export const PATIENCE_DRAINING_STATES = {
  [CustomerState.WAITING]: 'waitingMs',
  [CustomerState.READY_TO_ORDER]: 'seatedMs',
  [CustomerState.WAITING_FOR_ORDER]: 'seatedMs'
};

const TRANSITIONS = {
  [CustomerState.ARRIVING]: [CustomerState.WAITING],
  [CustomerState.WAITING]: [CustomerState.WALKING_TO_TABLE, CustomerState.LEAVING],
  [CustomerState.WALKING_TO_TABLE]: [CustomerState.SEATED],
  [CustomerState.SEATED]: [CustomerState.READY_TO_ORDER],
  [CustomerState.READY_TO_ORDER]: [CustomerState.WAITING_FOR_ORDER, CustomerState.LEAVING],
  [CustomerState.WAITING_FOR_ORDER]: [CustomerState.EATING, CustomerState.LEAVING],
  [CustomerState.EATING]: [CustomerState.LEAVING],
  [CustomerState.LEAVING]: []
};

let nextCustomerId = 1;

/**
 * A beach guest with randomised colours. Arrives, waits in line, sits at a
 * table, orders, eats, pays and leaves - or walks out if kept waiting too long.
 *
 * `patience` runs from 1 (happy) to 0 (leaving). The scene drains it while the
 * guest is in one of PATIENCE_DRAINING_STATES.
 */
export default class Customer extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, SPEED.customer);

    this.id = nextCustomerId++;
    this.fsm = new StateMachine(`Customer ${this.id}`, CustomerState.ARRIVING, TRANSITIONS);
    this.order = null;
    this.patience = 1;
    this.leftUnhappy = false;
    this.mood = null;

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
    this.mouth = scene.add.graphics();
    this.figure.add([this.standingLegs, this.seatedLegs, this.drawUpperBody(scene), this.mouth]);

    // Patience meter above the head, and a bubble for leaving unhappy
    this.patienceBar = new PatienceBar(scene, 0, -90);
    this.bubble = new SpeechBubble(scene, 3, -96);
    this.add([this.patienceBar, this.bubble]);
    this.setMood('happy');
  }

  // --- Patience -------------------------------------------------------------

  /** Lose `deltaMs` worth of a meter that lasts `fullMs`. Returns true when it runs out. */
  drainPatience(deltaMs, fullMs) {
    this.setPatience(this.patience - deltaMs / fullMs);
    return this.patience <= 0;
  }

  setPatience(value) {
    this.patience = Phaser.Math.Clamp(value, 0, 1);
    this.patienceBar.setProgress(this.patience);
    if (this.patience < PATIENCE.criticalBelow) this.setMood('upset');
    else if (this.patience < PATIENCE.warningBelow) this.setMood('worried');
    else this.setMood('happy');
  }

  showPatience(visible) {
    this.patienceBar.setVisible(visible);
  }

  /** Redraw the mouth (and brows) for 'happy', 'worried' or 'upset'. */
  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    const g = this.mouth;
    g.clear();
    g.lineStyle(1.5, 0x6d3b2e);
    if (mood === 'happy') {
      g.beginPath();
      g.arc(5, -58, 3, 0.3, Math.PI - 0.6);
      g.strokePath();
    } else if (mood === 'worried') {
      g.lineBetween(3, -56, 8, -56);
    } else {
      g.beginPath();
      g.arc(5, -54, 3, Math.PI + 0.6, Math.PI * 2 - 0.3);
      g.strokePath();
      g.lineStyle(1.5, 0x3e2723);
      g.lineBetween(3, -67, 8, -65);
    }
  }

  /** Ran out of patience: frown, broken heart, and walk off a little faster. */
  becomeUnhappy() {
    this.leftUnhappy = true;
    this.setMood('upset');
    this.showPatience(false);
    this.setSelected(false);
    this.bubble.showAngry();
    this.speed = SPEED.customer * PATIENCE.unhappySpeedMultiplier;
  }

  get isWaiting() {
    return this.fsm.is(CustomerState.WAITING);
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
    this.faceRight();
    this.shadow.setVisible(false);
    this.standingLegs.setVisible(false);
    this.seatedLegs.setVisible(true);
    this.figureBaseY = -6;
    this.figure.y = this.figureBaseY;
  }

  /** Back to the standing pose, ready to walk away. */
  stand() {
    this.shadow.setVisible(true);
    this.standingLegs.setVisible(true);
    this.seatedLegs.setVisible(false);
    this.figureBaseY = 0;
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

    return g;
  }
}
