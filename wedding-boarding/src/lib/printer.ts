import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Guest } from "@/app/actions/boarding";
import { formatPhone, formatSeats } from "@/lib/format";
import { couple, venue, weddingDate } from "@/lib/wedding";

/**
 * Boarding slips on the receipt printer at the door.
 *
 * The printer hangs off the laptop running `next dev`, not the iPad — so the
 * iPad asks the server (a server action) and the server prints through the
 * Windows spooler via scripts/print-slip.ps1. Server-only: never import this
 * from a client component.
 */

/** The Windows printer name, as `Get-Printer` lists it. */
const PRINTER_NAME = process.env.PRINTER_NAME ?? "POS58 Printer";

type SlipLine =
  | { type: "text"; text: string; size?: number; bold?: boolean; align?: "left" | "center" | "right" }
  | { type: "image"; path: string }
  | { type: "row"; label: string; value: string }
  | { type: "rule" }
  | { type: "space" };

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * Boarding photos live on the laptop, one pair per guest, overwritten by each
 * retake — so the slip (and any reprint) always carries the latest photo:
 *   photos/{token}.jpg        colour keepsake for the couple
 *   photos/{token}-print.png  1-bit dithered copy the POS58 prints
 * The folder is gitignored.
 */
const PHOTO_DIR = path.join(process.cwd(), "photos");
const TOKEN_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export interface PhotoUpload {
  jpeg: string;
  print: string;
}

function decodeDataUrl(dataUrl: string, mime: "image/jpeg" | "image/png"): Buffer | null {
  const prefix = `data:${mime};base64,`;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) return null;
  const bytes = Buffer.from(dataUrl.slice(prefix.length), "base64");
  return bytes.length > 0 && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
}

/** Saves a guest's latest boarding photo. Returns false if the upload isn't a
 * well-formed JPEG + PNG pair. */
export async function savePhoto(token: string, photo: PhotoUpload): Promise<boolean> {
  if (!TOKEN_RE.test(token)) return false;
  const jpeg = decodeDataUrl(photo.jpeg, "image/jpeg");
  const png = decodeDataUrl(photo.print, "image/png");
  if (!jpeg || !png) return false;
  await mkdir(PHOTO_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(PHOTO_DIR, `${token}.jpg`), jpeg),
    writeFile(path.join(PHOTO_DIR, `${token}-print.png`), png),
  ]);
  return true;
}

function printPhotoPath(token: string): string | null {
  if (!TOKEN_RE.test(token)) return null;
  const file = path.join(PHOTO_DIR, `${token}-print.png`);
  return existsSync(file) ? file : null;
}

function slipLines(guest: Guest): SlipLine[] {
  const photo = printPhotoPath(guest.token);
  const party = guest.boardedCount != null ? `${guest.boardedCount} / ${guest.guests}` : `${guest.guests}`;
  return [
    { type: "text", text: `${couple.one.toUpperCase()} & ${couple.two.toUpperCase()}`, size: 8, bold: true },
    { type: "text", text: `${weddingDate.short} · ${venue.name}`, size: 7 },
    { type: "rule" },
    { type: "text", text: "BOARDING PASS", size: 8 },
    ...(photo ? ([{ type: "space" }, { type: "image", path: photo }, { type: "space" }] as SlipLine[]) : []),
    { type: "text", text: guest.name, size: 14, bold: true },
    { type: "space" },
    { type: "row", label: "Table", value: guest.table != null ? String(guest.table) : "—" },
    { type: "row", label: "Seat", value: formatSeats(guest.seatLabels) },
    { type: "row", label: "Party", value: party },
    { type: "row", label: "Phone", value: formatPhone(guest.phone) },
    { type: "row", label: "Boarded", value: formatTime(guest.boardedAt) },
    { type: "rule" },
    { type: "text", text: "Welcome aboard!", size: 9, bold: true },
    { type: "space" },
    { type: "space" },
  ];
}

export type PrintResult = { ok: true } | { ok: false; message: string };

export function printSlip(guest: Guest): Promise<PrintResult> {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, message: "Printing needs the Windows laptop with the POS58 attached." });
  }

  const payload = Buffer.from(JSON.stringify({ lines: slipLines(guest) }), "utf8").toString("base64");
  const script = path.join(process.cwd(), "scripts", "print-slip.ps1");

  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script,
        "-PrinterName", PRINTER_NAME, "-PayloadBase64", payload],
      { timeout: 20_000, windowsHide: true },
      (error, _stdout, stderr) => {
        if (!error) return resolve({ ok: true });
        const detail = stderr.trim().split(/\r?\n/)[0] || error.message;
        console.error("[print] failed:", stderr.trim() || error.message);
        resolve({ ok: false, message: detail });
      },
    );
  });
}
