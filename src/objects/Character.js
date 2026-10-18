import Phaser from 'phaser';

/**
 * Base class for anyone who walks around the beach.
 *
 * The container's origin sits at the character's feet, so `y` doubles as the
 * depth-sorting value. Subclasses draw their artwork into `this.figure`,
 * facing right; the figure is mirrored when walking left.
 */
export default class Character extends Phaser.GameObjects.Container {
  constructor(scene, x, y, speed) {
    super(scene, x, y);

    this.speed = speed;
    this.figureBaseY = 0;

    this.shadow = scene.add.ellipse(0, 0, 34, 10, 0x000000, 0.18);
    this.figure = scene.add.container(0, 0);
    this.add([this.shadow, this.figure]);

    scene.add.existing(this);
  }

  /** Walk smoothly to (x, y) at this character's speed, then call onArrive. */
  walkTo(x, y, onArrive) {
    this.stopWalking();

    const distance = Phaser.Math.Distance.Between(this.x, this.y, x, y);
    if (distance < 2) {
      onArrive?.();
      return;
    }

    this.faceTowards(x);
    this.startBob();

    this.scene.tweens.add({
      targets: this,
      x,
      y,
      duration: (distance / this.speed) * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.stopBob();
        onArrive?.();
      }
    });
  }

  /** Walk through a list of {x, y} points in order, then call onArrive. */
  walkPath(points, onArrive) {
    const [next, ...rest] = points;
    if (!next) {
      onArrive?.();
      return;
    }
    this.walkTo(next.x, next.y, () => this.walkPath(rest, onArrive));
  }

  stopWalking() {
    this.scene.tweens.killTweensOf(this);
    this.stopBob();
  }

  faceTowards(targetX) {
    const dx = targetX - this.x;
    if (Math.abs(dx) > 1) {
      this.figure.scaleX = dx < 0 ? -1 : 1;
    }
  }

  faceRight() {
    this.figure.scaleX = 1;
  }

  // Small up-and-down bounce that reads as walking
  startBob() {
    this.stopBob();
    this.scene.tweens.add({
      targets: this.figure,
      y: this.figureBaseY - 3,
      duration: 140,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  stopBob() {
    this.scene.tweens.killTweensOf(this.figure);
    this.figure.y = this.figureBaseY;
  }
}
