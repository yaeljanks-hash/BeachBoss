/**
 * One restaurant shift: the countdown, the revenue earned against the target,
 * and how many guests were served or lost.
 *
 * The countdown is a scene timer, so it pauses with the scene and is cleaned
 * up automatically when the scene restarts.
 */
export default class Shift {
  constructor(scene, level) {
    this.scene = scene;
    this.level = level;
    this.revenue = 0;
    this.served = 0;
    this.lost = 0;
    this.targetReached = false;
    this.timer = null;
  }

  get target() {
    return this.level.revenueTarget;
  }

  get remainingMs() {
    if (!this.timer) return this.level.shiftDurationMs;
    return Math.max(0, this.timer.getRemaining());
  }

  get succeeded() {
    return this.revenue >= this.target;
  }

  /** Start the countdown; `onEnd` runs once when it reaches zero. */
  start(onEnd) {
    if (this.timer) return;
    this.timer = this.scene.time.addEvent({ delay: this.level.shiftDurationMs, callback: onEnd });
  }

  /** Add a payment. Returns true the moment the target is first reached. */
  addRevenue(amount) {
    this.revenue += amount;
    this.served += 1;
    if (!this.targetReached && this.succeeded) {
      this.targetReached = true;
      return true;
    }
    return false;
  }

  recordLost() {
    this.lost += 1;
  }

  summary() {
    return {
      revenue: this.revenue,
      target: this.target,
      served: this.served,
      lost: this.lost,
      succeeded: this.succeeded
    };
  }
}
