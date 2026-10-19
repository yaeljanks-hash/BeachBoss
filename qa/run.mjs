// Runs the automated QA suites against the dev server in headless Chrome.
//
//   npm run qa                      all suites
//   npm run qa -- camera mobile     only the named suites
//
// Environment: CHROME_PATH (browser to use), QA_PORT (dev server port, default
// 4180), QA_URL (test an already running dev server), QA_SCREENSHOTS (folder to
// save screenshots in). Exits with code 1 if any check fails.
import { startDevServer } from './lib/server.mjs';
import * as gameplay from './suites/gameplay.mjs';
import * as camera from './suites/camera.mjs';
import * as indicators from './suites/indicators.mjs';
import * as mobile from './suites/mobile.mjs';

const SUITES = [gameplay, camera, indicators, mobile];

const wanted = process.argv.slice(2).map(name => name.toLowerCase());
const suites = wanted.length ? SUITES.filter(s => wanted.includes(s.id)) : SUITES;
if (!suites.length) {
  console.error(`Unknown suite. Available: ${SUITES.map(s => s.id).join(', ')}`);
  process.exit(2);
}

const server = await startDevServer();
process.on('SIGINT', () => {
  server.stop();
  process.exit(130);
});
const totals = [];
let crashed = false;

try {
  for (const suite of suites) {
    console.log(`\n=== ${suite.title} ===`);
    const results = [];
    const check = (name, ok, detail = '') => {
      results.push(Boolean(ok));
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
    };
    const started = Date.now();
    try {
      await suite.run({ url: server.url, check });
    } catch (error) {
      crashed = true;
      results.push(false);
      console.log(`FAIL  Suite stopped with an error: ${error.stack ?? error}`);
    }
    const passed = results.filter(Boolean).length;
    totals.push({ title: suite.title, passed, total: results.length });
    console.log(`--- ${passed}/${results.length} passed (${Math.round((Date.now() - started) / 1000)} s)`);
  }
} finally {
  server.stop();
}

console.log('\n=== Summary ===');
totals.forEach(t => console.log(`${t.passed === t.total ? 'PASS' : 'FAIL'}  ${t.title}: ${t.passed}/${t.total}`));
const failed = crashed || totals.some(t => t.passed !== t.total);
console.log(failed ? '\nSome checks failed.' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
