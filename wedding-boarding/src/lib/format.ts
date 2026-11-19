/**
 * Kept in sync by hand with the formatting helpers in
 * wedding-invite/src/lib/rsvp.ts and seating.ts — duplicated rather than
 * shared across the two separate projects.
 */

/** +66812345678 -> "081 234 5678". Falls back to the raw value for anything
 * that isn't a Thai E.164 number. */
export function formatPhone(e164: string): string {
  const thai = e164.match(/^\+66(\d{2})(\d{3})(\d{4})$/);
  if (!thai) return e164;
  return `0${thai[1]} ${thai[2]} ${thai[3]}`;
}

/** "6C" alone, "6C-6D" for anything more. */
export function formatSeats(labels: string[]): string {
  if (labels.length === 0) return "—";
  if (labels.length === 1) return labels[0];
  return `${labels[0]}–${labels[labels.length - 1]}`;
}
