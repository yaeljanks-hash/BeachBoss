// Off-screen indicators: direction, priority, badge, hiding, tap-to-pan, and
// that they never move the waitress.
import { openGame, sleep, BEACH } from '../lib/game.mjs';

export const id = 'indicators';
export const title = 'Off-screen indicators';

// Screen centre of the right-hand indicator (see src/ui/OffscreenIndicators.js)
const RIGHT = [908, 300];

export async function run({ url, check }) {
  const game = await openGame(url, { port: 9343 });
  const { page, snap, waitFor, waitIdle } = game;
  try {
    const setPatience = (n, p) => page.evaluate(`${BEACH}.tables[${n - 1}].customer.setPatience(${p})`);
    const centreOn = worldX => game.jumpCamera(worldX - 480);

    await game.loadLevel(0, 3);
    let s = await snap();
    check('No indicators before the shift starts', !s.indicators.left.visible && !s.indicators.right.visible);

    // Seat the two opening guests at Tables 3 and 2, then stop further arrivals
    await game.pressStart();
    await waitFor(s => s.waiting >= 2, 20000);
    await game.tapTable(3);
    await game.tapTable(2);
    await page.evaluate(`${BEACH}.spawnCustomer = () => {}`);
    s = await waitFor(s => s.tables[1].cust === 'readyToOrder' && s.tables[2].cust === 'readyToOrder', 20000);
    check('Setup: guests at Tables 2 and 3 are ready to order', !!s);
    await game.setSpeed(1);
    await setPatience(2, 0.2); // Table 2 is urgent
    await setPatience(3, 0.9);

    // Where each table's request is judged visible (its speech bubble) and where a pan centres
    const targets = await page.evaluate(`${BEACH}.attentionItems(0, 960).reduce((m, i) => ({ ...m, [i.label]: { x: i.x, panX: i.panX } }), {})`);

    // --- Direction, priority and badge -------------------------------------------------
    // Camera at the far right: both tables are off to the left
    await game.jumpCamera(10000);
    s = await snap();
    const { left, right } = s.indicators;
    check('Requests to the left show an indicator on the left edge only', left.visible && !right.visible);
    check('The most urgent request is shown (Table 2, low patience)', left.kind === 'order' && left.label === 'T2', `${left.kind} ${left.label}`);
    check('A badge counts the other requests on that side', left.badge === '+1', `badge=${left.badge}`);
    check('Urgent requests are red', left.color === 0xef5350, `color=${left.color?.toString(16)}`);
    await page.screenshot('indicators-left');

    // Camera at the far left: Table 2's guest is on screen, Table 3's is not
    await game.jumpCamera(0);
    s = await snap();
    check('Requests to the right show an indicator on the right edge only, for the off-screen table',
      s.indicators.right.visible && !s.indicators.left.visible && s.indicators.right.label === 'T3' && s.indicators.right.badge === null,
      `${s.indicators.right.label}, badge=${s.indicators.right.badge}`);
    await page.screenshot('indicators-right');

    await centreOn((targets.T2.x + targets.T3.x) / 2);
    s = await snap();
    check('Indicators hide when their targets are on screen', !s.indicators.left.visible && !s.indicators.right.visible);

    // --- Drawn above the world, fixed to the screen ------------------------------------------
    const layer = await page.evaluate(`(() => { const e = ${BEACH}.indicators.edges[1]; return { depth: e.depth, hud: ${BEACH}.hud.timeText.depth, sf: e.scrollFactorX }; })()`);
    check('Indicators are drawn above the world and fixed to the screen', layer.depth >= layer.hud && layer.sf === 0);

    // --- Tap to pan; never moves the waitress --------------------------------------------------
    await game.jumpCamera(0);
    const before = (await snap()).w;
    await page.tap(...RIGHT);
    await sleep(50);
    s = await snap();
    const panTo = targets.T3.panX - 480;
    check('Tapping an indicator starts a smooth camera pan', s.cam.panning && s.cam.x > 0 && s.cam.x < panTo - 100, `scrollX ${Math.round(s.cam.x)} just after the tap`);
    s = await waitFor(s => !s.cam.panning, 3000);
    check('The pan centres the camera on the requested table', Math.abs(s.cam.x - panTo) < 2, `scrollX=${Math.round(s.cam.x)}, expected ${Math.round(panTo)}`);
    check('Tapping an indicator does not move the waitress', Math.abs(s.w.x - before.x) < 1 && !s.w.moving && s.tables[2].cust === 'readyToOrder');
    check('After the pan the camera stays put (following stays off)', s.cam.following === false);
    check('The indicator hides once its table is on screen', !s.indicators.right.visible);

    await game.jumpCamera(0);
    await page.drag([RIGHT[0], RIGHT[1]], [RIGHT[0] - 400, RIGHT[1]], { steps: 8, ms: 160 });
    await waitFor(s => s.cam.velocity === 0, 3000);
    s = await snap();
    check('A drag that starts on an indicator just scrolls (no pan, no walking)', !s.cam.panning && s.cam.x > 300 && !s.w.moving, `scrollX=${Math.round(s.cam.x)}`);

    // --- Requests that are handled disappear ---------------------------------------------
    await setPatience(2, 0.001); // Table 2's guest walks out
    await sleep(200);
    await game.jumpCamera(10000);
    s = await snap();
    check('A request that no longer needs attention disappears', s.indicators.left.label === 'T3' && s.indicators.left.badge === null, `${s.indicators.left.label}, badge=${s.indicators.left.badge}`);
    check('Patient guests are shown in green', s.indicators.left.color === 0x66bb6a);

    // --- Other request types -------------------------------------------------------------
    await game.setSpeed(3);
    await game.tapTable(3);
    await waitIdle();
    await game.tapBar();
    await waitIdle();
    await waitFor(s => s.barReady > 0, 10000);
    await game.jumpCamera(10000);
    s = await snap();
    check('A ready order at the bar shows a pickup indicator', s.indicators.left.kind === 'pickup' && s.indicators.left.label === 'Bar', `${s.indicators.left.kind} ${s.indicators.left.label}`);

    await game.tapBar();
    await waitIdle();
    await game.jumpCamera(0);
    s = await snap();
    check('Carrying an order shows a deliver indicator for its table', s.indicators.right.kind === 'deliver' && s.indicators.right.label === 'T3', `${s.indicators.right.kind} ${s.indicators.right.label}`);
    await page.screenshot('indicators-deliver');

    await game.tapTable(3);
    await waitFor(s => s.tables[2].state === 'dirty', 15000);
    await game.jumpCamera(0);
    s = await snap();
    check('A dirty table shows a (calm, blue) cleaning indicator', s.indicators.right.kind === 'clean' && s.indicators.right.color === 0x4fc3f7);

    check('No console warnings or errors', page.consoleMessages.length === 0, page.consoleMessages.join(' | '));
  } finally {
    await game.close();
  }
}
