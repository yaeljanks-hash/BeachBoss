// Minimal headless-Chrome driver over the DevTools protocol. No dependencies:
// it uses Node's built-in fetch and WebSocket (Node 22 or newer) and an
// installed Chrome or Edge.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const CALL_TIMEOUT_MS = 20000;

const BROWSER_CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
};

export function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = (BROWSER_CANDIDATES[process.platform] ?? []).find(path => existsSync(path));
  if (!found) throw new Error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.');
  return found;
}

// Browser profiles and screenshots live outside the repository
export const TEMP_DIR = join(tmpdir(), 'beachboss-qa');

/**
 * Open `url` in a fresh headless browser.
 * Options: port (DevTools port), width/height (page size), mobile, touch (emulate a
 * touch screen; must be set before the page loads so the game detects it).
 */
export async function openPage(url, { port, width = 960, height = 540, mobile = false, touch = false }) {
  const profile = join(TEMP_DIR, `profile-${port}`);
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile, { recursive: true });

  const browser = spawn(findBrowser(), [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) {
    await sleep(250);
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      // not listening yet
    }
  }
  if (!targets) {
    browser.kill();
    throw new Error(`Browser did not open its DevTools port ${port}`);
  }

  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  const consoleMessages = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && !['log', 'debug', 'info'].includes(msg.params.type)) {
      consoleMessages.push(`${msg.params.type}: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleMessages.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
  };

  // Every call times out, so a stuck page fails the run instead of hanging it
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`DevTools call ${method} timed out`));
      }, CALL_TIMEOUT_MS);
      pending.set(id, msg => {
        clearTimeout(timer);
        resolve(msg);
      });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const page = {
    consoleMessages,
    send,

    async evaluate(expression) {
      const { result } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) {
        throw new Error(`Page error: ${(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text).slice(0, 400)}`);
      }
      return result.result.value;
    },

    // --- Mouse (page pixels) ---------------------------------------------------
    async tap(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    async mouseDown(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    },
    async mouseMove(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    },
    async mouseUp(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    /** Press, move in steps over `ms`, and release straight after the last move. */
    async drag(from, to, { steps = 12, ms = 240 } = {}) {
      await page.mouseDown(...from);
      for (let i = 1; i <= steps; i++) {
        await page.mouseMove(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
        if (i < steps) await sleep(ms / steps);
      }
      await page.mouseUp(...to);
    },
    async wheel(x, y, deltaX, deltaY) {
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY });
    },

    // --- Touch (needs touch: true) ---------------------------------------------
    async touchTap(x, y) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(40);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async touchDrag(from, to, { steps = 12, ms = 240 } = {}) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
      for (let i = 1; i <= steps; i++) {
        const x = from[0] + ((to[0] - from[0]) * i) / steps;
        const y = from[1] + ((to[1] - from[1]) * i) / steps;
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        if (i < steps) await sleep(ms / steps); // lift straight after the last move, like a real flick
      }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },

    /** Save a screenshot when QA_SCREENSHOTS points at a folder; otherwise do nothing. */
    async screenshot(name) {
      const dir = process.env.QA_SCREENSHOTS;
      if (!dir) return;
      mkdirSync(dir, { recursive: true });
      const { result } = await send('Page.captureScreenshot');
      writeFileSync(join(dir, `${name}.png`), Buffer.from(result.data, 'base64'));
    },

    /** Close the browser and remove its temporary profile. Never throws. */
    async close() {
      try {
        ws.close();
      } catch {
        // already closed
      }
      const exited = new Promise(resolve => {
        if (browser.exitCode !== null) resolve();
        else browser.once('exit', resolve);
      });
      browser.kill();
      await Promise.race([exited, sleep(5000)]);
      try {
        // Windows can keep the profile locked for a moment after the browser exits
        rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {
        // Leftover profiles in the temp folder are harmless and replaced next run
      }
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  return page;
}
