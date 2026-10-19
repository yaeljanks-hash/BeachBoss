// One-shot visual effects. Each creates its own objects and cleans them up.
// Positions are world coordinates unless `fixed` is set, in which case they are
// screen coordinates and the effect ignores camera scrolling (used for HUD-level
// messages).
import { DEPTH } from '../config.js';
import { drawCoin } from './icons.js';

/** Short floating message that drifts up and fades out. */
export function showToast(scene, x, y, message, color = '#ffffff', { fixed = false } = {}) {
  const text = scene.add
    .text(x, y, message, { fontSize: '20px', color, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setShadow(1, 1, '#000000', 3)
    .setDepth(DEPTH.hud)
    .setScrollFactor(fixed ? 0 : 1);

  scene.tweens.add({
    targets: text,
    y: y - 30,
    alpha: 0,
    duration: 1300,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy()
  });
  return text;
}

/** Burst of little sparkles, for a job well done. */
export function sparkle(scene, x, y, colors = [0xfff176, 0xffffff, 0x80deea], { fixed = false } = {}) {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dot = scene.add
      .star(x, y, 4, 2, 5, colors[i % colors.length])
      .setDepth(fixed ? DEPTH.hud : DEPTH.effects)
      .setScrollFactor(fixed ? 0 : 1);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * 34,
      y: y + Math.sin(angle) * 34,
      angle: 180,
      alpha: 0,
      scale: 0.4,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => dot.destroy()
    });
  }
}

/**
 * "+N" text over the guest and a few coins that fly up to the coin counter.
 * `from` is in world coordinates and `to` (the HUD counter) in screen coordinates.
 * `onLanded` runs once, when the first coin reaches the counter.
 */
export function coinReward(scene, from, amount, to, onLanded) {
  const text = scene.add
    .text(from.x, from.y, `+${amount}`, { fontSize: '28px', color: '#ffd54f', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setStroke('#8d5a00', 4)
    .setDepth(DEPTH.hud);
  scene.tweens.add({
    targets: text,
    y: from.y - 40,
    alpha: { from: 1, to: 0 },
    duration: 1400,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy()
  });

  // The coins fly in screen space, so they reach the fixed HUD even if the camera moves
  const camera = scene.cameras.main;
  const startX = from.x - camera.scrollX;
  const startY = from.y - camera.scrollY;

  let landed = false;
  const coins = Math.min(5, Math.max(3, Math.round(amount / 4)));
  for (let i = 0; i < coins; i++) {
    const g = scene.add.graphics().setDepth(DEPTH.hud).setScrollFactor(0);
    drawCoin(g, 0, 0, 10);
    g.setPosition(startX + (i - coins / 2) * 10, startY + 10);

    scene.tweens.add({
      targets: g,
      x: to.x,
      y: to.y,
      delay: 150 + i * 90,
      duration: 650,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        g.destroy();
        if (!landed) {
          landed = true;
          onLanded?.();
        }
      }
    });
  }
}
