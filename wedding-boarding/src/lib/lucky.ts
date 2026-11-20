import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Lucky numbers for the evening's draw: six figures on every boarding slip,
 * like a Thai lottery ticket — and never the same on two slips.
 *
 * Every number given out is kept on the laptop that prints, in
 * draw/lucky-numbers.json (gitignored, next to the photos), with the guest's
 * name beside it — that file is also how the winner is looked up after a
 * number is called. It is keyed per slip (`{token}#{n}` for guest n on a
 * pass), so each guest in a party holds their own number. A number is fixed
 * the first time its slip prints: a reprint, or a new photo, carries the same
 * one, so nobody can print themselves extra tickets.
 *
 * The first number tried comes from the slip's key, so it looks random but is
 * the same if the file is ever lost and rebuilt; only when another slip
 * already holds it does this one get the next in its own sequence.
 * Server-only.
 */
export const DRAW_FILE = path.join(process.cwd(), "draw", "lucky-numbers.json");

export interface DrawEntry {
  number: string;
  name: string;
  issuedAt: string;
}

type Ledger = Record<string, DrawEntry>;

function candidate(key: string, attempt: number): string {
  const n = createHash("sha256").update(`lucky-number:${key}:${attempt}`).digest().readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

async function readLedger(file: string): Promise<Ledger> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
  // A file that no longer parses stops the print rather than starting a fresh
  // list — a fresh list could hand out a number someone is already holding.
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${file} is not a list of lucky numbers`);
  }
  return parsed as Ledger;
}

/** Written whole to a temporary file and moved into place, so a crash
 * mid-write never leaves half a list behind. */
async function writeLedger(file: string, ledger: Ledger): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

/** One issue at a time: two prints landing together must not both read the
 * list before either has written to it. */
let queue: Promise<unknown> = Promise.resolve();

/** The slip's lucky number — the one already issued to it, or a new one
 * no other slip holds. `file` is only overridden by tests. */
export function issueLuckyNumber(key: string, name: string, file: string = DRAW_FILE): Promise<string> {
  const run = queue.then(async () => {
    const ledger = await readLedger(file);
    const existing = ledger[key];
    if (existing) return existing.number;

    const taken = new Set(Object.values(ledger).map((entry) => entry.number));
    let number = candidate(key, 0);
    for (let attempt = 1; taken.has(number); attempt++) number = candidate(key, attempt);

    ledger[key] = { number, name, issuedAt: new Date().toISOString() };
    await writeLedger(file, ledger);
    return number;
  });
  queue = run.catch(() => {});
  return run;
}
