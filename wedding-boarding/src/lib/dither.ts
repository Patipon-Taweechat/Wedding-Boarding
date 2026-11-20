/**
 * Turns a photo into pure black-and-white dots for the 58 mm thermal printer.
 *
 * A thermal head can only burn a dot or not, and each dot spreads a little
 * on the paper ("dot gain") — so a photo printed as-is comes out dark and
 * muddy. To make faces print bright and clean:
 *
 *   1. Auto-levels — stretch the 1st–99th percentile to full range, so a dim
 *      door light still gives a usable picture.
 *   2. Brighten — a strong gamma lift on the mid-tones plus a small exposure
 *      boost, to pre-compensate for dot gain. Skin lands in light grey, which
 *      prints as a sparse, airy dot pattern instead of a dense dark one.
 *   3. Sharpen — a light unsharp mask, so eyes, hair and outlines survive the
 *      drop to 384 dots.
 *   4. Atkinson dithering — diffuses only 6/8 of the error, so highlights
 *      clip to clean white paper and shadows stay solid: the crisp,
 *      high-key look that suits receipt paper, rather than Floyd–Steinberg's
 *      even (and on thermal paper, greyer) texture.
 *
 * The canvas is modified in place. Tune the constants below if prints come
 * out too light or too dark.
 */

/** < 1 brightens the mid-tones. 1 = no change. */
const GAMMA = 0.65;
/** Multiplier after the gamma lift; > 1 pushes light greys to white. */
const EXPOSURE = 1.0;
/** Unsharp-mask strength. 0 = off. */
const SHARPEN = 0.7;

export function ditherForThermal(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const n = width * height;

  // Luminance + histogram
  const lum = new Float32Array(n);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    lum[i] = l;
    histogram[Math.min(255, Math.round(l))]++;
  }

  // 1. Auto-levels
  const percentile = (p: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= n * p) return v;
    }
    return 255;
  };
  const lo = percentile(0.01);
  const hi = Math.max(lo + 1, percentile(0.99));

  // 2. Brighten
  for (let i = 0; i < n; i++) {
    const stretched = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)));
    lum[i] = Math.min(255, 255 * Math.pow(stretched, GAMMA) * EXPOSURE);
  }

  // 3. Sharpen: original + amount × (original − 3×3 box blur)
  if (SHARPEN > 0) {
    const blurred = new Float32Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            sum += lum[yy * width + xx];
            count++;
          }
        }
        blurred[y * width + x] = sum / count;
      }
    }
    for (let i = 0; i < n; i++) {
      lum[i] = Math.min(255, Math.max(0, lum[i] + SHARPEN * (lum[i] - blurred[i])));
    }
  }

  // 4. Atkinson dithering: 1/8 of the error to each of six neighbours.
  const spread = (x: number, y: number, err: number) => {
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

  for (let i = 0; i < n; i++) {
    const v = lum[i] < 128 ? 0 : 255;
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
