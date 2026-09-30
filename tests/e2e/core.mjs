// Core player: adding files, playback, keyboard, playlists, markers, sleep timer, EQ,
// languages, persistence across reloads, and no third-party requests.
import { launch, openPage, createSuite, addFiles, trackRow, trackMenu, toasts, shownTime, isPlaying, BASE } from './harness.mjs';

const { check, finish, errors } = createSuite('core');
const browser = await launch();
const page = await openPage(browser, errors);

const external = [];
page.on('request', r => {
  const u = new URL(r.url());
  if (/^https?:$/.test(u.protocol) && u.hostname !== 'localhost') external.push(r.url());
});

await page.goto(BASE);
await addFiles(page, ['tone-a.mp3', 'tone-b.mp3']);
await page.waitForSelector('tbody >> text=tone-a');
check('files added to library', (await page.locator('tbody tr').count()) === 2);

await addFiles(page, ['tone-a.mp3']);
await page.waitForTimeout(300);
check('duplicate upload rejected', (await page.locator('tbody tr').count()) === 2 && (await toasts(page)).includes('All files are already in your library'));

await trackRow(page, 'tone-a').click();
await page.waitForTimeout(1300);
check('playback advances', (await shownTime(page)) !== '0:00');

await page.keyboard.press(' ');
await page.waitForTimeout(300);
check('space pauses', !(await isPlaying(page)));
await page.keyboard.press(' ');
await page.waitForTimeout(300);
check('space resumes', await isPlaying(page));

await page.keyboard.press('n');
await page.waitForTimeout(400);
check('"n" plays next track', (await page.title()).startsWith('tone-b'));

// playlists
await page.locator('aside button[title="Create Playlist"]').click();
await page.locator('aside input[placeholder]').fill('Mix');
await page.keyboard.press('Enter');
await trackMenu(page, 'tone-a', 'Mix');
await page.waitForTimeout(300);
check('track added to playlist', /Mix\s*1/.test(await page.locator('aside').textContent()));
await page.locator('aside button', { hasText: 'Mix' }).first().click();
check('playlist view shows its tracks', (await page.locator('tbody tr').count()) === 1);

// chapter marker (current track is tone-b)
await page.locator('[data-seekbar]').last().click({ button: 'right', position: { x: 50, y: 5 } });
await page.waitForTimeout(300);
check('marker added from seek bar', (await page.locator('aside >> text=Marker 1').count()) === 1);

// sleep timer
await page.locator('header button[title="Sleep Timer"]').click();
await page.locator('button', { hasText: '15 min' }).click();
const t1 = await page.locator('p.text-4xl').textContent();
await page.waitForTimeout(2200);
check('sleep timer counts down', t1 !== (await page.locator('p.text-4xl').textContent()));
await page.locator('button', { hasText: 'Cancel Timer' }).click();
await page.locator('button', { hasText: /^Close$/ }).click();

// EQ preset
await page.locator('header button[title="Equalizer"]').click();
await page.locator('button', { hasText: 'Bass Boost' }).click();
await page.waitForTimeout(200);
check('EQ preset applied and saved', (await page.evaluate(() => JSON.parse(localStorage.getItem('eq-settings'))[0].gain)) === 8);
await page.locator('div.backdrop-blur-sm button:has(svg.lucide-x)').first().click();

// languages
await page.locator('.language-menu-container button').first().click();
await page.locator('.language-menu-container button', { hasText: '中文' }).click();
await page.waitForTimeout(200);
check('Chinese UI is translated', (await page.locator('aside').textContent()).includes('播放列表'));
await page.locator('.language-menu-container button').first().click();
await page.locator('.language-menu-container button', { hasText: 'English' }).click();

// persistence
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector('tbody >> text=tone-a');
await page.locator('aside button', { hasText: 'All Tracks' }).click();
check('tracks persist', (await page.locator('tbody tr').count()) === 2);
check('playlist persists', /Mix\s*1/.test(await page.locator('aside').textContent()));
const markerCount = await page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('penko-tune-library');
  r.onsuccess = () => { const q = r.result.transaction('markers').objectStore('markers').count(); q.onsuccess = () => res(q.result); };
}));
check('marker persists', markerCount === 1);
await trackRow(page, 'tone-a').click();
await page.waitForTimeout(900);
check('persisted track plays', await isPlaying(page));

// removing a track also removes it from playlists
const row = trackRow(page, 'tone-a');
await row.hover();
await row.locator('button[title="Remove from library"]').click();
await page.waitForTimeout(300);
check('track removed', (await page.locator('tbody tr').count()) === 1);
check('removed track purged from playlist', /Mix\s*0/.test(await page.locator('aside').textContent()));

// magnet link starts P2P resolution (no peers expected)
await page.locator('header button[title="Network Stream"], header button:has(svg.lucide-globe)').first().click();
await page.locator('input[placeholder^="https://example.com"]').fill('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Friend%27s%20Song');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('magnet link added with its name', (await trackRow(page, "Friend's Song").count()) === 1);

check(`no third-party HTTP requests${external.length ? ': ' + external.join(', ') : ''}`, external.length === 0);

await browser.close();
finish();
