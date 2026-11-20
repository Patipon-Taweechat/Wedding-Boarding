"use server";

import { partySize } from "@/lib/party";
import { printSlips, savePhoto, type PhotoUpload, type PrintResult } from "@/lib/printer";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The columns this app needs from `rsvps` — the same table wedding-invite
 * writes (see wedding-invite/supabase/migrations). This app never creates or
 * alters that schema, only reads and updates it. The columns keep their
 * `checked_in_*` / `checkin_token` names because wedding-invite owns them;
 * everything on this side of `toGuest` speaks "boarding".
 */
const SELECT =
  "phone, name, attending, guests, table_no, seat_labels, checked_in_at, checked_in_count, checkin_token";

interface RsvpRow {
  phone: string;
  name: string;
  attending: boolean;
  guests: number;
  table_no: number | null;
  seat_labels: string[] | null;
  checked_in_at: string | null;
  checked_in_count: number | null;
  checkin_token: string;
}

export interface Guest {
  token: string;
  name: string;
  phone: string;
  attending: boolean;
  guests: number;
  table: number | null;
  seatLabels: string[];
  boardedAt: string | null;
  boardedCount: number | null;
}

function toGuest(row: RsvpRow): Guest {
  return {
    token: row.checkin_token,
    name: row.name,
    phone: row.phone,
    attending: row.attending,
    guests: row.guests,
    table: row.table_no,
    seatLabels: row.seat_labels ?? [],
    boardedAt: row.checked_in_at,
    boardedCount: row.checked_in_count,
  };
}

export type FindResult = { ok: true; guest: Guest } | { ok: false; reason: "not-found" };

/** Looks up a guest by the token decoded from their QR — no write. */
export async function findByToken(token: string): Promise<FindResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select(SELECT)
    .eq("checkin_token", token)
    .maybeSingle<RsvpRow>();

  if (error || !data) return { ok: false, reason: "not-found" };
  return { ok: true, guest: toGuest(data) };
}

/** Name or phone search, for when a QR won't scan (glare, a creased print). */
export async function searchGuests(query: string): Promise<Guest[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = createAdminClient();
  const digits = q.replace(/\D/g, "");

  // A query that's mostly digits is a phone number in progress — search by
  // digits so "081 234" and "0812345678" both match. Otherwise it's a name.
  const isPhoneLike = digits.length >= 3 && digits.length >= q.replace(/\s/g, "").length - 1;

  const builder = supabase.from("rsvps").select(SELECT).order("name").limit(8);
  const { data, error } = isPhoneLike
    ? await builder.ilike("phone", `%${digits}%`)
    : await builder.ilike("name", `%${q}%`);

  if (error || !data) return [];
  return (data as RsvpRow[]).map(toGuest);
}

export type BoardResult =
  | { ok: true; guest: Guest }
  | { ok: false; reason: "not-found" | "already"; guest?: Guest }
  | { ok: false; reason: "error" };

/**
 * Marks a guest boarded (arrived) — one tap, full party by default.
 *
 * The `.is("checked_in_at", null)` guard makes this atomic: a second scan of
 * the same pass (forwarded, or tapped twice by two staff) cannot silently
 * overwrite the time the guest actually walked in. If the guarded update
 * touches no row, a second query works out whether that's because the token
 * doesn't exist or because someone already boarded this guest, so the UI
 * can tell those two apart.
 */
export async function boardGuest(token: string, arrived: number): Promise<BoardResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("rsvps")
    .update({ checked_in_at: new Date().toISOString(), checked_in_count: arrived })
    .eq("checkin_token", token)
    .is("checked_in_at", null)
    .select(SELECT)
    .maybeSingle<RsvpRow>();

  if (error) return { ok: false, reason: "error" };
  if (data) return { ok: true, guest: toGuest(data) };

  const existing = await findByToken(token);
  if (existing.ok) return { ok: false, reason: "already", guest: existing.guest };
  return { ok: false, reason: "not-found" };
}

export type SaveResult = { ok: true } | { ok: false; message: string };

/**
 * Saves a boarding photo the moment it's taken, before anything prints: the
 * photo of a guest on their own (`slip` left out), or guest `slip`'s own of
 * a party (1..N) — a party takes theirs one guest at a time.
 */
export async function saveBoardingPhoto(token: string, photo: PhotoUpload, slip?: number): Promise<SaveResult> {
  const found = await findByToken(token);
  if (!found.ok) return { ok: false, message: "Guest not found" };
  if (slip !== undefined && slip > partySize(found.guest)) return { ok: false, message: "No such guest on this pass" };
  if (!(await savePhoto(token, photo, slip))) {
    return { ok: false, message: "The photo didn't upload properly — retake it" };
  }
  return { ok: true };
}

/**
 * Prints the party's boarding slips on the door printer — one per guest who
 * came in, each with its own lucky number and the latest photo saved for it.
 * Takes only the token and re-reads the row, so every slip shows what the
 * database holds (boarded count and time included). `from` resumes a run that
 * stopped part-way, so slips already printed aren't printed twice; `to`
 * stops early — the gate passes from = to to print one guest's slip.
 */
export async function printBoardingSlips(token: string, from = 1, to?: number): Promise<PrintResult> {
  const found = await findByToken(token);
  if (!found.ok) return { ok: false, message: "Guest not found", resumeFrom: from };
  return printSlips(found.guest, from, to);
}

export interface Stats {
  totalParties: number;
  boardedParties: number;
  totalGuests: number;
  boardedGuests: number;
}

type StatsRow = Pick<RsvpRow, "guests" | "checked_in_at" | "checked_in_count">;

/**
 * How many of a party walked in. `checked_in_at` is what marks a row boarded
 * (the same field the "already boarded" screen reads); `checked_in_count` only
 * exists on rows boarded after wedding-invite added that column, so a row with
 * a time but no count falls back to the whole booking. Mirrors
 * `arrivedCount` in wedding-invite/src/lib/guests.ts so both headcounts agree.
 */
function arrivedCount(row: StatsRow): number {
  if (!row.checked_in_at) return 0;
  return row.checked_in_count ?? row.guests;
}

/** Live counter for the header — attending parties only, so a full "no"
 * reply never counts against the room. */
export async function getStats(): Promise<Stats> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select("guests, checked_in_at, checked_in_count")
    .eq("attending", true);

  if (error || !data) {
    return { totalParties: 0, boardedParties: 0, totalGuests: 0, boardedGuests: 0 };
  }

  const rows = data as StatsRow[];
  return {
    totalParties: rows.length,
    boardedParties: rows.filter((r) => r.checked_in_at).length,
    totalGuests: rows.reduce((sum, r) => sum + r.guests, 0),
    boardedGuests: rows.reduce((sum, r) => sum + arrivedCount(r), 0),
  };
}
