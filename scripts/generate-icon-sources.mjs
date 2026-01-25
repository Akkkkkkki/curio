#!/usr/bin/env node
/**
 * Generate PNG source files for @capacitor/assets from the existing SVG icon.
 * Run: node scripts/generate-icon-sources.mjs
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');

// Ensure assets directory exists
mkdirSync(assetsDir, { recursive: true });

// Curio brand colors (from existing SVG)
const DARK_BG = '#111827';
const LIGHT_CIRCLE = '#f5f5f4';
const TEXT_COLOR = '#111827';

function drawCurioIcon(ctx, size, withBackground = true) {
  const center = size / 2;
  const circleRadius = size * 0.34; // ~176/512
  const cornerRadius = size * 0.1875; // ~96/512

  // Background (rounded rect)
  if (withBackground) {
    ctx.fillStyle = DARK_BG;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, cornerRadius);
    ctx.fill();
  }

  // Light circle
  ctx.fillStyle = LIGHT_CIRCLE;
  ctx.beginPath();
  ctx.arc(center, center, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  // Letter C
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `bold ${size * 0.35}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('C', center, center + size * 0.02);
}

// Generate icon-only.png (1024x1024, used for iOS)
const iconSize = 1024;
const iconCanvas = createCanvas(iconSize, iconSize);
const iconCtx = iconCanvas.getContext('2d');
drawCurioIcon(iconCtx, iconSize, true);
writeFileSync(join(assetsDir, 'icon-only.png'), iconCanvas.toBuffer('image/png'));
console.log('Created assets/icon-only.png');

// Generate icon-foreground.png (1024x1024, for Android adaptive icons)
// This should be the logo centered with padding for safe zone
const fgCanvas = createCanvas(iconSize, iconSize);
const fgCtx = fgCanvas.getContext('2d');
// Android adaptive icons need ~66% safe zone, so scale down
const fgScale = 0.6;
const fgOffset = (iconSize - iconSize * fgScale) / 2;
fgCtx.translate(fgOffset, fgOffset);
fgCtx.scale(fgScale, fgScale);
// Draw just the circle and C (no background)
const fgCenter = iconSize / 2;
const fgCircleRadius = iconSize * 0.34;
fgCtx.fillStyle = LIGHT_CIRCLE;
fgCtx.beginPath();
fgCtx.arc(fgCenter, fgCenter, fgCircleRadius, 0, Math.PI * 2);
fgCtx.fill();
fgCtx.fillStyle = TEXT_COLOR;
fgCtx.font = `bold ${iconSize * 0.35}px Inter, sans-serif`;
fgCtx.textAlign = 'center';
fgCtx.textBaseline = 'middle';
fgCtx.fillText('C', fgCenter, fgCenter + iconSize * 0.02);
writeFileSync(join(assetsDir, 'icon-foreground.png'), fgCanvas.toBuffer('image/png'));
console.log('Created assets/icon-foreground.png');

// Generate icon-background.png (1024x1024, solid color for Android adaptive)
const bgCanvas = createCanvas(iconSize, iconSize);
const bgCtx = bgCanvas.getContext('2d');
bgCtx.fillStyle = DARK_BG;
bgCtx.fillRect(0, 0, iconSize, iconSize);
writeFileSync(join(assetsDir, 'icon-background.png'), bgCanvas.toBuffer('image/png'));
console.log('Created assets/icon-background.png');

// Generate splash.png (2732x2732, centered logo)
const splashSize = 2732;
const splashCanvas = createCanvas(splashSize, splashSize);
const splashCtx = splashCanvas.getContext('2d');
// Fill background
splashCtx.fillStyle = DARK_BG;
splashCtx.fillRect(0, 0, splashSize, splashSize);
// Draw centered icon (smaller, ~20% of splash)
const splashIconSize = splashSize * 0.2;
const splashOffset = (splashSize - splashIconSize) / 2;
splashCtx.translate(splashOffset, splashOffset);
splashCtx.scale(splashIconSize / iconSize, splashIconSize / iconSize);
// Just the circle and C on the dark background
const splashCenter = iconSize / 2;
const splashCircleRadius = iconSize * 0.34;
splashCtx.fillStyle = LIGHT_CIRCLE;
splashCtx.beginPath();
splashCtx.arc(splashCenter, splashCenter, splashCircleRadius, 0, Math.PI * 2);
splashCtx.fill();
splashCtx.fillStyle = TEXT_COLOR;
splashCtx.font = `bold ${iconSize * 0.35}px Inter, sans-serif`;
splashCtx.textAlign = 'center';
splashCtx.textBaseline = 'middle';
splashCtx.fillText('C', splashCenter, splashCenter + iconSize * 0.02);
writeFileSync(join(assetsDir, 'splash.png'), splashCanvas.toBuffer('image/png'));
console.log('Created assets/splash.png');

console.log('\nDone! Run: npx capacitor-assets generate');
