import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Guest } from "@/app/actions/boarding";
import { coupleMessage } from "@/lib/coupleMessage";
import { formatSeats } from "@/lib/format";
import { issueLuckyNumber } from "@/lib/lucky";
import { missionQrPath } from "@/lib/missionQr";
import { partySize } from "@/lib/party";
import { couple, venue, weddingDate } from "@/lib/wedding";

/**
 * Boarding slips on the receipt printer at the door — one for every person
 * who came in on a pass, each with its own lucky number.
 *
 * The printer hangs off the laptop running `next dev`, not the iPad — so the
 * iPad asks the server (a server action) and the server prints through the
 * Windows spooler via scripts/print-slip.ps1, one slip per call. Server-only:
 * never import this from a client component.
 */

/** The Windows printer name, as `Get-Printer` lists it. */
const PRINTER_NAME = process.env.PRINTER_NAME ?? "POS58 Printer";

/** Where the slip's missions QR points. Unset, the section is left off. */
const MISSION_URL = process.env.MISSION_URL?.trim() || null;

/** One line of a slip, as print-slip.ps1 draws it. */
export type SlipLine =
  | {
      type: "text";
      text: string;
      size?: number;
      bold?: boolean;
      italic?: boolean;
      /** Georgia, for the couple's own English words only: it has no Thai. */
      font?: "serif";
      align?: "left" | "center" | "right";
    }
  | { type: "image"; path: string }
  /** Side by side, each a small label over a large value, like the TABLE and
   * SEAT boxes on a boarding pass; `gap` is the paper between the two (1/100
   * inch). */
  | { type: "columns"; items: { label: string; value: string }[]; gap?: number }
  /** A hairline, centred, `width` of the way across (1, the default, is the
   * full width). */
  | { type: "rule"; width?: number }
  | { type: "space" }
  /** Blank paper, in the print script's page units (1/100 inch). */
  | { type: "feed"; height: number };

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * Boarding photos live on the laptop, overwritten by each retake, so a slip
 * (and any reprint) always carries the latest one:
 *   photos/{token}.jpg                 the party's photo together (or the
 *   photos/{token}-print.png           one guest's own, for a party of one)
 *   photos/{token}.guest-{n}.jpg       guest n's own photo, when a party
 *   photos/{token}.guest-{n}-print.png chose one each
 * Each pair is a colour keepsake for the couple plus the 1-bit dithered copy
 * the POS58 prints. Guest n's slip uses their own photo, else the party's,
 * else the placeholder (the couple on the forest railway). The folder is gitignored.
 */
const PHOTO_DIR = path.join(process.cwd(), "photos");
const TOKEN_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** No pass brings more people than this — a guard on the slip number. */
export const MAX_PARTY = 30;

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

/** `{token}` for the party's photo, `{token}.guest-{n}` for guest n's own.
 * The dot can't occur in a token, so one guest's files never match another's. */
function photoStem(token: string, slip?: number): string {
  return slip === undefined ? token : `${token}.guest-${slip}`;
}

/**
 * Saves a boarding photo: the party's together (`slip` left out — this also
 * clears any one-each photos from an earlier round, so the new group photo
 * is the one every slip shows), or guest `slip`'s own. Returns false if the
 * upload isn't a well-formed JPEG + PNG pair.
 */
export async function savePhoto(token: string, photo: PhotoUpload, slip?: number): Promise<boolean> {
  if (!TOKEN_RE.test(token)) return false;
  if (slip !== undefined && !(Number.isInteger(slip) && slip >= 1 && slip <= MAX_PARTY)) return false;
  const jpeg = decodeDataUrl(photo.jpeg, "image/jpeg");
  const png = decodeDataUrl(photo.print, "image/png");
  if (!jpeg || !png) return false;

  await mkdir(PHOTO_DIR, { recursive: true });
  if (slip === undefined) {
    const own = new RegExp(`^${token}\\.guest-\\d+(-print\\.png|\\.jpg)$`);
    const stale = (await readdir(PHOTO_DIR)).filter((name) => own.test(name));
    await Promise.all(stale.map((name) => rm(path.join(PHOTO_DIR, name), { force: true })));
  }
  const stem = photoStem(token, slip);
  await Promise.all([
    writeFile(path.join(PHOTO_DIR, `${stem}.jpg`), jpeg),
    writeFile(path.join(PHOTO_DIR, `${stem}-print.png`), png),
  ]);
  return true;
}

/** Guest `slip`'s own photo, else the party's together, else none. */
function printPhotoPath(token: string, slip: number): string | null {
  if (!TOKEN_RE.test(token)) return null;
  for (const stem of [photoStem(token, slip), photoStem(token)]) {
    const file = path.join(PHOTO_DIR, `${stem}-print.png`);
    if (existsSync(file)) return file;
  }
  return null;
}

/**
 * The pictures, already 1-bit and 384 dots wide, made by
 * scripts/slip-art.mjs (`npm run slip-art`):
 *   - the wedding logo at the foot of every slip (the couple and "J&F" in
 *     one line);
 *   - the couple's names in the invitation's script, signing their note (the
 *     laptop has no such font, so it goes as a picture);
 *   - the couple on the forest railway, printed in the photo's square when
 *     there's no photo for that guest, so every slip is the same shape.
 * A slip still prints if any is missing.
 */
const LOGO_PATH = path.join(process.cwd(), "assets", "slip-logo.png");
const SIGNATURE_PATH = path.join(process.cwd(), "assets", "slip-signature.png");
const PLACEHOLDER_PATH = path.join(process.cwd(), "assets", "slip-placeholder.png");

/**
 * Guest `slip`'s own seat when every seat is known and everyone came, so the
 * slip can name it; otherwise the party's seats, as before — with someone
 * missing there's no telling whose chair is whose.
 */
function seatFor(guest: Guest, slip: number, party: number): string {
  if (party > 1 && guest.seatLabels.length === party) return guest.seatLabels[slip - 1];
  return formatSeats(guest.seatLabels);
}

/**
 * Thai is written without spaces between words, so a long note would only
 * wrap where its writer happened to leave a space and run off the paper in
 * between. A zero-width space between Thai words (the invisible break mark
 * Thai word processors use) gives print-slip.ps1 somewhere to wrap. Words
 * come from the Thai dictionary in Node's ICU.
 */
const thaiWords = new Intl.Segmenter("th", { granularity: "word" });
const THAI = /[\u0E00-\u0E7F]/;

export function wrappable(text: string): string {
  let out = "";
  let afterThai = false;
  for (const { segment } of thaiWords.segment(text)) {
    const thai = THAI.test(segment);
    if (thai && afterThai) out += "\u200B";
    out += segment;
    afterThai = thai;
  }
  return out;
}

export interface Slip {
  slip: number;
  party: number;
  lucky: string;
  missionQr: string | null;
}

/**
 * The slip keeps to a few styles so it reads calm rather than busy: small
 * capitals for every label, the guest's name and lucky number large, and the
 * couple's own words in an italic serif, like the invitation's lettering.
 * Sections are parted by space and a short hairline, not ruled off.
 */
const label = (text: string): SlipLine => ({ type: "text", text: text.toUpperCase(), size: 7 });
const lettering = (text: string, size: number): SlipLine => ({ type: "text", text, size, font: "serif", italic: true });
const DIVIDER: SlipLine[] = [{ type: "feed", height: 16 }, { type: "rule", width: 0.15 }, { type: "feed", height: 16 }];
/** Between a label and the large value under it (about 1.5 mm). */
const LABEL_GAP = 6;

/** Guest `slip` of `party`'s slip, top to bottom. Exported so the slip can be
 * previewed and checked without the printer. */
export function slipLines(guest: Guest, { slip, party, lucky, missionQr }: Slip): SlipLine[] {
  const photo = printPhotoPath(guest.token, slip) ?? (existsSync(PLACEHOLDER_PATH) ? PLACEHOLDER_PATH : null);
  const logo: SlipLine[] = existsSync(LOGO_PATH) ? [{ type: "image", path: LOGO_PATH }] : [];
  const boarded = `Boarded ${formatTime(guest.boardedAt)}`;
  const message = coupleMessage(guest)?.trim();
  // The couple's names appear once on the slip: signing their note.
  const signature: SlipLine = existsSync(SIGNATURE_PATH)
    ? { type: "image", path: SIGNATURE_PATH }
    : lettering(`${couple.one} & ${couple.two}`, 10);

  const sections: SlipLine[][] = [
    // The greeting heads the slip, below a clear margin of paper; the
    // couple's logo closes it at the foot.
    [
      { type: "feed", height: 30 },
      lettering("Welcome aboard", 13),
      { type: "space" },
      label(`${weddingDate.short} · ${venue.name}`),
    ],
    // The pass itself.
    [
      ...(photo ? ([{ type: "image", path: photo }, { type: "feed", height: 14 }] as SlipLine[]) : []),
      { type: "text", text: guest.name, size: 14, bold: true },
      label(party > 1 ? `Guest ${slip} of ${party} · ${boarded}` : boarded),
      { type: "feed", height: 10 },
      {
        type: "columns",
        gap: LABEL_GAP,
        items: [
          { label: "TABLE", value: guest.table != null ? String(guest.table) : "—" },
          { label: "SEAT", value: seatFor(guest, slip, party) },
        ],
      },
    ],
    [
      label("Your lucky number"),
      { type: "feed", height: LABEL_GAP },
      // Spaced figure by figure, the way a lottery ticket sets them, so the
      // number reads back cleanly when it's called out.
      { type: "text", text: lucky.split("").join(" "), size: 20, bold: true },
    ],
    missionQr ? [label("Scan for missions & prizes"), { type: "space" }, { type: "image", path: missionQr }] : [],
    // The couple's note to this guest, signed by both of them.
    message ? [{ type: "text", text: wrappable(message), size: 9 }, { type: "feed", height: 10 }, signature] : [],
    logo,
  ];

  return [
    ...sections
      .filter((section) => section.length > 0)
      .flatMap((section, i) => (i === 0 ? section : [...DIVIDER, ...section])),
    // The tear-off margin: about 2 cm of blank paper after the last line, so
    // pulling the slip across the printer's tear bar never cuts into it. It
    // ends in one small dot because many receipt drivers trim blank paper at
    // the end of a page — the dot makes sure the margin is actually fed.
    { type: "feed", height: 80 },
    { type: "text", text: "·", size: 6 },
  ];
}

function runPrintScript(lines: SlipLine[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = Buffer.from(JSON.stringify({ lines }), "utf8").toString("base64");
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

/** `resumeFrom` is the first slip that didn't print — Retry starts there, so
 * the slips already in guests' hands aren't printed twice. */
export type PrintResult = { ok: true; printed: number } | { ok: false; message: string; resumeFrom: number };

/**
 * Prints the party's slips, one per guest, from slip `from` on, in order.
 * Stops at the first that fails.
 */
export async function printSlips(guest: Guest, from = 1): Promise<PrintResult> {
  const party = partySize(guest);
  const start = Number.isInteger(from) && from >= 1 && from <= party ? from : 1;

  if (process.platform !== "win32") {
    return { ok: false, message: "Printing needs the Windows laptop with the POS58 attached.", resumeFrom: start };
  }

  let missionQr: string | null = null;
  if (MISSION_URL) {
    try {
      missionQr = await missionQrPath(MISSION_URL);
    } catch (error) {
      // A bad link shouldn't keep a guest's slip from printing.
      console.error("[print] missions QR:", error);
    }
  }

  for (let slip = start; slip <= party; slip++) {
    const failed = (message: string): PrintResult => ({
      ok: false,
      message: party > 1 ? `Slip ${slip} of ${party}: ${message}` : message,
      resumeFrom: slip,
    });

    // Issued (or looked up) only on the laptop that prints, so the draw list
    // holds exactly the numbers that went out on paper. Keyed per slip, so
    // every guest in a party holds their own number.
    let lucky: string;
    try {
      lucky = await issueLuckyNumber(
        `${guest.token}#${slip}`,
        party > 1 ? `${guest.name} (guest ${slip} of ${party})` : guest.name,
      );
    } catch (error) {
      console.error("[print] lucky-number list:", error);
      return failed("Couldn't read the lucky-number list (draw/lucky-numbers.json)");
    }

    const result = await runPrintScript(slipLines(guest, { slip, party, lucky, missionQr }));
    if (!result.ok) return failed(result.message);
  }
  return { ok: true, printed: party - start + 1 };
}
