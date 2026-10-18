import ProgressBar from './ProgressBar.js';
import { PATIENCE } from '../config.js';

const COLORS = {
  good: 0x66bb6a,
  warning: 0xffca28,
  critical: 0xef5350
};

/** A small patience meter: green, then yellow, then pulsing red. */
export default class PatienceBar extends ProgressBar {
  constructor(scene, x, y) {
    super(scene, x, y, 40, 6, COLORS.good);
    this.critical = false;
    this.ready = true;
    this.setProgress(1);
  }

  setProgress(p) {
    if (p < PATIENCE.criticalBelow) this.color = COLORS.critical;
    else if (p < PATIENCE.warningBelow) this.color = COLORS.warning;
    else this.color = COLORS.good;
    super.setProgress(p);

    // ProgressBar's constructor calls this before our own fields exist
    if (this.ready) this.setCritical(p < PATIENCE.criticalBelow);
    return this;
  }

  setCritical(critical) {
    if (this.critical === critical) return;
    this.critical = critical;
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    if (critical) {
      this.scene.tweens.add({ targets: this, scale: 1.25, duration: 260, yoyo: true, repeat: -1 });
    }
  }
}
