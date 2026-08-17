/**
 * Renders the Public Sample Gallery ("The Vinyl Vault") artwork.
 *
 * Each of the five seed items gets its own still-life so the pre-login gallery
 * reads as a loved, curated collection rather than five copies of one placeholder
 * (GitHub #373). The scene mirrors the original `sample-vinyl.jpg`: a cream sleeve
 * with a `CURIO / NO. 00X` accession stamp and a black record sliding out, lit on a
 * warm radial backdrop. Records differ by label colour, sleeve/backdrop warmth and
 * accession number — all within the DESIGN.md warm-metallic palette (no blue).
 *
 * The scene is pure CSS rendered in headless Chromium and captured as a progressive
 * JPEG, so the output stays a small, real binary (guarded by
 * tests/unit/publicAssets.regression.test.ts). Re-run after editing the palette:
 *
 *   node scripts/generate-sample-vinyl.mjs
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets');

const WIDTH = 1200;
const HEIGHT = 900;

/**
 * One entry per seed item. `file` matches the paths wired in
 * src/services/seedCollections.ts. Colours are warm earth tones so the set
 * feels like one collection while each record stays recognisably its own.
 */
const RECORDS = [
  {
    file: 'sample-vinyl.jpg', // Kind of Blue — brass
    accession: 'NO. 001',
    backdrop: ['#4a3623', '#140d07'],
    sleeve: '#F1E9D6',
    label: ['#CBA255', '#E7CE92'],
    rotation: -4,
  },
  {
    file: 'sample-vinyl-2.jpg', // A Love Supreme — oxblood
    accession: 'NO. 002',
    backdrop: ['#3f2419', '#120a06'],
    sleeve: '#EFE1C7',
    label: ['#8F3E30', '#C07061'],
    rotation: -6,
  },
  {
    file: 'sample-vinyl-3.jpg', // What's Going On — rust
    accession: 'NO. 003',
    backdrop: ['#4d3620', '#160d06'],
    sleeve: '#F3E9CB',
    label: ['#BC5E37', '#DE9066'],
    rotation: -3,
  },
  {
    file: 'sample-vinyl-4.jpg', // Rumours — olive bronze
    accession: 'NO. 004',
    backdrop: ['#40331f', '#120c06'],
    sleeve: '#EFE7D2',
    label: ['#7F6A33', '#B29B60'],
    rotation: -5,
  },
  {
    file: 'sample-vinyl-5.jpg', // Discovery — rose copper
    accession: 'NO. 005',
    backdrop: ['#472c20', '#150c07'],
    sleeve: '#F2E7D3',
    label: ['#B06E52', '#D69C82'],
    rotation: -2,
  },
];

const scene = ({ backdrop, sleeve, label, accession, rotation }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
      .stage {
        position: relative;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background:
          radial-gradient(120% 120% at 32% 26%, ${backdrop[0]} 0%, ${backdrop[1]} 68%),
          ${backdrop[1]};
      }
      /* Soft vignette to keep the corners quiet. */
      .stage::after {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(80% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.42) 100%);
        pointer-events: none;
      }
      .sleeve {
        position: absolute;
        left: 96px;
        top: 168px;
        width: 588px;
        height: 588px;
        border-radius: 6px;
        background: linear-gradient(150deg, ${sleeve} 0%, rgba(0,0,0,0.05) 160%);
        box-shadow:
          0 40px 70px rgba(0,0,0,0.55),
          inset 0 0 0 1px rgba(255,255,255,0.35);
        transform: rotate(${rotation}deg);
      }
      /* Faint impression of the record resting inside the sleeve. */
      .sleeve::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 52%;
        width: 470px;
        height: 470px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.02) 62%, transparent 66%);
      }
      .stamp {
        position: absolute;
        left: 52px;
        top: 44px;
        font-family: 'JetBrains Mono', ui-monospace, 'DejaVu Sans Mono', monospace;
        color: rgba(60, 44, 28, 0.55);
        line-height: 1.9;
      }
      .stamp .brand { font-size: 20px; font-weight: 700; letter-spacing: 0.42em; }
      .stamp .no { font-size: 14px; font-weight: 500; letter-spacing: 0.34em; }
      .record {
        position: absolute;
        right: 150px;
        top: 176px;
        width: 548px;
        height: 548px;
        border-radius: 50%;
        background:
          repeating-radial-gradient(circle at 50% 50%,
            rgba(255,255,255,0.05) 0px,
            rgba(255,255,255,0.05) 0.5px,
            rgba(0,0,0,0) 1px,
            rgba(0,0,0,0) 3px),
          radial-gradient(circle at 38% 32%, #2b2b2b 0%, #141414 42%, #060606 100%);
        box-shadow:
          0 44px 74px rgba(0,0,0,0.6),
          inset 0 0 2px rgba(255,255,255,0.18);
      }
      /* Specular sweep so the disc catches the light. */
      .record::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: conic-gradient(from 210deg at 50% 50%,
          rgba(255,255,255,0) 0deg,
          rgba(255,255,255,0.16) 40deg,
          rgba(255,255,255,0) 120deg,
          rgba(255,255,255,0) 240deg,
          rgba(255,255,255,0.08) 300deg,
          rgba(255,255,255,0) 360deg);
        mix-blend-mode: screen;
      }
      .label {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 196px;
        height: 196px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle at 40% 36%, ${label[1]} 0%, ${label[0]} 58%, ${label[0]} 100%);
        box-shadow: inset 0 0 0 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.25);
      }
      .label::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 150px;
        height: 150px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.12);
      }
      .hole {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 12px;
        height: 12px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: #050505;
        box-shadow: inset 0 0 2px rgba(0,0,0,0.8);
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="sleeve">
        <div class="stamp">
          <div class="brand">CURIO</div>
          <div class="no">${accession}</div>
        </div>
      </div>
      <div class="record">
        <div class="label"></div>
        <div class="hole"></div>
      </div>
    </div>
  </body>
</html>`;

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  for (const record of RECORDS) {
    await page.setContent(scene(record), { waitUntil: 'load' });
    const outPath = path.join(OUTPUT_DIR, record.file);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 82 });
    console.log(`rendered ${record.file}`);
  }
  await browser.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
