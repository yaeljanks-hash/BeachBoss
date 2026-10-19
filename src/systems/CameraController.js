import Phaser from 'phaser';
import { WORLD, CAMERA } from '../config.js';

const FLING_SAMPLE_MS = 100; // swipe speed is measured over the last part of the drag
const FLING_MIN_SPEED = 30; // below this the momentum simply stops
const TAP_BLOCKING_SPEED = 200; // touching a fast-moving view stops it instead of tapping

/**
 * Horizontal camera for the wide beach, and the single place that turns raw
 * pointer input into taps.
 *
 * - Press, move less than CAMERA.dragThreshold, release: a tap. `onTap`
 *   receives the world point under the press, and the screen point too (for
 *   things fixed to the screen, like the off-screen indicators).
 * - Press and move further: a drag. The view follows the finger or mouse and no
 *   tap is sent. Releasing with speed keeps the view gliding for a moment.
 * - Mouse wheel or trackpad: scrolls the view.
 * - `panTo(x)` glides the view to a world position (used by the indicators).
 * - Otherwise the camera follows the target (the waitress). While she walks it
 *   also tries to keep her destination on screen, so the player can see where
 *   she is going. Any drag or scroll switches to manual control until the next
 *   `follow()` call.
 *
 * The camera always stays inside the world, so empty space is never shown.
 */
export default class CameraController {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} options
   * @param {Phaser.GameObjects.Components.Transform} options.target  object to follow
   * @param {() => boolean} options.isTweening  true while the target is walking
   * @param {() => boolean} options.canInteract  input is ignored while this is false
   * @param {(worldX: number, worldY: number, screenX: number, screenY: number) => void} options.onTap
   */
  constructor(scene, { target, isTweening, canInteract, onTap }) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.target = target;
    this.isTweening = isTweening;
    this.canInteract = canInteract;
    this.onTap = onTap;

    this.following = true;
    this.destinationX = null;
    this.press = null; // the pointer currently held down, if any
    this.velocity = 0; // glide speed after a swipe, in world units per second
    this.panTarget = null; // scroll position being glided to by panTo()

    this.camera.setBounds(0, 0, WORLD.width, WORLD.height);
    this.camera.scrollX = this.clampScroll(target.x - this.viewWidth / 2);

    const input = scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    input.on('pointerupoutside', this.onPointerUp, this);
    input.on('wheel', this.onWheel, this);
  }

  get viewWidth() {
    return this.camera.width / this.camera.zoom;
  }

  get maxScroll() {
    return Math.max(0, WORLD.width - this.viewWidth);
  }

  get isDragging() {
    return this.press?.dragging ?? false;
  }

  clampScroll(x) {
    return Phaser.Math.Clamp(x, 0, this.maxScroll);
  }

  /** Follow the target again; `destinationX` is where it is heading, if walking. */
  follow(destinationX = null) {
    this.following = true;
    this.destinationX = destinationX;
    this.velocity = 0;
    this.panTarget = null;
  }

  /** Glide the view to centre on world x. Following stays off until the next follow(). */
  panTo(worldX) {
    this.following = false;
    this.velocity = 0;
    this.panTarget = this.clampScroll(worldX - this.viewWidth / 2);
  }

  /** Jump straight to a scroll position (no smoothing). */
  jumpTo(scrollX) {
    this.camera.scrollX = this.clampScroll(scrollX);
  }

  // --- Pointer input ----------------------------------------------------------

  onPointerDown(pointer) {
    if (this.press || !this.canInteract()) return;

    const world = this.camera.getWorldPoint(pointer.x, pointer.y);
    this.press = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      worldX: world.x,
      worldY: world.y,
      startScroll: this.camera.scrollX,
      dragging: false,
      // A touch that stops a gliding view is not a tap
      stopsGlide: Math.abs(this.velocity) > TAP_BLOCKING_SPEED,
      tapX: pointer.x,
      tapY: pointer.y,
      samples: [{ t: pointer.event?.timeStamp ?? performance.now(), x: pointer.x }]
    };
    this.velocity = 0;
  }

  onPointerMove(pointer) {
    const press = this.press;
    if (!press || pointer.id !== press.id || !pointer.isDown) return;

    const dx = pointer.x - press.startX;
    if (!press.dragging && Math.hypot(dx, pointer.y - press.startY) >= CAMERA.dragThreshold) {
      press.dragging = true;
      this.following = false;
      this.panTarget = null;
      // Start from the current position so the view doesn't jump by the threshold
      press.startX = pointer.x;
      press.startScroll = this.camera.scrollX;
    }
    if (!press.dragging) return;

    this.camera.scrollX = this.clampScroll(press.startScroll - (pointer.x - press.startX) / this.camera.zoom);

    const now = pointer.event?.timeStamp ?? performance.now();
    press.samples.push({ t: now, x: pointer.x });
    while (press.samples.length > 2 && now - press.samples[0].t > FLING_SAMPLE_MS) press.samples.shift();
  }

  onPointerUp(pointer) {
    const press = this.press;
    if (!press || pointer.id !== press.id) return;
    this.press = null;

    if (press.dragging) {
      this.startGlide(press.samples, pointer);
      return;
    }
    if (!press.stopsGlide && this.canInteract()) this.onTap(press.worldX, press.worldY, press.tapX, press.tapY);
  }

  /** Keep the view moving after a swipe, at the speed of its last moments. */
  startGlide(samples, pointer) {
    const now = pointer.event?.timeStamp ?? performance.now();
    const last = samples[samples.length - 1];
    // A finger that rested before lifting doesn't fling
    if (samples.length < 2 || now - last.t > FLING_SAMPLE_MS) return;

    // Measure from the oldest move inside the window, or at least the move before
    // the last one (move events can be sparse on slow devices)
    let ref = samples.find(s => last.t - s.t <= FLING_SAMPLE_MS);
    if (ref === last) ref = samples[samples.length - 2];
    const elapsed = (last.t - ref.t) / 1000;
    if (elapsed <= 0) return;

    const fingerSpeed = (last.x - ref.x) / elapsed;
    this.velocity = Phaser.Math.Clamp(-fingerSpeed / this.camera.zoom, -CAMERA.maxFlingSpeed, CAMERA.maxFlingSpeed);
  }

  onWheel(pointer, gameObjects, deltaX, deltaY) {
    if (!this.canInteract()) return;
    // Trackpads send sideways scrolling as deltaX; a mouse wheel only has deltaY
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (delta === 0) return;
    this.following = false;
    this.velocity = 0;
    this.panTarget = null;
    this.camera.scrollX = this.clampScroll(this.camera.scrollX + delta * CAMERA.wheelSpeed);
  }

  // --- Per-frame update -------------------------------------------------------

  /** Call every frame with the real (unscaled) frame time in milliseconds. */
  update(deltaMs) {
    const dt = Math.min(deltaMs, 100) / 1000; // ignore huge gaps, e.g. after a background tab
    if (this.isDragging) return;

    if (this.velocity !== 0) {
      this.glide(dt);
    } else if (this.panTarget !== null) {
      if (this.ease(this.panTarget, dt)) this.panTarget = null;
    } else if (this.following) {
      this.ease(this.followScroll(), dt);
    }
  }

  /** Move part of the way towards a scroll position; returns true once there. */
  ease(desired, dt) {
    const blend = 1 - Math.exp(-CAMERA.followSharpness * dt);
    const next = this.camera.scrollX + (desired - this.camera.scrollX) * blend;
    // Settle exactly instead of creeping by fractions of a pixel forever
    const arrived = Math.abs(desired - next) < 0.5;
    this.camera.scrollX = arrived ? desired : next;
    return arrived;
  }

  glide(dt) {
    const next = this.camera.scrollX + this.velocity * dt;
    this.camera.scrollX = this.clampScroll(next);
    const hitEdge = this.camera.scrollX !== next;
    this.velocity *= Math.exp(-CAMERA.flingFriction * dt);
    if (hitEdge || Math.abs(this.velocity) < FLING_MIN_SPEED) this.velocity = 0;
  }

  /**
   * Where the camera wants to be while following: the smallest move that keeps
   * the target (and, while walking, its destination) inside the margins.
   */
  followScroll() {
    const view = this.viewWidth;
    const margin = Math.min(CAMERA.followMargin, view / 3);
    const x = this.target.x;
    const dest = this.destinationX !== null && this.isTweening() ? this.destinationX : x;

    const lo = Math.min(x, dest);
    const hi = Math.max(x, dest);
    let scroll = this.camera.scrollX;

    if (hi - lo > view - 2 * margin) {
      // Both don't fit: keep the target near the edge it is walking away from,
      // so as much as possible of the way ahead is visible
      scroll = dest >= x ? x - margin : x - (view - margin);
    } else {
      if (lo < scroll + margin) scroll = lo - margin;
      if (hi > scroll + view - margin) scroll = hi - (view - margin);
    }
    return this.clampScroll(scroll);
  }
}
