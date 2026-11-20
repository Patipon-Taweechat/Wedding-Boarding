import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Copies the night's keepsakes to Supabase as they're made: each slip's lucky
 * number (table `lucky_numbers`) and each guest's colour photo (private
 * Storage bucket `boarding-photos`). Both tables/buckets come from
 * Wedding-Invitation's migration 0006_boarding_keepsakes.sql.
 *
 * The laptop's own files (draw/lucky-numbers.json, photos/) stay the source
 * of truth and are what printing reads, so a dropped venue Wi-Fi never stops
 * a slip. These copies are fire-and-forget: a failure is logged, never thrown,
 * and `npm run sync-backup` uploads anything that missed. Server-only.
 */

export const PHOTO_BUCKET = "boarding-photos";

function logFailure(what: string, error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
  console.error(`[backup] ${what} not copied to Supabase (run \`npm run sync-backup\` later):`, message);
}

/** A slip's lucky number. The first copy wins (`ignoreDuplicates`), like the
 * laptop's list — a reprint never changes a number already recorded. */
export async function backupLuckyNumber(slipKey: string, number: string, name: string): Promise<boolean> {
  const [token, guestNo] = slipKey.split("#");
  try {
    const { error } = await createAdminClient()
      .from("lucky_numbers")
      .upsert(
        { slip_key: slipKey, checkin_token: token, guest_no: Number(guestNo) || 1, number, name },
        { onConflict: "slip_key", ignoreDuplicates: true },
      );
    if (error) throw error;
    return true;
  } catch (error) {
    logFailure(`lucky number ${number} (${slipKey})`, error);
    return false;
  }
}

/** A guest's colour photo, at `{token}/{fileName}`; a retake overwrites it. */
export async function backupPhoto(token: string, fileName: string, jpeg: Buffer): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .storage.from(PHOTO_BUCKET)
      .upload(`${token}/${fileName}`, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    return true;
  } catch (error) {
    logFailure(`photo ${fileName}`, error);
    return false;
  }
}
