// One-shot visual effects. Each creates its own objects and cleans them up.
import { DEPTH } from '../config.js';
import { drawCoin } from './icons.js';

/** Short floating message that drifts up and fades out. */
export function showToast(scene, x, y, message, color = '#ffffff') {
  const text = scene.add
    .text(x, y, message, { fontSize: '16px', color, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setShadow(1, 1, '#000000', 3)
    .setDepth(DEPTH.hud);

  scene.tweens.add({
    targets: text,
    y: y - 30,
    alpha: 0,
    duration: 1300,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy()
  });
}

/** Burst of little sparkles, for a job well done. */
export function sparkle(scene, x, y, colors = [0xfff176, 0xffffff, 0x80deea]) {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dot = scene.add.star(x, y, 4, 2, 5, colors[i % colors.length]).setDepth(DEPTH.effects);
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
 * `onLanded` runs once, when the first coin reaches the counter.
 */
export function coinReward(scene, from, amount, to, onLanded) {
  const text = scene.add
    .text(from.x, from.y, `+${amount}`, { fontSize: '22px', color: '#ffd54f', fontStyle: 'bold' })
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

  let landed = false;
  const coins = Math.min(5, Math.max(3, Math.round(amount / 4)));
  for (let i = 0; i < coins; i++) {
    const g = scene.add.graphics().setDepth(DEPTH.hud);
    drawCoin(g, 0, 0, 8);
    g.setPosition(from.x + (i - coins / 2) * 8, from.y + 10);

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
