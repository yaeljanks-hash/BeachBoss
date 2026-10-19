// Beach Boss helpers on top of the browser driver. They rely on the dev-only
// `window.beachBoss` hook (src/main.js), so tests run against the Vite dev server.
import { openPage, sleep } from './browser.mjs';

export { sleep };

/** Expression for the gameplay scene, for use inside page code. */
export const BEACH = `beachBoss.scene.getScene('BeachScene')`;

// Screen positions of the overlay buttons (game units; 1:1 on a 960x540 page)
export const START_BUTTON = [480, 395];
export const RESULT_BUTTONS = { left: [380, 395], right: [580, 395], center: [480, 395] };

// A plain-data picture of the game, read in one round trip
const SNAPSHOT = `(() => {
  const s = ${BEACH};
  const w = s.waitress;
  const cc = s.cameraController;
  const overlayActive = beachBoss.scene.isActive('ShiftOverlay');
  const edge = e => ({ visible: e.visible, kind: e.item?.kind ?? null, label: e.item?.label ?? null,
    badge: e.badge.visible ? e.badgeText.text : null, color: e.color });
  return {
    game: s.gameState.state, levelIndex: s.levelIndex, levelId: s.level.id,
    remaining: s.shift.remainingMs, revenue: s.shift.revenue, target: s.shift.target,
    served: s.shift.served, lost: s.shift.lost, total: s.registry.get('totalCoins'),
    overlay: overlayActive ? beachBoss.scene.getScene('ShiftOverlay').sys.settings.data?.mode : null,
    paused: beachBoss.scene.isPaused('BeachScene'),
    cam: { x: s.cameras.main.scrollX, following: cc.following, dragging: cc.isDragging,
           velocity: cc.velocity, panning: cc.panTarget !== null, max: cc.maxScroll },
    w: { x: w.x, y: w.y, carrying: w.carrying?.table.number ?? null, tickets: w.tickets.length,
         moving: s.tweens.isTweening(w), busy: !!w.activity },
    tables: s.tables.map(t => ({ n: t.number, x: t.x, y: t.y, state: t.fsm.state,
      cust: t.customer?.fsm.state ?? null, patience: t.customer?.patience ?? null,
      order: t.customer?.order?.fsm.state ?? null })),
    queue: s.queue.map(c => ({ state: c.fsm.state, patience: c.patience, x: c.x, y: c.y })),
    waiting: s.queue.filter(c => c.isWaiting).length,
    customers: s.customers.length,
    bar: { x: s.bar.x + s.bar.barWidth * s.bar.scaleX / 2, y: s.bar.y + s.bar.barHeight * s.bar.scaleY * 0.55 },
    barReady: s.bar.readyOrders.length, barBusy: s.bar.slots.filter(x => x.order).length,
    indicators: { left: edge(s.indicators.edges[0]), right: edge(s.indicators.edges[1]) },
    hint: s.hud.hintText.text
  };
})()`;

/** Open the game and wait until the first level's intro is up. */
export async function openGame(url, options) {
  const page = await openPage(url, options);
  const game = createGameHelpers(page);
  // The first load can take a while: Vite pre-bundles Phaser
  for (let i = 0; i < 150; i++) {
    await sleep(200);
    try {
      if (await page.evaluate(`!!window.beachBoss?.scene?.getScene('BeachScene')?.hud`)) break;
    } catch {
      // page still loading
    }
  }
  await sleep(300);
  return game;
}

function createGameHelpers(page) {
  const game = {
    page,
    snap: () => page.evaluate(SNAPSHOT),

    /** Poll until `condition(snapshot)` holds; returns the snapshot, or null on timeout. */
    async waitFor(condition, timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const s = await game.snap();
        if (condition(s)) return s;
        await sleep(40);
      }
      return null;
    },

    waitIdle: (timeoutMs) => game.waitFor(s => !s.w.moving && !s.w.busy, timeoutMs),

    /** Restart the scene at a level with a time multiplier; resolves once the intro shows. */
    async loadLevel(levelIndex, speed = 1) {
      await page.evaluate(`(() => { beachBoss.scene.stop('ShiftOverlay'); ${BEACH}.scene.restart({ levelIndex: ${levelIndex} }); })()`);
      await game.waitFor(s => s.levelIndex === levelIndex && s.overlay === 'intro' && s.game === 'ready', 5000).catch(() => null);
      await game.setSpeed(speed);
      await sleep(300);
    },

    setSpeed: speed => page.evaluate(`(() => { const s = ${BEACH}; s.time.timeScale = ${speed}; s.tweens.timeScale = ${speed}; })()`),

    /**
     * Tap an overlay button until `condition(snapshot)` holds. A card that has
     * only just appeared can miss a tap in its very first frame. Returns the
     * snapshot, or null if the button never responded.
     */
    async tapUntil(at, condition, tap = page.tap) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await tap(...at);
        const s = await game.waitFor(condition, 1000);
        if (s) return s;
      }
      return null;
    },

    /** Tap Start until the shift runs. */
    async pressStart(at = START_BUTTON, tap = page.tap) {
      return Boolean(await game.tapUntil(at, s => s.game === 'playing', tap));
    },

    /** Scroll position of the camera. */
    scroll: () => page.evaluate(`${BEACH}.cameras.main.scrollX`),

    /** Move the camera instantly (test shortcut) and let a frame render before any tap. */
    async jumpCamera(scrollX) {
      await page.evaluate(`(() => { const c = ${BEACH}.cameraController; c.following = false; c.velocity = 0; c.panTarget = null; c.jumpTo(${scrollX}); })()`);
      // Taps are mapped through the view that was last drawn
      await sleep(80);
    },

    /**
     * Tap a world point with the mouse on a 960x540 page. The camera is held still
     * for the tap and only moved if the point is off screen; the game resumes
     * following by itself if the tap sends the waitress somewhere.
     */
    async tapWorld(wx, wy) {
      const r = await page.evaluate(`(() => { const c = ${BEACH}.cameraController; c.following = false; c.velocity = 0; c.panTarget = null;
        let moved = false;
        if (${wx} < c.camera.scrollX + 60 || ${wx} > c.camera.scrollX + 900) { c.jumpTo(${wx} - 480); moved = true; }
        return { sx: c.camera.scrollX, moved }; })()`);
      await sleep(r.moved ? 80 : 20);
      await page.tap(wx - r.sx, wy);
    },

    async tapTable(n) {
      const t = (await game.snap()).tables[n - 1];
      await game.tapWorld(t.x, t.y - 45);
    },

    async tapBar() {
      const b = (await game.snap()).bar;
      await game.tapWorld(b.x, b.y);
    },

    close: () => page.close()
  };
  return game;
}
