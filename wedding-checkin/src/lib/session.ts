/**
 * The staff PIN gate needs no user accounts and no database — one shared PIN
 * for whoever is standing at the door. The cookie never carries the PIN
 * itself: it carries an HMAC of a fixed message keyed by the PIN, so the
 * login action and the middleware can each independently recompute it from
 * STAFF_PIN and compare, without a session store. Runs in both the Node
 * server-action runtime and the Edge middleware runtime (Web Crypto is
 * global in both).
 */
const SESSION_MESSAGE = "wedding-checkin-session-v1";
export const SESSION_COOKIE = "checkin_session";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeSessionToken(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(SESSION_MESSAGE));
  return toHex(signature);
}
