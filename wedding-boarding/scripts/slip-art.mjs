// Draws the two pictures every boarding slip can carry, as 1-bit PNGs 384
// dots wide — the POS58's full print width, so print-slip.ps1 lays them 1:1
// on the head (src/lib/printer.ts reads them from assets/):
//
//   assets/slip-logo.png         the wedding logo — the couple and "J&F" in
//                                one line, the drawing on the invitation's
//                                app icon — at the foot of every slip
//   assets/slip-signature.png    "Jurapan & Patipon" in the invitation's
//                                script (Alex Brush), signing the couple's
//                                note to each guest
//   assets/slip-placeholder.png  the couple themselves, walking up the forest
//                                railway (the invitation's us-forest-walk
//                                photo, copied to assets/source), printed
//                                where the guest's photo would be when there
//                                isn't one
//
// The logo is read straight out of src/components/ui/CoupleMark.tsx, so the
// slip can never drift from the mark the screens use. It prints black on the
// paper without the icon's green disc: a solid disc is a block of burnt
// thermal paper, the line drawing alone reads as the logo.
//
// Run again after changing the mark, the photo, or the sizes below:
//   npm run slip-art

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const assets = path.join(root, "assets");
await mkdir(assets, { recursive: true });

/** The POS58 burns 384 dots across its 48 mm print width. */
const DOTS = 384;

// --- the logo ---------------------------------------------------------------

/** The drawing's width in dots — about 14 mm on the slip (19 mm tall). */
const LOGO_DOTS = 112;
/** A touch of stroke on every shape, in the drawing's own units: the finest
 * lines are under two dots wide at this size and would break up otherwise.
 * Scaled with LOGO_DOTS, so the lines keep their weight in dots. */
const EMBOLDEN = 2.1;

const source = await readFile(path.join(root, "src/components/ui/CoupleMark.tsx"), "utf8");
const viewBox = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
const shapes = [...source.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
if (!viewBox || shapes.length === 0) throw new Error("Could not read the drawing out of CoupleMark.tsx");

const [vbW, vbH] = [Number(viewBox[1]), Number(viewBox[2])];
const logoH = Math.round((LOGO_DOTS * vbH) / vbW);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_DOTS}" height="${logoH}" viewBox="0 0 ${vbW} ${vbH}">
  <g fill="#000" stroke="#000" stroke-width="${EMBOLDEN}" stroke-linejoin="round">
    ${shapes.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>
</svg>`;

// Drawn at 4× and brought down, so the edges are judged from a smooth
// picture before they are cut to pure black and white.
const logo = await sharp(Buffer.from(svg), { density: 72 * 4 }).resize(LOGO_DOTS, logoH).png().toBuffer();

await toOneBit(
  await sharp({ create: { width: DOTS, height: logoH, channels: 3, background: "#ffffff" } })
    .composite([{ input: logo, left: Math.round((DOTS - LOGO_DOTS) / 2), top: 0 }])
    .png()
    .toBuffer(),
  path.join(assets, "slip-logo.png"),
);

// --- the signature -------------------------------------------------------------

/**
 * The couple's names in Alex Brush, the script the invitation and the iPad
 * set them in. The printing laptop doesn't have that font, so the names go
 * to the slip as a picture. The letters are traced from the font into
 * outlines here and drawn like the logo, so nothing depends on fonts
 * installed on this machine either. assets/source/AlexBrush-Regular-latin.ttf
 * is the Latin part of Google Fonts' Alex Brush (SIL Open Font License).
 */
const SIGNATURE_FONT = path.join(assets, "source", "AlexBrush-Regular-latin.ttf");
/** The names' width in dots — about 40 mm, which keeps the small letters
 * about 1.3 mm tall. */
const SIGNATURE_DOTS = 320;
/** Stroke added to every letter, as a share of the font size: the script's
 * hairlines would otherwise print as broken dots. */
const SIGNATURE_EMBOLDEN = 0.012;

const weddingSource = await readFile(path.join(root, "src/lib/wedding.ts"), "utf8");
const one = weddingSource.match(/\bone:\s*"([^"]+)"/)?.[1];
const two = weddingSource.match(/\btwo:\s*"([^"]+)"/)?.[1];
if (!one || !two) throw new Error("Could not read the couple's names out of src/lib/wedding.ts");

const fontBytes = await readFile(SIGNATURE_FONT);
const script = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const FONT_SIZE = 100;
const traced = script.getPath(`${one} & ${two}`, 0, 0, FONT_SIZE);
const box = traced.getBoundingBox();
const pad = FONT_SIZE * SIGNATURE_EMBOLDEN;
const [sx, sy, sw, sh] = [box.x1 - pad, box.y1 - pad, box.x2 - box.x1 + 2 * pad, box.y2 - box.y1 + 2 * pad];
const signatureH = Math.round((SIGNATURE_DOTS * sh) / sw);

const signatureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIGNATURE_DOTS}" height="${signatureH}" viewBox="${sx} ${sy} ${sw} ${sh}">
  <path d="${traced.toPathData(2)}" fill="#000" stroke="#000" stroke-width="${FONT_SIZE * SIGNATURE_EMBOLDEN}" stroke-linejoin="round"/>
</svg>`;
const signature = await sharp(Buffer.from(signatureSvg), { density: 72 * 4 })
  .resize(SIGNATURE_DOTS, signatureH)
  .png()
  .toBuffer();

await toOneBit(
  await sharp({ create: { width: DOTS, height: signatureH, channels: 3, background: "#ffffff" } })
    .composite([{ input: signature, left: Math.round((DOTS - SIGNATURE_DOTS) / 2), top: 0 }])
    .png()
    .toBuffer(),
  path.join(assets, "slip-signature.png"),
);

// --- the placeholder ----------------------------------------------------------

/** Square, like the boarding photo it stands in for, so every slip is the
 * same length. Cut from the lower part of the portrait photo (912×1168):
 * the two of them large enough to read, with the curve of the tracks beside
 * them and the trees above. */
const PLACEHOLDER_SOURCE = path.join(assets, "source", "us-forest-walk.webp");
const PLACEHOLDER_CROP = { left: 130, top: 448, width: 720, height: 720 };

const { data: grey } = await sharp(PLACEHOLDER_SOURCE)
  .extract(PLACEHOLDER_CROP)
  .resize(DOTS, DOTS)
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });

const dots = ditherPhoto(grey, DOTS, DOTS);
await toOneBit(dots, path.join(assets, "slip-placeholder.png"), { width: DOTS, height: DOTS, channels: 1 });

console.log(
  `Wrote assets/slip-logo.png (${DOTS}×${logoH}), assets/slip-signature.png (${DOTS}×${signatureH}) ` +
    `and assets/slip-placeholder.png (${DOTS}×${DOTS})`,
);

/**
 * Cuts a picture to pure black (0) and white (255) and saves it as a plain
 * greyscale PNG. A separate pass from the drawing: sharp composites last, so
 * a threshold in the same pipeline would run before the drawing is laid on.
 * And not a 2-colour palette PNG, whose quantiser picks its own "black" and
 * "white" (35 and 253) — off-white a printer driver may speckle.
 */
async function toOneBit(input, file, raw) {
  await sharp(input, raw ? { raw } : undefined)
    .greyscale()
    .threshold(150)
    .toColourspace("b-w")
    .png({ compressionLevel: 9 })
    .toFile(file);
}

/**
 * The same four steps the iPad puts a guest's photo through
 * (src/lib/dither.ts), on a greyscale buffer instead of a canvas, so the
 * placeholder prints exactly like the photos around it: auto-levels, a gamma
 * lift against dot gain, a light sharpen, then Atkinson dithering.
 */
function ditherPhoto(pixels, width, height) {
  const GAMMA = 0.65;
  const SHARPEN = 0.7;
  const n = width * height;
  const lum = Float32Array.from(pixels);

  const histogram = new Uint32Array(256);
  for (const value of lum) histogram[Math.min(255, Math.round(value))]++;
  const percentile = (p) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= n * p) return v;
    }
    return 255;
  };
  const lo = percentile(0.01);
  const hi = Math.max(lo + 1, percentile(0.99));
  for (let i = 0; i < n; i++) {
    lum[i] = 255 * Math.pow(Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo))), GAMMA);
  }

  const blurred = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          sum += lum[yy * width + xx];
          count++;
        }
      }
      blurred[y * width + x] = sum / count;
    }
  }
  for (let i = 0; i < n; i++) lum[i] = Math.min(255, Math.max(0, lum[i] + SHARPEN * (lum[i] - blurred[i])));

  const spread = (x, y, err) => {
    if (x < 0 || x >= width || y >= height) return;
    lum[y * width + x] += err;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = lum[i];
      const value = old < 128 ? 0 : 255;
      lum[i] = value;
      const err = (old - value) / 8;
      spread(x + 1, y, err);
      spread(x + 2, y, err);
      spread(x - 1, y + 1, err);
      spread(x, y + 1, err);
      spread(x + 1, y + 1, err);
      spread(x, y + 2, err);
    }
  }
  return Buffer.from(lum, (v) => (v < 128 ? 0 : 255));
}
