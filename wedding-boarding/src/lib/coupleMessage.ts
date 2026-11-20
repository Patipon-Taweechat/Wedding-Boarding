import type { Guest } from "@/app/actions/boarding";

/**
 * The couple's own note to a guest, printed near the foot of their slip and
 * signed with both names. Every slip on a pass carries the pass's note.
 *
 * MOCK, for now: the notes will come from the database, one per guest beside
 * their RSVP. When that column exists, add it in Wedding-Invitation's
 * migrations (never here). Then read it in actions/boarding.ts like the other
 * `rsvps` columns, put it on `Guest`, and return it below in place of the
 * sample notes. Returning `null` leaves the section off the slip.
 */
const SAMPLE_NOTES = [
  "ขอบคุณที่มาเป็นส่วนหนึ่งในวันสำคัญของเรา ขอให้คืนนี้เป็นค่ำคืนที่อบอุ่นและมีความสุขนะ",
  "Thank you for flying all this way with us. Tonight wouldn't be the same without you.",
  "ดีใจมากที่ได้เจอกันวันนี้ กินให้อิ่ม เต้นให้สนุก แล้วอย่าลืมมาถ่ายรูปกับเรานะ",
  "So glad you're here. Eat well, dance lots, and come find us for a photo.",
];

export function coupleMessage(guest: Pick<Guest, "token">): string | null {
  // Picked by the pass, so a reprint carries the same note.
  let hash = 0;
  for (const char of guest.token) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SAMPLE_NOTES[hash % SAMPLE_NOTES.length] ?? null;
}
