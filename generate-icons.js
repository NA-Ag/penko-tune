// Generates the favicon, app logo and PWA/desktop icons from the Penko Tune sprite
// (components/penko/penkoSprite.ts), so every icon matches the in-app mascot and the
// Penko Plaza listing. Run with: npm run generate-icons  (Node 22.18+ for .ts imports)
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PENKO_TUNE_FRAMES, spriteRects } from './components/penko/penkoSprite.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');
const TILE_COLOR = '#0f172a'; // Penko Plaza slate-900

const rectsSvg = (pad) =>
  spriteRects(PENKO_TUNE_FRAMES[0], pad)
    .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');

// Favicon: transparent background, just the mascot
writeFileSync(
  join(publicDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rectsSvg(0)}</svg>\n`
);

// App icon: mascot on the dark Penko tile, padded so it survives maskable cropping
const pad = 5;
const size = 16 + pad * 2;
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${TILE_COLOR}"/>${rectsSvg(pad)}</svg>\n`;
writeFileSync(join(publicDir, 'penko-tune-logo.svg'), appIcon);

const png = (px, file) =>
  sharp(Buffer.from(appIcon), { density: 2400 })
    .resize(px, px, { kernel: 'nearest' })
    .png()
    .toFile(join(publicDir, file));

await png(192, 'pwa-192x192.png');
await png(512, 'pwa-512x512.png');
await png(180, 'apple-touch-icon.png');

console.log('Icons generated.');
