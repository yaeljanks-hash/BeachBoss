// Phone and tablet landscape with emulated touch: scaling, swipe and flick,
// touch taps, off-screen indicators, and no page scrolling or zooming. Page
// pixels differ from game units here, so positions go through the canvas size.
import { openGame, sleep, BEACH } from '../lib/game.mjs';

export const id = 'mobile';
export const title = 'Mobile touch';

const SCREENS = [
  { name: 'phone 844x390', width: 844, height: 390 }, // iPhone 12-15 landscape
  { name: 'phone 740x360', width: 740, height: 360 }, // small Android landscape
  { name: 'tablet 1180x820', width: 1180, height: 820 } // iPad Air landscape
];

export async function run({ url, check }) {
  for (const [i, screen] of SCREENS.entries()) {
    const game = await openGame(url, { port: 9351 + i, width: screen.width, height: screen.height, mobile: true, touch: true });
    const { page, snap, waitFor } = game;
    const c = (name, ok, detail) => check(`[${screen.name}] ${name}`, ok, detail);
    try {
      const rect = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
      const k = rect.w / 960;
      const toPage = (gx, gy) => [rect.x + gx * k, rect.y + gy * k];

      c('Game fits the screen in 16:9 without cropping',
        rect.x >= -0.5 && rect.y >= -0.5 && rect.x + rect.w <= screen.width + 0.5 && rect.y + rect.h <= screen.height + 0.5 && Math.abs(rect.w / rect.h - 960 / 540) < 0.01,
        `canvas ${Math.round(rect.w)}x${Math.round(rect.h)}, scale ${k.toFixed(2)}`);
      c('Touch input detected', (await page.evaluate('beachBoss.device.input.touch')) === true);

      await game.loadLevel(0, 1);
      const started = await game.pressStart(toPage(480, 395), page.touchTap);
      c('Start button works with a touch tap', started);

      // Swipe to scroll; the swipe must not move the waitress
      let s = await snap();
      const startX = s.cam.x;
      const waitressX = s.w.x;
      await page.touchDrag(toPage(800, 300), toPage(300, 300), { steps: 10, ms: 300 });
      s = await waitFor(s => s.cam.velocity === 0, 4000);
      c('Swiping left scrolls the beach', s.cam.x > startX + 300, `${Math.round(startX)} -> ${Math.round(s.cam.x)}`);
      c('The swipe did not move the waitress', !s.w.moving && Math.abs(s.w.x - waitressX) < 1);

      // Emulated touch events can arrive late on a busy machine, which the game
      // rightly reads as a finger that paused before lifting; allow 3 attempts
      let flick = null;
      for (let attempt = 1; attempt <= 3 && !flick; attempt++) {
        await game.jumpCamera(0);
        await page.touchDrag(toPage(700, 300), toPage(450, 300), { steps: 5, ms: 60 });
        const lifted = (await snap()).cam;
        await sleep(400);
        const after = (await snap()).cam;
        if (lifted.velocity > 0 && after.x > lifted.x + 20) flick = { attempt, from: lifted.x, to: after.x };
      }
      c('A quick flick keeps gliding after lift-off', !!flick,
        flick ? `${Math.round(flick.from)} -> ${Math.round(flick.to)} (attempt ${flick.attempt} of 3)` : 'no glide in 3 attempts');

      for (let n = 0; n < 6; n++) await page.touchDrag(toPage(850, 300), toPage(100, 300), { steps: 6, ms: 90 });
      s = await waitFor(s => s.cam.velocity === 0, 4000);
      c('Camera stops at the right edge of the world', s.cam.x === s.cam.max, `${s.cam.x}`);
      for (let n = 0; n < 6; n++) await page.touchDrag(toPage(100, 300), toPage(850, 300), { steps: 6, ms: 90 });
      s = await waitFor(s => s.cam.velocity === 0, 4000);
      c('Camera stops at the left edge of the world', s.cam.x === 0, `${s.cam.x}`);

      // Touch tap on the bar walks the waitress there
      const barSpot = await page.evaluate(`${BEACH}.bar.serviceSpot`);
      await page.touchTap(...toPage(s.bar.x - s.cam.x, s.bar.y));
      s = await waitFor(s => !s.w.moving && Math.abs(s.w.x - barSpot.x) < 3, 6000);
      c('Touch tap on the bar sends the waitress there', !!s);

      // Off-screen indicator: with every table off to the left, waiting guests point at a free table
      await waitFor(s => s.waiting > 0, 15000);
      await game.jumpCamera(10000);
      s = await waitFor(s => s.indicators.left.visible, 2000);
      c('An off-screen indicator appears for waiting guests', s?.indicators.left.kind === 'seat', `${s?.indicators.left.kind} ${s?.indicators.left.label}`);
      await page.screenshot(`mobile-${screen.width}-indicator`);
      const waitressBefore = (await snap()).w.x;
      await page.touchTap(...toPage(52, 300));
      s = await waitFor(s => !s.cam.panning && s.cam.x < s.cam.max - 100, 3000);
      c('Touch-tapping the indicator pans to the table without moving the waitress', !!s && Math.abs(s.w.x - waitressBefore) < 1 && !s.w.moving,
        s ? `scrollX now ${Math.round(s.cam.x)}` : 'no pan');

      const view = await page.evaluate(`({ sx: window.scrollX, sy: window.scrollY, zoom: window.visualViewport.scale, docW: document.documentElement.scrollWidth, vw: window.innerWidth })`);
      c('Page never scrolled or zoomed during touch play', view.sx === 0 && view.sy === 0 && view.zoom === 1 && view.docW <= view.vw, `scroll (${view.sx}, ${view.sy}), zoom ${view.zoom}`);

      const sizes = await page.evaluate(`(() => { const s = ${BEACH}; return { table: 165 * s.tables[0].scaleX, guest: 52 * s.waitress.scaleX }; })()`);
      const indicator = 64 + 14 + 20; // bubble + arrow + padding, game units
      c('Touch targets are at least 44 px (tables, guests, indicators)',
        sizes.table * k >= 44 && sizes.guest * k >= 44 && indicator * k >= 44,
        `table ${Math.round(sizes.table * k)} px, guest ${Math.round(sizes.guest * k)} px, indicator ${Math.round(indicator * k)} px wide`);

      c('No console warnings or errors', page.consoleMessages.length === 0, page.consoleMessages.join(' | '));
    } finally {
      await game.close();
    }
  }
}
