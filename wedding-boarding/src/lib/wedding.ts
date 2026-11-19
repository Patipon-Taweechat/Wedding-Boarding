/**
 * The couple + venue, kept in sync by hand with wedding-invite/src/lib/wedding.ts.
 * This app only needs enough to label the header/footer of a staff screen —
 * everything else (schedule, story, RSVP copy) lives in the invitation project.
 */
export const couple = {
  one: "Jurapan",
  two: "Patipon",
} as const;

export const venue = {
  name: "The Escape Hill",
  area: "Muak Lek",
  city: "Saraburi",
} as const;

export const weddingDate = {
  iso: "2026-12-07",
  short: "07 Dec 2026",
} as const;
