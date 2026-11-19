# Wedding Boarding

The door app: staff scan a guest's boarding-pass QR on an iPad's camera and
it's marked boarded (arrived) in the same Supabase project the `wedding-invite` site
writes to. Sibling project, shared database, no separate guest list.

## Stack

Next.js (App Router, `src/`, `@/*` alias) · TypeScript · Tailwind CSS v4 ·
React · Supabase — the same choices as `wedding-invite`, so the two projects
stay easy to work on together. See `qr-scanner` for the camera decoding.

## How boarding works

1. A guest's pass (from `wedding-invite`) carries a QR that encodes
   `{site}/checkin/{token}` (the path name is set by `wedding-invite`).
2. This app's camera decodes that URL, pulls out `{token}`
   (`src/lib/token.ts`), and looks the guest up by `checkin_token` in the
   `rsvps` table.
3. One tap marks them arrived — `checked_in_at` and `checked_in_count` — using
   the same "only if not already boarded" guard `wedding-invite` uses, so a
   second scan of a forwarded or re-shown pass can't silently overwrite the
   original arrival time.
4. A QR that won't scan (glare, a creased print) falls back to name/phone
   search, landing on the same confirm screen.

This app never creates or migrates the `rsvps` table — that's
`wedding-invite`'s migrations (`wedding-invite/supabase/migrations`). It only
reads and updates rows that already exist there.

## Setup

```bash
cd wedding-boarding
npm install
cp .env.local.example .env.local   # fill in the real Supabase values + a STAFF_PIN
npm run dev
```

Open http://localhost:3000 — it redirects to `/scan`.

### Environment variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `wedding-invite`'s `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as `wedding-invite`'s `.env.local` (service-role, server-only) |
| `STAFF_PIN` | Any digits staff will enter before the scanner unlocks. Unset = no lock screen. |

## Using it from an iPad at the door

The iPad needs to reach whatever machine is running `npm run dev`, over the
venue Wi-Fi, **and** the camera needs a secure context — iOS Safari refuses
`getUserMedia` on a plain `http://` page unless the host is `localhost`. Two
ways to get there:

**Quick, self-signed (same Wi-Fi only)**

```bash
npm run dev -- --experimental-https
```

Next prints an `https://<your-ip>:3000` URL. Open that on the iPad; Safari
will warn about the certificate the first time — "Show Details" → "visit this
website" to accept it once.

**A real certificate, if the self-signed prompt is a problem on the day**

Run a tunnel (e.g. `npx cloudflared tunnel --url http://localhost:3000`, or
ngrok) and open the `https://*.trycloudflare.com` (or `*.ngrok-free.app`) URL
it prints instead — both hosts are already allow-listed in `next.config.ts`.

Either way, add the iPad to the home screen (Share → Add to Home Screen) so
it opens full-screen without Safari's chrome.

## Staff PIN

`STAFF_PIN` gates every page except `/login` (`src/proxy.ts`). The PIN
itself never sits in a cookie — a login turns it into an HMAC via
`src/lib/session.ts` that only the server can compute, so a stolen cookie is
useless without the PIN and the PIN never round-trips through the browser
after entry. "Lock screen" at the bottom of the scan page clears the session.

## Project layout

```
src/app/scan/page.tsx        the door screen (fetches initial stats)
src/app/login/page.tsx       PIN entry
src/app/actions/boarding.ts  findByToken, boardGuest, searchGuests, getStats
src/app/actions/auth.ts      login / logout
src/components/scan/         Scanner (camera), GuestPanel, SearchPanel, StatsBar
src/lib/supabase/admin.ts    service-role Supabase client
src/lib/token.ts             pulls the token out of a scanned QR payload
src/lib/session.ts           PIN session cookie
```
