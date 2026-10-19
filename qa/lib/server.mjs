// Starts the Vite dev server for a QA run (or uses QA_URL if one is given).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sleep } from './browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Returns { url, stop() }. */
export async function startDevServer(port = Number(process.env.QA_PORT ?? 4180)) {
  if (process.env.QA_URL) return { url: process.env.QA_URL, stop: () => {} };

  const url = `http://localhost:${port}/`;
  const vite = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  vite.stdout.on('data', chunk => (output += chunk));
  vite.stderr.on('data', chunk => (output += chunk));
  let exited = false;
  vite.on('exit', () => (exited = true));

  // Wait for this server's own "ready" line, so another server already on the
  // port is never mistaken for ours
  for (let i = 0; i < 150; i++) {
    if (exited) throw new Error(`Vite could not start on port ${port} (already in use? set QA_PORT):\n${output}`);
    if (/ready in/i.test(output)) {
      if ((await fetch(url).catch(() => null))?.ok) return { url, stop: () => vite.kill() };
    }
    await sleep(200);
  }
  vite.kill();
  throw new Error(`Vite did not start on ${url}:\n${output}`);
}
