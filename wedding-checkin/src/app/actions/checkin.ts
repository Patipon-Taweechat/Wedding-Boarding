"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The columns this app needs from `rsvps` — the same table wedding-invite
 * writes (see wedding-invite/supabase/migrations). This app never creates or
 * alters that schema, only reads and updates it.
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
  checkedInAt: string | null;
  checkedInCount: number | null;
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
    checkedInAt: row.checked_in_at,
    checkedInCount: row.checked_in_count,
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

export type CheckInResult =
  | { ok: true; guest: Guest }
  | { ok: false; reason: "not-found" | "already"; guest?: Guest }
  | { ok: false; reason: "error" };

/**
 * Marks a guest arrived — one tap, full party by default.
 *
 * The `.is("checked_in_at", null)` guard makes this atomic: a second scan of
 * the same pass (forwarded, or tapped twice by two staff) cannot silently
 * overwrite the time the guest actually walked in. If the guarded update
 * touches no row, a second query works out whether that's because the token
 * doesn't exist or because someone already checked this guest in, so the UI
 * can tell those two apart.
 */
export async function checkInGuest(token: string, arrived: number): Promise<CheckInResult> {
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

export interface Stats {
  totalParties: number;
  checkedInParties: number;
  totalGuests: number;
  checkedInGuests: number;
}

/** Live counter for the header — attending parties only, so a full "no"
 * reply never counts against the room. */
export async function getStats(): Promise<Stats> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rsvps")
    .select("guests, checked_in_count")
    .eq("attending", true);

  if (error || !data) {
    return { totalParties: 0, checkedInParties: 0, totalGuests: 0, checkedInGuests: 0 };
  }

  const rows = data as Pick<RsvpRow, "guests" | "checked_in_count">[];
  return {
    totalParties: rows.length,
    checkedInParties: rows.filter((r) => r.checked_in_count != null).length,
    totalGuests: rows.reduce((sum, r) => sum + r.guests, 0),
    checkedInGuests: rows.reduce((sum, r) => sum + (r.checked_in_count ?? 0), 0),
  };
}
