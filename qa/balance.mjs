// Balance simulation: a scripted player plays full shifts and reports revenue
// per level. Slow (each level is a real shift at 2x speed), so it is separate
// from `npm run qa`.
//
//   npm run qa:balance                          both profiles, all levels
//   npm run qa:balance -- --profile skilled --levels 4,5 --runs 2
//
// Profiles:
//   skilled  reacts in ~0.3 s of game time, takes several orders per bar trip,
//            serves the least patient guest first
//   casual   reacts in ~1.5 s, takes each ticket to the bar straight away,
//            serves tables in number order
// Runs are sequential on purpose: parallel browsers slow each other down and
// understate earnings.
import { startDevServer } from './lib/server.mjs';
import { openGame, sleep } from './lib/game.mjs';

const PROFILES = {
  skilled: { reactionMs: 300, batchesOrders: true, prioritisesPatience: true },
  casual: { reactionMs: 1500, batchesOrders: false, prioritisesPatience: false }
};
const SPEED = 2;
const MAX_REAL_MS_PER_LEVEL = 150000;

function parseArgs(argv) {
  const args = { profiles: Object.keys(PROFILES), levels: [1, 2, 3, 4, 5], runs: 1 };
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (argv[i] === '--profile') args.profiles = value.split(',');
    else if (argv[i] === '--levels') args.levels = value.split(',').map(Number);
    else if (argv[i] === '--runs') args.runs = Number(value);
  }
  return args;
}

/** The next tap for this profile, or null to wait. */
function decide(s, profile) {
  const tableTap = t => [t.x, t.y - 45];
  const bar = [s.bar.x, s.bar.y];

  // Seating never moves the waitress, so it is always worth doing first
  const emptyTable = s.tables.find(t => t.state === 'empty');
  if (s.waiting > 0 && emptyTable) return { what: 'seat', at: tableTap(emptyTable) };
  if (s.w.moving || s.w.busy) return null;

  if (s.w.carrying) return { what: 'deliver', at: tableTap(s.tables.find(t => t.n === s.w.carrying)) };

  let ready = s.tables.filter(t => t.cust === 'readyToOrder');
  if (profile.prioritisesPatience) ready = ready.sort((a, b) => a.patience - b.patience);
  const dirty = s.tables.find(t => t.state === 'dirty');

  if (profile.batchesOrders) {
    if (s.barReady > 0) return { what: 'bar', at: bar };
    if (ready.length) return { what: 'order', at: tableTap(ready[0]) };
    if (s.w.tickets > 0) return { what: 'bar', at: bar };
  } else {
    if (s.w.tickets > 0 || s.barReady > 0) return { what: 'bar', at: bar };
    if (ready.length) return { what: 'order', at: tableTap(ready[0]) };
  }
  if (dirty) return { what: 'clean', at: tableTap(dirty) };
  return null;
}

async function playLevel(game, levelId, profile) {
  await game.loadLevel(levelId - 1, SPEED);
  if (!(await game.pressStart())) throw new Error(`Level ${levelId} did not start`);

  const started = Date.now();
  let s = await game.snap();
  while (s.overlay !== 'results' && Date.now() - started < MAX_REAL_MS_PER_LEVEL) {
    const action = decide(s, profile);
    if (action) {
      // React after a delay, then act only if the same action still makes sense
      await sleep(profile.reactionMs / SPEED);
      const again = await game.snap();
      const confirm = again.overlay === 'results' ? null : decide(again, profile);
      if (confirm && confirm.what === action.what) {
        await game.tapWorld(...confirm.at);
        await sleep(80);
      }
    } else {
      await sleep(30);
    }
    s = await game.snap();
  }
  return s;
}

const args = parseArgs(process.argv.slice(2));
const server = await startDevServer();
const rows = [];
try {
  for (const profileName of args.profiles) {
    const profile = PROFILES[profileName];
    if (!profile) throw new Error(`Unknown profile "${profileName}"`);
    const game = await openGame(server.url, { port: 9361 });
    try {
      for (let run = 1; run <= args.runs; run++) {
        for (const levelId of args.levels) {
          const s = await playLevel(game, levelId, profile);
          const row = { profile: profileName, level: levelId, run, revenue: s.revenue, target: s.target, served: s.served, lost: s.lost, result: s.game };
          rows.push(row);
          console.log(`${profileName.padEnd(8)} L${levelId} run ${run}: ${String(s.revenue).padStart(3)} / ${s.target}  served ${s.served}, lost ${s.lost}  ${s.game === 'levelComplete' ? 'PASS' : 'FAIL'}`);
        }
      }
      if (game.page.consoleMessages.length) console.log('Console:', game.page.consoleMessages.join(' | '));
    } finally {
      await game.close();
    }
  }
} finally {
  server.stop();
}
console.log(`\nDone: ${rows.length} shifts simulated.`);
