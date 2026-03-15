import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZES = [48, 72, 96, 128, 192, 256, 512];
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/assets/icons');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = '#111827';
  ctx.fill();

  const circleRadius = size * 0.333;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, circleRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f5f4';
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.font = `bold ${Math.round(size * 0.333)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', size / 2, size / 2 + size * 0.02);

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(OUTPUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated ${filePath} (${size}x${size})`);
}

console.log('All PWA icons generated.');
