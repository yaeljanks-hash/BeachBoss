// Gameplay regression: the full service loop, patience and walk-outs, shift
// timer, results, restart and level progression. Drives the game with real
// mouse taps. A few steps use the dev-only debug hook to fast-forward (lowering
// a guest's patience, skipping to the end of a shift); those are marked [hook].
import { openGame, sleep, BEACH, RESULT_BUTTONS } from '../lib/game.mjs';

export const id = 'gameplay';
export const title = 'Gameplay regression';

const SPEED = 6; // game time runs 6x faster than real time

// Expected once: the test calls endShift() twice on purpose
const EXPECTED_WARNINGS = [/ignored invalid transition levelFailed -> levelFailed/];

export async function run({ url, check }) {
  const game = await openGame(url, { port: 9341 });
  const { page, snap, waitFor, waitIdle } = game;
  try {
    // [hook] set the patience of the guest at a table, or the first waiting guest in line
    const setTablePatience = (n, p) => page.evaluate(`${BEACH}.tables[${n - 1}].customer.setPatience(${p})`);
    const setQueuePatience = p => page.evaluate(`${BEACH}.queue.find(c => c.isWaiting).setPatience(${p})`);
    // [hook] skip to the last moment of the shift
    const endShiftSoon = () => page.evaluate(`(() => { const t = ${BEACH}.shift.timer; t.elapsed = t.delay - 600; })()`);

    await game.loadLevel(0, SPEED);

    // --- Ready state -----------------------------------------------------------
    let s = await snap();
    check('Level starts in READY with the intro card', s.game === 'ready' && s.overlay === 'intro', `${s.game}, overlay=${s.overlay}`);
    const x0 = s.w.x;
    await page.tap(650, 500);
    await sleep(400);
    check('Taps on the beach are ignored before the shift starts', Math.abs((await snap()).w.x - x0) < 1);

    await game.pressStart();
    s = await snap();
    check('Start button begins the shift (PLAYING)', s.game === 'playing' && s.overlay === null);

    // --- Timer -------------------------------------------------------------------
    // Phaser slows game time down (instead of skipping ahead) when frames drop,
    // e.g. on a busy machine, so only require "counting, never faster than set"
    const t1 = Date.now();
    const r1 = (await snap()).remaining;
    await sleep(1000);
    const r2 = (await snap()).remaining;
    const rate = (r1 - r2) / (Date.now() - t1);
    check('Shift timer counts down at (up to) the game speed', rate > SPEED * 0.25 && rate <= SPEED * 1.2,
      `${rate.toFixed(1)}x real time at speed ${SPEED}x`);

    // --- Patience drains in line ---------------------------------------------------
    s = await waitFor(s => s.waiting > 0);
    const p1 = s.queue.find(c => c.state === 'waiting').patience;
    await sleep(500);
    const p2 = (await snap()).queue.find(c => c.state === 'waiting').patience;
    check('Waiting guest loses patience over time', p2 < p1, `${p1.toFixed(3)} -> ${p2.toFixed(3)}`);

    // --- Walk-out from the line ------------------------------------------------------
    s = await waitFor(s => s.waiting >= 2);
    const queueBefore = s.queue.length;
    await setQueuePatience(0.001);
    await sleep(250);
    s = await snap();
    check('Guest in line leaves when patience runs out [hook]', s.lost === 1 && s.queue.length === queueBefore - 1, `lost=${s.lost}, line ${queueBefore} -> ${s.queue.length}`);
    check('Guest who left unhappy did not pay', s.revenue === 0);

    // --- Walk-out while ready to order ---------------------------------------------
    await waitFor(s => s.waiting > 0);
    await game.tapTable(1);
    s = await waitFor(s => s.tables[0].cust === 'readyToOrder');
    check('Seated guest becomes ready to order', !!s);
    const seatedP1 = s.tables[0].patience;
    await sleep(400);
    const seatedP2 = (await snap()).tables[0].patience;
    check('Seated guest loses patience while waiting to order', seatedP2 < seatedP1, `${seatedP1.toFixed(3)} -> ${seatedP2.toFixed(3)}`);
    await setTablePatience(1, 0.001);
    await sleep(250);
    s = await snap();
    check('Seated guest walks out; table becomes available (not dirty) [hook]', s.tables[0].state === 'empty' && s.lost === 2, `table=${s.tables[0].state}, lost=${s.lost}`);
    await waitFor(s => s.waiting > 0);
    await game.tapTable(1);
    await sleep(150);
    s = await snap();
    check('Table can be reused after a walk-out', ['reserved', 'occupied'].includes(s.tables[0].state), s.tables[0].state);

    // --- Walk-out while the order is at the bar -----------------------------------
    await waitFor(s => s.tables[0].cust === 'readyToOrder');
    await game.tapTable(1);
    await waitIdle();
    s = await snap();
    check('Taking an order gives the waitress a ticket', s.w.tickets === 1 && s.tables[0].order === 'taken');
    await game.tapBar();
    await waitIdle();
    s = await snap();
    check('Ticket handed to the bar starts preparing', s.barBusy === 1 && s.w.tickets === 0);
    await setTablePatience(1, 0.001);
    await sleep(250);
    s = await snap();
    check('Walk-out cancels the order at the bar and frees the counter slot [hook]', s.barBusy === 0 && s.tables[0].state === 'empty', `barBusy=${s.barBusy}`);

    // --- Walk-out while the waitress carries the order ------------------------------
    await waitFor(s => s.waiting > 0);
    await game.tapTable(2);
    await waitFor(s => s.tables[1].cust === 'readyToOrder');
    await game.tapTable(2);
    await waitIdle();
    await game.tapBar();
    await waitIdle();
    await waitFor(s => s.barReady > 0);
    await game.tapBar();
    await waitIdle();
    s = await snap();
    check('Waitress picks up the ready order', s.w.carrying === 2, `carrying=${s.w.carrying}`);
    await setTablePatience(2, 0.001);
    await sleep(250);
    s = await snap();
    check('Walk-out empties the tray (order wasted) [hook]', s.w.carrying === null && s.tables[1].state === 'empty');
    check('No coins from any walk-out', s.revenue === 0 && s.lost === 4, `revenue=${s.revenue}, lost=${s.lost}`);

    // --- Normal service --------------------------------------------------------------
    await waitFor(s => s.waiting > 0);
    await game.tapTable(3);
    await waitFor(s => s.tables[2].cust === 'readyToOrder');
    await game.tapTable(3);
    await waitIdle();
    await game.tapBar();
    await waitIdle();
    await waitFor(s => s.barReady > 0);
    await game.tapBar();
    await waitIdle();
    await game.tapTable(3);
    await waitIdle();
    s = await waitFor(s => s.tables[2].cust === 'eating', 3000);
    check('Delivery works and guest starts eating', !!s);
    if (s) {
      const pe1 = s.tables[2].patience;
      await sleep(500);
      const pe2 = (await snap()).tables[2]?.patience;
      check('Patience is paused while eating', pe1 === pe2, `${pe1?.toFixed(3)} -> ${pe2?.toFixed(3)}`);
    }
    s = await waitFor(s => s.tables[2].state === 'dirty', 10000);
    check('Guest pays and leaves a dirty table', s && s.revenue > 0 && s.served === 1, `revenue=${s?.revenue}, served=${s?.served}`);
    await game.tapTable(3);
    s = await waitFor(s => ['empty', 'reserved'].includes(s.tables[2].state), 6000);
    check('Dirty table can be cleaned and reused', !!s);

    // --- Shift end and results ------------------------------------------------------
    s = await snap();
    const revenueAtEnd = s.revenue;
    const totalBefore = s.total;
    await endShiftSoon();
    s = await waitFor(s => s.overlay === 'results', 5000);
    check('Results screen appears when the timer reaches zero [hook: skipped ahead]', !!s);
    check('Below target -> LEVEL_FAILED and the beach is frozen', s?.game === 'levelFailed' && s?.paused, `${s?.game}, paused=${s?.paused}`);
    check('Shift revenue banked into total coins', s?.total === totalBefore + revenueAtEnd, `${totalBefore} + ${revenueAtEnd} = ${s?.total}`);
    const customersAtEnd = s?.customers;
    await sleep(1500);
    s = await snap();
    check('No new customers and no revenue change after the shift ends', s.customers === customersAtEnd && s.revenue === revenueAtEnd);
    await page.evaluate(`${BEACH}.endShift()`);
    await sleep(200);
    s = await snap();
    check('Calling endShift again does not change the result or bank twice', s.game === 'levelFailed' && s.total === totalBefore + revenueAtEnd);
    await page.tap(650, 500);
    await sleep(300);
    check('Beach ignores taps while results are showing', (await snap()).w.carrying === null);
    await page.screenshot('gameplay-results-failed');

    // --- Restart ---------------------------------------------------------------------
    const totalKept = s.total;
    s = await game.tapUntil(RESULT_BUTTONS.center, s => s.overlay === 'intro' && s.game === 'ready'); // "Try Again"
    check(
      'Try Again restarts the same level from a clean state',
      s && s.levelIndex === 0 && s.revenue === 0 && s.served === 0 && s.lost === 0 && s.customers === 0 &&
        s.w.carrying === null && s.w.tickets === 0 && s.tables.every(t => t.state === 'empty'),
      s ? `level ${s.levelId}, revenue ${s.revenue}, customers ${s.customers}` : 'no intro'
    );
    check('Total coins survive a restart', s?.total === totalKept);

    // --- Success -> next level ---------------------------------------------------------
    await game.setSpeed(SPEED);
    await game.pressStart();
    const reached = await page.evaluate(`${BEACH}.shift.addRevenue(${BEACH}.shift.target)`); // [hook] earn the target instantly
    check('Reaching the target is detected exactly once [hook]', reached === true && (await page.evaluate(`${BEACH}.shift.addRevenue(1)`)) === false);
    await page.evaluate(`${BEACH}.refreshUi()`);
    await endShiftSoon();
    s = await waitFor(s => s.overlay === 'results', 5000);
    check('Reaching the target -> LEVEL_COMPLETE', s?.game === 'levelComplete');
    await page.screenshot('gameplay-results-complete');
    s = await game.tapUntil(RESULT_BUTTONS.right, s => s.overlay === 'intro' && s.levelIndex === 1); // "Next Level"
    const sameConfig = await page.evaluate(
      `(async () => { const { LEVELS } = await import('/src/data/levels.js'); return JSON.stringify(${BEACH}.level) === JSON.stringify(LEVELS[1]); })()`
    );
    check('Next Level loads level 2 with its own configuration', !!s && s.levelId === 2 && sameConfig, `level ${s?.levelId}, target ${s?.target}`);

    // --- Last level: "From Level 1" -----------------------------------------------------
    await game.loadLevel(4, SPEED);
    await game.pressStart();
    await page.evaluate(`${BEACH}.shift.addRevenue(${BEACH}.shift.target)`);
    await endShiftSoon();
    await waitFor(s => s.overlay === 'results', 5000);
    s = await game.tapUntil(RESULT_BUTTONS.right, s => s.overlay === 'intro' && s.levelIndex === 0); // "From Level 1"
    check('After the final level, "From Level 1" returns to level 1', !!s);

    const unexpected = page.consoleMessages.filter(m => !EXPECTED_WARNINGS.some(re => re.test(m)));
    check('No unexpected console warnings or errors', unexpected.length === 0, unexpected.join(' | '));
  } finally {
    await game.close();
  }
}
