import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');
const inputFile = join(publicDir, 'penguin-tune-logo.svg');

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    const outputFile = join(publicDir, `pwa-${size}x${size}.png`);
    console.log(`Generating ${outputFile}...`);
    await sharp(inputFile)
      .resize(size, size)
      .png()
      .toFile(outputFile);
  }
  console.log('Icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});