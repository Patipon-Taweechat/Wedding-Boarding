import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import QRCode from "qrcode";

/**
 * The QR code on the slip's missions section, drawn as a 1-bit PNG 384 dots
 * wide — the POS58's full width, so print-slip.ps1 lays it 1:1 on the head
 * — with the code centred in it. Every module is a whole number of dots
 * (≥ 6, about 0.75 mm), which is what keeps a thermal print scannable: a
 * thermal dot bleeds a little, so 3-dot modules (~0.4 mm) smeared together
 * and wouldn't scan on the POS58.
 *
 * Drawn once per link and kept in the system temp folder; a new MISSION_URL
 * (or size) gets a new file. Server-only.
 */

const DOTS = 384;
/** At most how wide the code (quiet zone included) should print, in dots —
 * about 28 mm of the 48 mm paper, so each module is ~6 dots (~0.75 mm). */
const TARGET_DOTS = 224;
/** Never smaller than this per module, even for a long link. */
const MIN_MODULE_DOTS = 6;
/** The white margin a scanner needs around the code, in modules. */
const QUIET = 4;

export async function missionQrPath(url: string): Promise<string> {
  // Keyed by the size too, so a change to TARGET_DOTS isn't hidden behind a
  // file drawn at the old size.
  const id = createHash("sha256").update(`${TARGET_DOTS}:${url}`).digest("hex").slice(0, 16);
  const file = path.join(os.tmpdir(), `wedding-boarding-mission-${id}.png`);
  if (existsSync(file)) return file;

  const modules = QRCode.create(url, { errorCorrectionLevel: "M" }).modules;
  const span = modules.size + 2 * QUIET;
  // Capped so a long link (more modules) still fits the paper.
  const scale = Math.min(Math.floor(DOTS / span), Math.max(MIN_MODULE_DOTS, Math.floor(TARGET_DOTS / span)));
  const side = span * scale;
  const left = Math.floor((DOTS - side) / 2);

  // 1-bit greyscale: a set bit is white paper, a clear bit a burnt dot. Each
  // row starts with PNG's filter byte (0, none).
  const rowBytes = DOTS / 8;
  const raw = Buffer.alloc((rowBytes + 1) * side, 0xff);
  for (let y = 0; y < side; y++) raw[y * (rowBytes + 1)] = 0;

  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const y = (QUIET + row) * scale + dy;
        for (let dx = 0; dx < scale; dx++) {
          const x = left + (QUIET + col) * scale + dx;
          raw[y * (rowBytes + 1) + 1 + (x >> 3)] &= ~(0x80 >> (x & 7));
        }
      }
    }
  }

  await writeFile(file, encodePng(DOTS, side, raw));
  return file;
}

/** A minimal PNG writer for one 1-bit greyscale image — all the slip needs,
 * without pulling an image library into the print path. */
function encodePng(width: number, height: number, raw: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 1; // bit depth
  header[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
