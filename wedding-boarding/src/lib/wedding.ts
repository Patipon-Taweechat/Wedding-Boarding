/**
 * The couple + venue, kept in sync by hand with wedding-invite/src/lib/wedding.ts.
 * This app only needs enough to dress a door screen and the boarding-pass
 * ticket — everything else (story, RSVP copy) lives in the invitation project.
 */
export const couple = {
  one: "Jurapan",
  two: "Patipon",
  /** How the two of them sign the boarding pass ("J&F Wedding"). */
  monogram: "J&F",
} as const;

export const venue = {
  name: "The Escape Hill",
  area: "Muak Lek",
  city: "Saraburi",
} as const;

export const weddingDate = {
  iso: "2026-12-07",
  short: "07 Dec 2026",
  weekday: "Monday",
} as const;

/**
 * The two times the guest's pass prints under "Boarding" and "Departure" —
 * the first two entries of the invitation's `schedule` (4:00 PM arrival,
 * 5:00 PM ceremony), in 24-hour form as the pass shows them.
 */
export const passTimes = {
  boarding: "16:00",
  departure: "17:00",
} as const;
