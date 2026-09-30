// Library features: tag reading, covers, sorting, search, Up Next queue, now-playing,
// seek dragging, session resume, karaoke, network streams and the mobile layout.
import { launch, openPage, createSuite, addFiles, trackRow, trackMenu, shownTime, isPlaying, fixture, BASE } from './harness.mjs';

const { check, finish, errors } = createSuite('library');
const browser = await launch();
const page = await openPage(browser, errors);
const rowNames = () => page.$$eval('tbody tr td:nth-child(3) span:first-child', els => els.map(e => e.textContent));

await page.goto(BASE);
await addFiles(page, ['02-aurora.mp3', '01-borealis.mp3', 'zephyr.flac']);
await page.waitForSelector('tbody >> text=Aurora', { timeout: 10000 });
await page.waitForTimeout(600);
const aurora = trackRow(page, 'Aurora');
check('MP3 title from tags', (await rowNames()).includes('Aurora'));
check('FLAC title from tags', (await rowNames()).includes('Zephyr'));
check('artist and album from tags', /Test Artist[\s\S]*Northern Lights/.test(await aurora.textContent()));
check('duration from tags', (await aurora.textContent()).includes('0:08'));
const cover = await aurora.locator('img').getAttribute('src');
check('embedded cover downscaled to a small JPEG', cover.startsWith('data:image/jpeg') && cover.length < 100_000);

await page.locator('select').first().selectOption('album');
await page.waitForTimeout(200);
const byAlbum = await rowNames();
check('album sort respects track numbers', byAlbum.indexOf('Borealis') < byAlbum.indexOf('Aurora'));

await page.keyboard.press('/');
await page.waitForTimeout(150);
check('"/" focuses search', await page.evaluate(() => document.activeElement?.getAttribute('type') === 'search'));
await page.keyboard.type('ambient');
await page.waitForTimeout(200);
check('search matches genre', (await page.locator('tbody tr').count()) === 2);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape clears search', (await page.locator('tbody tr').count()) === 3);

await trackRow(page, 'Borealis').click();
await page.waitForTimeout(500);
check('now-playing panel and tab title', (await page.title()).startsWith('Borealis · Test Artist'));

await trackMenu(page, 'Zephyr', 'Play next');
check('Up Next lists the queued track', (await page.locator('aside', { hasText: 'Up Next' }).locator('text=Zephyr').count()) === 1);
await page.keyboard.press('n');
await page.waitForTimeout(400);
check('queued track plays before list order', (await page.title()).startsWith('Zephyr'));

// drag the seek bar while paused
await page.locator('[data-play-toggle]').click();
const bar = page.locator('[data-seekbar]').last();
const box = await bar.boundingBox();
await page.mouse.move(box.x + 5, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(300);
const dragged = await shownTime(page);
check(`seek bar drags (${dragged})`, dragged === '0:02');

// karaoke toggles
await page.locator('header button:has(svg.lucide-mic)').click();
await page.waitForTimeout(200);
check('karaoke mode toggles on', (await page.locator('header button:has(svg.lucide-mic)').getAttribute('class')).includes('text-cyan-400'));
await page.locator('header button:has(svg.lucide-mic)').click();

// resume after reload
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector('tbody tr');
await page.waitForTimeout(800);
check('sort preference persists', (await page.locator('select').first().inputValue()) === 'album');
check('last track restored, paused', (await page.title()).startsWith('Zephyr') && !(await isPlaying(page)));
check('playback position restored', (await shownTime(page)) === dragged);
const volume = await page.evaluate(() => JSON.parse(localStorage.getItem('penko-preferences')).volume);
check('volume persists', Math.abs(volume - 0.8) < 0.01);

// albums & artists
await page.locator('aside button', { hasText: 'Albums' }).click();
await page.waitForSelector('[data-album-grid]');
check('album grid lists albums', (await page.locator('[data-album-grid] > button').count()) === 2);
await page.locator('[data-album-grid] button', { hasText: 'Northern Lights' }).click();
check('album view lists its tracks in track order', (await rowNames()).join() === 'Borealis,Aurora');
await page.locator('[data-play-all]').click();
await page.waitForTimeout(400);
check('Play all starts the album', (await page.title()).startsWith('Borealis'));
await page.locator('button', { hasText: 'Albums' }).first().click();
await page.locator('aside button', { hasText: 'Artists' }).click();
await page.waitForSelector('[data-artist-list]');
check('artist list shows artists', (await page.locator('[data-artist-list] > button').count()) === 2);
await page.locator('[data-artist-list] button', { hasText: 'Another Band' }).click();
check('artist view shows their tracks', (await rowNames()).join() === 'Zephyr');
await page.locator('aside button', { hasText: 'All Tracks' }).click();

// synced lyrics embedded in tags
await trackRow(page, 'Zephyr').click();
await page.waitForTimeout(300);
await page.locator('[data-lyrics-button]').last().click();
await page.waitForSelector('[data-lyrics]');
check('embedded lyrics shown', (await page.locator('[data-lyrics]').textContent()).includes('Second line'));
await page.waitForTimeout(2600);
const activeLine = await page.locator('[data-lyrics] p.font-semibold').textContent();
check(`current lyric line highlighted (${activeLine})`, ['Second line', 'Third line'].includes(activeLine));
await page.locator('[data-lyrics] p', { hasText: 'First line' }).click();
await page.waitForTimeout(300);
check('clicking a lyric line seeks there', (await shownTime(page)) === '0:00');
await page.locator('header button[title="List View"], header button:has(svg.lucide-list)').first().click();

// sidecar .lrc attached when dropped on its own
await addFiles(page, ['tone-a.mp3']);
await page.waitForSelector('tbody >> text=tone-a');
await page.locator('aside input[type=file][multiple]').first().setInputFiles(fixture('tone-a.lrc'));
await page.waitForTimeout(400);
await trackRow(page, 'tone-a').click();
await page.waitForTimeout(300);
check('.lrc file attached to the matching track', (await page.locator('[data-lyrics-button]').count()) > 0);

// edit info
await trackMenu(page, 'tone-a', 'Edit info');
await page.locator('[role=dialog] input').first().fill('Renamed Tone');
await page.locator('[data-save-edits]').click();
await page.waitForTimeout(300);
check('edit info renames the track', (await trackRow(page, 'Renamed Tone').count()) === 1);

// direct network stream
await page.locator('header button:has(svg.lucide-globe)').click();
await page.locator('input[placeholder^="https://example.com"]').fill(`${BASE}does-not-exist.mp3`);
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('direct stream URL added', (await trackRow(page, 'does-not-exist.mp3').count()) === 1);

// mobile layout
const mobile = await openPage(browser, errors, { viewport: { width: 390, height: 800 } });
await mobile.goto(BASE);
await mobile.locator('header button:has(svg.lucide-menu)').click();
check('mobile menu offers Add Files', await mobile.locator('label', { hasText: 'Add Files' }).first().isVisible());
await mobile.locator('label', { hasText: 'Add Files' }).first().locator('input').setInputFiles(fixture('tone-b.mp3'));
await mobile.waitForSelector('tbody tr');
check('mobile row actions visible without hover', await mobile.locator('tbody tr').first().locator('.track-menu-container > button').isVisible());

await browser.close();
finish();
