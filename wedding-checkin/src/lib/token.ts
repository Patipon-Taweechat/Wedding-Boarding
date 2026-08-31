/**
 * Pulls the check-in token out of whatever the camera decoded.
 *
 * The QR on a guest's boarding pass encodes the full absolute URL
 * (`{site}/checkin/{token}` or `{site}/pass/{token}` — see
 * wedding-invite/src/components/ui/BoardingPass.tsx), so the common case is a
 * URL. A bare token is also accepted, for typing one in manually or if the QR
 * payload ever changes shape.
 */
export function extractToken(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/(?:checkin|pass)\/([^/]+)\/?$/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // Not a URL — fall through and treat it as a bare token.
  }

  // URL-safe base64 from Postgres' gen_random_bytes(12): letters, digits, -, _.
  if (/^[A-Za-z0-9_-]{6,64}$/.test(text)) return text;

  return null;
}
