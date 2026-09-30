// Shared helpers for the end-to-end suites (plain Node + Playwright, no test framework).
// Each suite is a script: run it through tests/run.mjs, which builds and serves the app.
import { chromium, firefox } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export const BASE = process.env.BASE_URL || 'http://localhost:4173/';
export const BROWSER = process.env.BROWSER || 'chromium';
export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const fixture = name => join(FIXTURES, name);

/** Launch Chromium or Firefox with the same capabilities (autoplay, local WebRTC, storage prompts). */
export const launch = (name = BROWSER) =>
  name === 'firefox'
    ? firefox.launch({
        firefoxUserPrefs: {
          'media.autoplay.default': 0,
          'media.autoplay.blocking_policy': 0,
          'media.peerconnection.ice.obfuscate_host_addresses': false,
          'media.navigator.permission.disabled': true,
          'dom.storageManager.prompt.testing': true,
          'dom.storageManager.prompt.testing.allow': true,
        },
      })
    : chromium.launch({
        args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'],
      });

// Expected noise: tracker connections, the deliberately missing test stream, and Trystero
// logging normal peer disconnects when a test closes a browser.
const IGNORED_CONSOLE = /WebSocket|Failed to load resource|Audio Error|404|Trystero peer error/;

/** Open a page, collecting page errors and console errors into `errors`. */
export const openPage = async (browser, errors, { init, viewport = { width: 1400, height: 900 }, downloads = false } = {}) => {
  const context = await browser.newContext({ viewport, acceptDownloads: downloads });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !IGNORED_CONSOLE.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return page;
};

/** Minimal assertion collector: prints PASS/FAIL lines and exits non-zero on any failure. */
export const createSuite = name => {
  let failed = 0;
  let passed = 0;
  const errors = [];
  return {
    errors,
    check(label, condition) {
      if (condition) passed++;
      else failed++;
      console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`);
    },
    finish() {
      if (errors.length) console.log(`\nUnexpected errors:\n${errors.join('\n')}`);
      console.log(`\n${name} [${BROWSER}]: ${passed} passed, ${failed} failed`);
      process.exit(failed || errors.length ? 1 : 0);
    },
  };
};

// --- UI helpers shared by suites ---

export const addFiles = async (page, names) => {
  await page.locator('aside input[type=file][multiple]').first().setInputFiles(names.map(fixture));
};

export const trackRow = (page, name) => page.locator('tbody tr', { hasText: name });

/** Open a track's ⋮ menu and click an item. */
export const trackMenu = async (page, name, item) => {
  const row = trackRow(page, name);
  await row.hover();
  await row.locator('.track-menu-container > button').click();
  await page.locator('.track-menu-container button', { hasText: item }).click();
};

export const toasts = page => page.$$eval('[data-toasts] span', els => els.map(e => e.textContent));

/** The elapsed-time label left of the seek bar. */
export const shownTime = page =>
  page.locator('[data-seekbar]').last().evaluate(el => el.parentElement.firstElementChild.textContent);

export const isPlaying = async page =>
  (await page.locator('[data-play-toggle] svg').getAttribute('class')).includes('lucide-pause');
