// Camera and input regression for the scrolling world (desktop mouse, 960x540
// page, so page pixels equal game units): world bounds, drag vs tap, swipe
// glide, wheel, following the waitress, fixed HUD, reachability, travel time,
// and a full service round using only on-screen taps.
import { openGame, sleep, BEACH } from '../lib/game.mjs';

export const id = 'camera';
export const title = 'Camera and input';

export async function run({ url, check }) {
  const game = await openGame(url, { port: 9342 });
  const { page, snap, waitFor, waitIdle } = game;
  try {
    // Positions come from the game itself, so layout changes don't break the tests
    const spots = await page.evaluate(`(async () => { const s = ${BEACH}; const { LAYOUT, SPEED } = await import('/src/config.js');
      return { bar: s.bar.serviceSpot, tables: s.tables.map(t => t.serviceSpot), lane: LAYOUT.walkArea,
               tableFloorY: LAYOUT.tableFloorY, queueX: LAYOUT.queueSpots[0].x, start: LAYOUT.waitressStart, speed: SPEED.waitress }; })()`);
    // Tap the world point that is currently on screen at `wx` (no camera help)
    const tapOnScreen = async (wx, wy) => page.tap(wx - (await game.scroll()), wy);

    await game.loadLevel(0, 1);
    await page.evaluate(`${BEACH}.spawnCustomer = () => {}`); // a quiet beach for the camera checks
    await game.pressStart();
    let s = await snap();

    // --- World and bounds ----------------------------------------------------------
    const world = await page.evaluate(`(() => { const c = ${BEACH}.cameras.main; const b = c.getBounds(); return { w: b.width, h: b.height, vw: c.width, vh: c.height }; })()`);
    check('World is 2.5-3x the screen width, same height', world.w / world.vw >= 2.5 && world.w / world.vw <= 3 && world.h === world.vh, `${world.w}x${world.h} world, ${world.vw}x${world.vh} screen`);
    check('Camera starts on the waitress', s.w.x > s.cam.x + 100 && s.w.x < s.cam.x + 860, `waitress x=${Math.round(s.w.x)}, view ${Math.round(s.cam.x)}-${Math.round(s.cam.x + 960)}`);

    for (let i = 0; i < 6; i++) await page.drag([850, 300], [100, 300], { steps: 8, ms: 120 });
    s = await waitFor(s => s.cam.velocity === 0, 4000);
    check('Dragging left scrolls right and stops exactly at the right edge', s.cam.x === s.cam.max, `scrollX=${s.cam.x}, max=${s.cam.max}`);
    await page.screenshot('camera-right-edge');
    for (let i = 0; i < 6; i++) await page.drag([100, 300], [850, 300], { steps: 8, ms: 120 });
    s = await waitFor(s => s.cam.velocity === 0, 4000);
    check('Dragging right scrolls left and stops exactly at the left edge', s.cam.x === 0, `scrollX=${s.cam.x}`);
    await page.screenshot('camera-left-edge');
    check('Manual drag turns camera following off', s.cam.following === false);

    // --- Drag never acts; tap does --------------------------------------------------
    const w0 = (await snap()).w;
    await page.drag([300, 500], [700, 505], { steps: 10, ms: 200 }); // starts on the sand, where a tap would walk
    await sleep(400);
    s = await snap();
    check('A drag over the sand does not move the waitress', Math.abs(s.w.x - w0.x) < 1 && Math.abs(s.w.y - w0.y) < 1);

    await waitFor(s => s.cam.velocity === 0, 4000);
    const target = (await game.scroll()) + 400;
    await page.mouseDown(400, 500);
    await page.mouseMove(405, 503); // a little wobble, under the drag threshold
    await page.mouseUp(405, 503);
    s = await waitFor(s => !s.w.moving, 6000);
    check('A small wobble (under the drag threshold) is still a tap', Math.abs(s.w.x - target) < 3, `walked to x=${Math.round(s.w.x)}, expected ${Math.round(target)}`);
    check('A tap that moves the waitress turns following back on', s.cam.following === true);

    // --- Glide and tap-to-stop ------------------------------------------------------
    await game.jumpCamera(0);
    await page.drag([800, 300], [500, 300], { steps: 4, ms: 60 }); // quick swipe
    const atRelease = await game.scroll();
    await sleep(300);
    s = await snap();
    check('A fast swipe keeps the view gliding after release', s.cam.x > atRelease + 20, `release ${Math.round(atRelease)} -> ${Math.round(s.cam.x)} 300 ms later`);
    s = await waitFor(s => s.cam.velocity === 0, 4000);
    check('The glide slows down and stops inside the world', !!s && s.cam.x >= 0 && s.cam.x <= s.cam.max, `stopped at ${Math.round(s?.cam.x)}`);

    await game.jumpCamera(0);
    await page.drag([800, 300], [400, 300], { steps: 4, ms: 50 });
    await sleep(80);
    const glide = await snap();
    await page.tap(480, 505); // touch the gliding view
    await sleep(300);
    s = await snap();
    check('Tapping a gliding view stops it without sending the waitress',
      glide.cam.velocity > 200 && s.cam.velocity === 0 && Math.abs(s.w.x - glide.w.x) < 1 && !s.w.moving,
      `glide speed when touched: ${Math.round(glide.cam.velocity)}`);

    // --- Mouse wheel ---------------------------------------------------------------------
    await game.jumpCamera(300);
    await page.wheel(480, 300, 0, 300);
    await sleep(100);
    const afterWheel = await game.scroll();
    check('Mouse wheel scrolls the view', Math.abs(afterWheel - 600) < 1, `300 -> ${Math.round(afterWheel)}`);
    await page.wheel(480, 300, -200, 10);
    await sleep(100);
    check('Trackpad sideways scroll moves the view', Math.abs((await game.scroll()) - (afterWheel - 200)) < 1);

    // --- Following the waitress ------------------------------------------------------------
    // She is at the far table; the player drags over to the bar and taps it
    const far = spots.tables[spots.tables.length - 1];
    await page.evaluate(`${BEACH}.sendWaitress(${far.x}, ${far.y})`);
    await waitIdle();
    await sleep(800);
    for (let i = 0; i < 4; i++) await page.drag([200, 300], [800, 300], { steps: 8, ms: 120 });
    await waitFor(s => s.cam.velocity === 0, 4000);
    const barTap = (await snap()).bar;
    await tapOnScreen(barTap.x, barTap.y);
    const started = Date.now();
    let samples = 0;
    let visible = 0;
    while (Date.now() - started < 6000) {
      const t = await snap();
      if (!t.w.moving) break;
      if (Date.now() - started > 600) {
        samples++;
        if (t.w.x > t.cam.x + 20 && t.w.x < t.cam.x + 940) visible++;
      }
      await sleep(30);
    }
    s = await snap();
    check('Camera picks up the waitress and follows her across the world', samples > 10 && visible / samples > 0.95, `on screen in ${visible}/${samples} samples after the first 0.6 s`);
    check('She reached the bar, on screen when she arrives',
      Math.abs(s.w.x - spots.bar.x) < 3 && Math.abs(s.w.y - spots.bar.y) < 3 && s.w.x > s.cam.x && s.w.x < s.cam.x + 960,
      `(${Math.round(s.w.x)}, ${Math.round(s.w.y)}), view from ${Math.round(s.cam.x)}`);

    // Long walk: the camera shows the way ahead
    await game.jumpCamera(0);
    await page.evaluate(`${BEACH}.sendWaitress(${far.x}, ${far.y})`); // the same call a table tap makes
    let ahead = 0;
    for (let i = 0; i < 80; i++) {
      const t = await snap();
      if (!t.w.moving) break;
      ahead = Math.max(ahead, t.cam.x + 960 - t.w.x);
      await sleep(30);
    }
    check('While walking, the camera shows the way ahead', ahead > 600, `up to ${Math.round(ahead)} units visible ahead of her`);

    // Dragging overrides following mid-walk
    await waitIdle();
    await page.evaluate(`${BEACH}.sendWaitress(${spots.bar.x}, ${spots.bar.y})`);
    await sleep(200);
    await page.drag([300, 300], [700, 300], { steps: 6, ms: 100 });
    await waitFor(s => s.cam.velocity === 0, 3000); // let any swipe momentum finish
    const held = await game.scroll();
    await sleep(500);
    s = await snap();
    check('Dragging during a walk overrides following (view stays put)', s.cam.following === false && Math.abs(s.cam.x - held) < 2 && s.w.moving,
      `held ${Math.round(held)} -> ${Math.round(s.cam.x)}, waitress still walking=${s.w.moving}`);
    await waitIdle();

    // --- HUD stays fixed -----------------------------------------------------------------
    const hudScreenX = () => page.evaluate(`(() => { const h = ${BEACH}.hud; const c = ${BEACH}.cameras.main;
      return [h.timeText.x - c.scrollX * h.timeText.scrollFactorX, h.revenueText.x - c.scrollX * h.revenueText.scrollFactorX]; })()`);
    await game.jumpCamera(0);
    const hudA = await hudScreenX();
    await game.jumpCamera(10000);
    const hudB = await hudScreenX();
    check('HUD stays fixed on screen while the world scrolls', hudA[0] === hudB[0] && hudA[1] === hudB[1]);

    // --- Reachability and furniture --------------------------------------------------------
    const { lane } = spots;
    const inLane = p => p.x >= lane.minX && p.x <= lane.maxX && p.y >= lane.minY && p.y <= lane.maxY;
    check('Bar and all table service spots are inside the walking lane', inLane(spots.bar) && spots.tables.every(inLane));
    check('The walking lane is in front of the furniture (no walking through tables)', lane.minY > spots.tableFloorY + 20, `lane starts y=${lane.minY}, tables stand at y=${spots.tableFloorY}`);

    const queueView = Math.max(0, spots.queueX - 300);
    await game.jumpCamera(queueView);
    await page.tap(spots.queueX + 100 - queueView, 500);
    s = await waitFor(s => !s.w.moving, 8000);
    check('Waitress can walk to the waiting area', Math.abs(s.w.x - (spots.queueX + 100)) < 3, `x=${Math.round(s.w.x)}`);
    await game.jumpCamera(10000);
    await page.tap(955, 300);
    s = await waitFor(s => !s.w.moving, 8000);
    check('Tapping beyond the lane is clamped (she never leaves the world)', s.w.x <= lane.maxX && s.w.y >= lane.minY, `(${Math.round(s.w.x)}, ${Math.round(s.w.y)})`);

    const longest = Math.max(...spots.tables.map(t => Math.hypot(t.x - spots.bar.x, t.y - spots.bar.y))) / spots.speed;
    check('Longest service trip (bar to farthest table) is within 10% of v1.0 (2.03 s)', longest < 2.24, `${longest.toFixed(2)} s`);

    // --- A full service round using only on-screen taps ------------------------------------
    await page.evaluate(`delete ${BEACH}.spawnCustomer`); // normal arrivals again
    await game.loadLevel(0, 3);
    await game.pressStart();
    await waitFor(s => s.waiting > 0);
    for (let i = 0; i < 4; i++) await page.drag([800, 300], [200, 300], { steps: 8, ms: 100 });
    await waitFor(s => s.cam.velocity === 0, 4000);
    s = await snap();
    const guest = s.queue.find(q => q.state === 'waiting');
    await tapOnScreen(guest.x, guest.y - 60);
    await sleep(100);
    check('A waiting guest can be selected after scrolling to the line', await page.evaluate(`!!${BEACH}.selectedCustomer`));
    await page.screenshot('camera-waiting-area');

    const t1 = (await snap()).tables[0];
    for (let i = 0; i < 4; i++) await page.drag([200, 300], [800, 300], { steps: 8, ms: 100 });
    await waitFor(s => s.cam.velocity === 0, 4000);
    await tapOnScreen(t1.x, t1.y - 45);
    s = await waitFor(s => s.tables[0].cust === 'readyToOrder', 15000);
    check('The selected guest walks to Table 1 and gets ready to order', !!s);
    await game.tapTable(1);
    await waitIdle();
    await game.tapBar();
    await waitIdle();
    await waitFor(s => s.barReady > 0, 10000);
    await game.tapBar();
    await waitIdle();
    await page.screenshot('camera-carrying');
    await game.tapTable(1);
    await waitIdle();
    s = await waitFor(s => s.tables[0].state === 'dirty', 12000);
    check('Order, deliver and pay all work after scrolling', !!s && s.revenue > 0, `revenue=${s?.revenue}`);
    await game.tapTable(1);
    s = await waitFor(s => ['empty', 'reserved'].includes(s.tables[0].state), 6000);
    check('Cleaning works', !!s);

    check('No console warnings or errors', page.consoleMessages.length === 0, page.consoleMessages.join(' | '));
  } finally {
    await game.close();
  }
}
