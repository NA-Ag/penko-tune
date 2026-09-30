// Getting music out and back in: single-file download, .zip export/import, JSON backup,
// storage dialog, and linked folders (Chromium; OPFS stands in for a real folder).
import { statSync, readFileSync } from 'fs';
import { launch, openPage, createSuite, addFiles, trackRow, trackMenu, fixture, isPlaying, BROWSER, BASE } from './harness.mjs';

const { check, finish, errors } = createSuite('backup');
const browser = await launch();
const files = ['02-aurora.mp3', '01-borealis.mp3', 'zephyr.flac'];

// --- export ---
const a = await openPage(browser, errors, { downloads: true, init: () => { delete window.showSaveFilePicker; } });
await a.goto(BASE);
await addFiles(a, files);
await a.waitForSelector('tbody >> text=Aurora', { timeout: 10000 });
await a.waitForTimeout(800);
await a.locator('aside button[title="Create Playlist"]').click();
await a.locator('aside input[placeholder]').fill('Trip');
await a.keyboard.press('Enter');
await trackMenu(a, 'Aurora', 'Trip');

const [single] = await Promise.all([a.waitForEvent('download'), trackMenu(a, 'Aurora', 'Download file')]);
check(`download keeps the original file name (${single.suggestedFilename()})`, single.suggestedFilename() === '02-aurora.mp3');

await a.locator('aside button', { hasText: 'Storage & backup' }).click();
check('storage dialog shows protection status', (await a.locator('text=/Your library (is protected|could be cleared)/').count()) === 1);
const [zipDownload] = await Promise.all([a.waitForEvent('download'), a.locator('button', { hasText: 'Export library (.zip)' }).click()]);
const zipPath = await zipDownload.path();
const audioBytes = files.reduce((n, f) => n + statSync(fixture(f)).size, 0);
check('zip contains the audio', statSync(zipPath).size >= audioBytes);

a.on('dialog', d => d.accept('correct horse'));
const [jsonDownload] = await Promise.all([a.waitForEvent('download'), a.locator('button', { hasText: 'Library info only' }).click()]);
const jsonPath = await jsonDownload.path();
const backupJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
check('password-protected library info backup downloads, encrypted', backupJson.isEncrypted === true && !JSON.stringify(backupJson).includes('Northern Lights'));

// --- import into a fresh profile ---
const b = await openPage(browser, errors);
await b.goto(BASE);
await b.locator('aside button', { hasText: 'Storage & backup' }).click();
await b.locator('input[accept^=".zip"]').setInputFiles(zipPath);
await b.waitForEvent('load', { timeout: 15000 });
await b.waitForSelector('tbody >> text=Aurora', { timeout: 10000 });
check('import restores every track', (await b.locator('tbody tr').count()) === 3);
check('import restores tags', (await trackRow(b, 'Aurora').textContent()).includes('Northern Lights'));
check('import restores playlists', /Trip\s*1/.test(await b.locator('aside').textContent()));
await trackRow(b, 'Zephyr').click();
await b.waitForTimeout(1200);
check('imported track plays', (await b.title()).startsWith('Zephyr') && (await isPlaying(b)));

// --- linked folders ---
if (BROWSER === 'firefox') {
  const ff = await openPage(browser, errors);
  await ff.goto(BASE);
  await ff.waitForTimeout(1000);
  check('Firefox: Link Folder hidden (no File System Access API)', (await ff.locator('aside button', { hasText: 'Link Folder' }).count()) === 0);
  await ff.locator('aside button', { hasText: 'Storage & backup' }).click();
  check('Firefox: explains keeping original files instead', (await ff.locator('text=/Linking folders needs Chrome/').count()) === 1);
} else {
  const c = await openPage(browser, errors, {
    init: () => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Music', { create: true }); },
  });
  await c.goto(BASE);
  const stage = async names => {
    await c.evaluate(() => { if (!document.getElementById('stage')) { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'stage'; document.body.appendChild(i); } });
    await c.locator('#stage').setInputFiles(names.map(fixture));
    await c.evaluate(async () => {
      const music = await (await navigator.storage.getDirectory()).getDirectoryHandle('Music', { create: true });
      for (const f of document.getElementById('stage').files) {
        const w = await (await music.getFileHandle(f.name, { create: true })).createWritable();
        await w.write(f); await w.close();
      }
    });
  };
  await stage(files.slice(0, 2));
  await c.locator('aside button', { hasText: 'Link Folder' }).click();
  await c.waitForSelector('tbody >> text=Aurora', { timeout: 10000 });
  await c.waitForTimeout(800);
  check('linked folder adds tracks with tags', (await c.locator('tbody tr').count()) === 2);
  await stage([files[2]]);
  await c.locator('aside button', { hasText: 'Storage & backup' }).click();
  await c.locator('button[title="Rescan"]').click();
  await c.waitForSelector('tbody >> text=Zephyr', { timeout: 10000 });
  check('rescan picks up new files', (await c.locator('tbody tr').count()) === 3);
  await c.keyboard.press('Escape');
  await trackRow(c, 'Borealis').click();
  await c.waitForTimeout(1200);
  check('linked track plays from disk', (await c.title()).startsWith('Borealis') && (await isPlaying(c)));
  // Note: restoring linked folders after a restart isn't covered here; headless Chromium crashes
  // when reading OPFS handles back from IndexedDB (a test-environment limitation).
}

await browser.close();
finish();
