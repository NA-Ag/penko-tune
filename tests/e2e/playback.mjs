// Playback engine: gapless hand-off, crossfade, repeat-one, practice speed (pitch preserved)
// and A-B looping.
import { launch, openPage, createSuite, addFiles, trackRow, shownTime, isPlaying, BASE } from './harness.mjs';

const { check, finish, errors } = createSuite('playback');
const browser = await launch();
const page = await openPage(browser, errors);
const seconds = async () => {
  const [m, s] = (await shownTime(page)).split(':').map(Number);
  return m * 60 + s;
};
const seekTo = async fraction => {
  const box = await page.locator('[data-seekbar]').last().boundingBox();
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
};

await page.goto(BASE);
await addFiles(page, ['tone-a.mp3', 'tone-b.mp3']);
await page.waitForSelector('tbody >> text=tone-b');
await page.waitForTimeout(600);

// --- gapless: tone-a (6s) flows straight into tone-b ---
await trackRow(page, 'tone-a').click();
await page.waitForTimeout(700);
await seekTo(0.85);
await page.waitForFunction(() => document.title.startsWith('tone-b'), null, { timeout: 8000 });
await page.waitForTimeout(400);
check('next track starts by itself at the end (gapless hand-off)', (await isPlaying(page)) && (await seconds()) <= 1);
const decks = await page.evaluate(() => [...document.querySelectorAll('audio')].length);
check(`no stray audio elements in the page (${decks})`, decks === 0);

// --- repeat one keeps the same track ---
await page.keyboard.press('r');
await page.keyboard.press('r');
await seekTo(0.9);
await page.waitForTimeout(1800);
check('repeat-one restarts the same track', (await page.title()).startsWith('tone-b') && (await seconds()) <= 2);
await page.keyboard.press('r'); // back to off

// --- practice speed ---
await page.locator('[data-speed-button]').last().click();
await page.locator('[data-speed-menu] button', { hasText: /^0\.5x$/ }).last().click();
await seekTo(0.05);
await page.waitForTimeout(300);
const before = await page.evaluate(() => performance.now());
const t0 = await seconds();
await page.waitForTimeout(3000);
const elapsedReal = (await page.evaluate(() => performance.now()) - before) / 1000;
const advanced = (await seconds()) - t0;
check(`0.5x plays at half speed (${advanced}s of audio in ${elapsedReal.toFixed(1)}s)`, advanced >= 1 && advanced <= 2);
await page.keyboard.press('>');
await page.keyboard.press('>');
await page.waitForTimeout(200);
check('">" steps the speed up', (await page.locator('[data-speed-button]').last().textContent()).includes('0.9x'));
await page.locator('[data-speed-button]').last().click();
await page.locator('[data-speed-menu] button', { hasText: /^1x$/ }).last().click();

// --- A-B loop ---
await seekTo(0.1);
await page.waitForTimeout(400);
await page.keyboard.press('l'); // A
await page.waitForTimeout(1600);
const loopEnd = await seconds(); // read B before pressing: once set, playback jumps straight back to A
await page.keyboard.press('l'); // B, about 1.6s later
const samples = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(300);
  samples.push(await seconds());
}
check(`A-B loop keeps playback inside the loop (${samples.join(',')}, end ${loopEnd}s)`, Math.max(...samples) <= loopEnd + 1);
check('loop region drawn on the seek bar', (await page.locator('[data-seekbar] .bg-amber-400\\/40').count()) > 0);
await page.keyboard.press('l'); // clear
await page.waitForTimeout(200);
check('third press clears the loop', (await page.locator('[data-seekbar] .bg-amber-400\\/40').count()) === 0);

// --- choosing a speed from the menu ---
await page.locator('[data-speed-button]').last().click();
await page.locator('[data-speed-menu] button', { hasText: /^0\.75x$/ }).last().click();
check('speed button shows the chosen speed', (await page.locator('[data-speed-button]').last().textContent()).includes('0.75x'));

// --- crossfade and normalization settings ---
await page.locator('header button[title="Settings"]').click();
await page.locator('[data-crossfade]').fill('3');
check('crossfade setting shows the chosen length', (await page.locator('[data-crossfade-value]').textContent()).includes('3'));
await page.locator('[data-normalize]').uncheck();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('penko-preferences')));
check('crossfade and normalization are saved', prefs.crossfade === 3 && prefs.normalize === false);

// With crossfade on, the next track takes over before the end. The engine caps the fade at a
// third of the track (2s for these 6s tones), so after seeking to ~2.4s (~3.6s left) the
// hand-off comes ~1.6s later instead of ~3.6s.
await page.locator('[data-speed-button]').last().click();
await page.locator('[data-speed-menu] button', { hasText: /^1x$/ }).last().click();
await trackRow(page, 'tone-a').click();
await page.waitForTimeout(700);
const tSeek = await page.evaluate(() => performance.now());
await seekTo(0.4); // ~2.4s into 6s, so ~3.6s remain
await page.waitForFunction(() => document.title.startsWith('tone-b'), null, { timeout: 8000 });
const handOffAfter = ((await page.evaluate(() => performance.now())) - tSeek) / 1000;
check(`crossfade starts the next track early (${handOffAfter.toFixed(1)}s after seeking, vs ~3.6s without)`, handOffAfter < 2.6);
await page.waitForTimeout(500);
check('next track is playing after the crossfade starts', await isPlaying(page));

await browser.close();
finish();
