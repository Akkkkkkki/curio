import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const ICON_SIZE = 1024;
const OUTPUT_PATH = path.resolve(process.cwd(), 'assets/icon.png');

function generateIcon() {
  const canvas = createCanvas(ICON_SIZE, ICON_SIZE);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f5f5f4'; // A neutral, light gray color
  ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

  // Letter
  ctx.fillStyle = '#1c1917'; // A dark, near-black color
  ctx.font = 'bold 600px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', ICON_SIZE / 2, ICON_SIZE / 2);

  // Save the file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OUTPUT_PATH, buffer);

  console.log(`Icon generated successfully at ${OUTPUT_PATH}`);
}

generateIcon();
