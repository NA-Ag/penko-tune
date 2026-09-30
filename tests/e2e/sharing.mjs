// Two-person features between two separate browsers (BROWSER_A sends/hosts, BROWSER_B
// receives/listens): encrypted share links with streaming, seeking and saving, and live
// listen-together sessions. Uses the public WebTorrent trackers, so it needs internet.
import { launch, openPage, createSuite, addFiles, trackRow, trackMenu, toasts, shownTime, BASE } from './harness.mjs';

const { check, finish, errors } = createSuite('sharing');
const [b1, b2] = [await launch(process.env.BROWSER_A), await launch(process.env.BROWSER_B)];
const captureGuestStream = () => {
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    set(v) { window.__guestStream = v; desc.set.call(this, v); },
    get() { return desc.get.call(this); },
  });
};
const sender = await openPage(b1, errors);
const friend = await openPage(b2, errors);
await sender.goto(BASE);
await friend.goto(BASE);

// --- share a playlist as "Send a copy" ---
await addFiles(sender, ['02-aurora.mp3', '01-borealis.mp3']);
await sender.waitForSelector('tbody >> text=Aurora');
await sender.waitForTimeout(800);
await sender.locator('aside button[title="Create Playlist"]').click();
await sender.locator('aside input[placeholder]').fill('Mix');
await sender.keyboard.press('Enter');
for (const name of ['Borealis', 'Aurora']) await trackMenu(sender, name, 'Mix');
const mixRow = sender.locator('aside div.group', { hasText: 'Mix' });
await mixRow.hover();
await mixRow.locator('button[title="Share with friends"]').click();
await sender.locator('button', { hasText: 'Send a copy' }).click();
await sender.locator('button', { hasText: 'Create link' }).click();
const linkInput = sender.locator('input[readonly]');
await linkInput.waitFor({ timeout: 15000 });
const link = await linkInput.inputValue();
check('share link created', /#share=[0-9a-f]{40}\.[A-Za-z0-9_-]{43}$/.test(link));
await sender.keyboard.press('Escape');
check('sender lists the active share', /Mix\s*Send a copy/.test(await sender.locator('aside').textContent()));

// --- friend receives, streams, seeks, saves ---
const t0 = Date.now();
await friend.goto(link);
await trackRow(friend, 'Aurora').waitFor({ timeout: 90000 }); // up to 3 connection attempts
check(`friend sees the shared playlist (${((Date.now() - t0) / 1000).toFixed(1)}s)`, (await friend.locator('tbody tr').count()) === 2);
check('key removed from the address bar', !friend.url().includes('#share'));

await trackRow(friend, 'Aurora').click();
await friend.waitForFunction(() => document.title.startsWith('Aurora'), null, { timeout: 20000 });
await friend.waitForTimeout(2500);
check(`received track streams (${await shownTime(friend)})`, (await shownTime(friend)) !== '0:00');
const box = await friend.locator('[data-seekbar]').last().boundingBox();
await friend.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
await friend.waitForTimeout(1500);
check(`seeking works while streaming (${await shownTime(friend)})`, (await shownTime(friend)) >= '0:05');

await friend.locator('button', { hasText: 'Save all' }).click();
await friend.waitForFunction(() => [...document.querySelectorAll('[data-toasts] span')].some(s => s.textContent === 'Saved to your library: 2'), null, { timeout: 30000 });
await friend.locator('aside button', { hasText: 'All Tracks' }).click();
await friend.waitForTimeout(500);
check('saved copies are in the library', (await friend.locator('tbody tr').count()) === 2);
check('saved playlist created', /Mix\s*2/.test(await friend.locator('aside').textContent()));
check('sender sees a connected peer', /Connected: [1-9]/.test(await sender.locator('aside').textContent()));

// --- listen together ---
await trackRow(sender, 'Aurora').click();
await sender.keyboard.press('r');
await sender.keyboard.press('r'); // repeat one, so audio keeps flowing
await sender.locator('header button[title="Listen together"]').click();
await sender.locator('button', { hasText: 'Start a session' }).click();
const roomInput = sender.locator('input[readonly]');
await roomInput.waitFor({ timeout: 15000 });
const roomLink = await roomInput.inputValue();
check('session link created', roomLink.includes('#listen='));

const guest = await openPage(b2, errors, { init: captureGuestStream });
await guest.goto(roomLink);
await guest.locator('button', { hasText: 'Join and listen' }).click({ timeout: 10000 });
const tJoin = Date.now();
await guest.waitForSelector('[role=dialog] >> text=Aurora', { timeout: 120000 });
check(`guest sees what's playing (joined in ${((Date.now() - tJoin) / 1000).toFixed(1)}s)`, true);
check('host sees a listener', (await sender.locator('text=/Listening: 1/').count()) === 1);
await guest.waitForFunction(() => window.__guestStream?.getAudioTracks().length > 0, null, { timeout: 30000 });
await guest.waitForTimeout(1500);
const peak = await guest.evaluate(async () => {
  const ctx = new AudioContext();
  await ctx.resume();
  const analyser = ctx.createAnalyser();
  ctx.createMediaStreamSource(window.__guestStream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let max = 0;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100));
    analyser.getFloatTimeDomainData(data);
    for (const v of data) max = Math.max(max, Math.abs(v));
  }
  return max;
});
check(`guest hears live audio (peak ${peak.toFixed(3)})`, peak > 0.01);

await b1.close();
await b2.close();
finish();
