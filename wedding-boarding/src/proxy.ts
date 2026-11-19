import { NextResponse, type NextRequest } from "next/server";
import { computeSessionToken, SESSION_COOKIE } from "@/lib/session";

/**
 * Gates every page behind the shared staff PIN. STAFF_PIN unset means the
 * gate is off (useful for local dev before .env.local is filled in) — never
 * silently locks a deploy out, but the README calls out that production
 * should always set it.
 *
 * Next.js renamed the "middleware" file convention to "proxy" — this is that
 * file (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 */
export async function proxy(req: NextRequest) {
  const pin = process.env.STAFF_PIN;
  if (!pin) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await computeSessionToken(pin);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (req.nextUrl.pathname !== "/login") {
    url.searchParams.set("next", req.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|qr-scanner-worker.min.js).*)"],
};
