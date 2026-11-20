import type { Guest } from "@/app/actions/boarding";

/**
 * How many people came in on one pass — and so how many boarding slips it
 * prints, one each. The arrived count once the party has boarded, the booked
 * count before; never fewer than one, so a reply booked for 0 still gets the
 * guest standing at the door a slip. Shared by the iPad and the server, so
 * both count the same slips.
 */
export function partySize(guest: Pick<Guest, "guests" | "boardedCount">): number {
  return Math.max(1, guest.boardedCount ?? guest.guests);
}
