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
4. Right after boarding comes the photo, on the iPad's front camera (3-2-1
   countdown, then Retake or carry on), and the server prints the slip on the
   door's receipt printer (see "Boarding slips" below). A party of two or
   more goes **one guest at a time**: guest 1's photo, guest 1's slip prints
   (tear it off and hand it over — the next photo comes up by itself after a
   few seconds, or tap "Next guest"), then guest 2, and so on, so the slips
   never come out as one long strip to sort out. Skipping a photo prints a
   photo of the couple in its place. A failed slip offers "Retry print" or
   "Skip"; an already-boarded guest gets "Reprint slips" and "New photo".
5. A QR that won't scan (glare, a creased print) falls back to name/phone
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
| `PRINTER_NAME` | Windows printer for boarding slips. Default `POS58 Printer`. |

## Using it from an iPad at the door

The iPad needs to reach whatever machine is running `npm run dev`, over the
venue Wi-Fi, **and** the camera needs a secure context — iOS Safari refuses
`getUserMedia` on a plain `http://` page unless the host is `localhost`. Two
ways to get there:

**Quick, self-signed (same Wi-Fi only)**

```bash
npm run dev:lan
```

This issues a certificate for the laptop's Wi-Fi address as well as localhost
(`scripts/lan-cert.mjs`, regenerated whenever the address changes; set
`LAN_IP=…` if it picks the wrong network adapter) and prints the
`https://<your-ip>:3000` URL to open on the iPad. Plain
`npm run dev -- --experimental-https` only covers localhost, so the iPad gets
"certificate is for a different address", which Chrome won't let you past.

The iPad still doesn't know the laptop's private CA, so Safari warns the first
time — "Show Details" → "visit this website" to accept it once. To get rid of
the warning (and use Chrome), AirDrop the `rootCA.pem` it prints to the iPad,
install it under Settings → Profile Downloaded, then turn it on in Settings →
General → About → Certificate Trust Settings. Remove that profile after the
wedding: anyone holding the laptop's `rootCA-key.pem` could issue certificates
the iPad trusts.

**A real certificate, if the self-signed prompt is a problem on the day**

Run a tunnel (e.g. `npx cloudflared tunnel --url http://localhost:3000`, or
ngrok) and open the `https://*.trycloudflare.com` (or `*.ngrok-free.app`) URL
it prints instead — both hosts are already allow-listed in `next.config.ts`.

Either way, add the iPad to the home screen (Share → Add to Home Screen) so
it opens full-screen without Safari's chrome.

## Boarding slips

The receipt printer (a 58 mm POS58 on USB) plugs into the **Windows laptop
running `npm run dev`**, not the iPad: the iPad calls a server action
(`printBoardingSlips` in `src/app/actions/boarding.ts`), which re-reads the
guest from Supabase and hands each slip to `scripts/print-slip.ps1`. That
script draws through the Windows printer driver (System.Drawing), so Thai
text prints in a Windows font rather than depending on the printer's code
pages.

Every guest on a pass gets a slip of their own, printed one after another.
From the top:

- "Welcome aboard", the date and venue
- the boarding photo (their own or — with none — the couple on the forest
  railway), their name, table, seat (their own seat
  when everyone on the pass came, otherwise the party's), "Guest 2 of 3" (or
  the party count for a guest alone) and boarding time
- a six-figure lucky number
- the missions QR
- the couple's note to the guest, signed with their names in the
  invitation's script (Alex Brush, drawn as a picture since the laptop
  doesn't have the font)
- the wedding logo
- about 2 cm of blank paper, so tearing it off never cuts into the slip

There's no phone number. The layout is `slipLines` in `src/lib/printer.ts`.

- **Logo, signature and placeholder** are 1-bit PNGs in `assets/`, drawn by
  `npm run slip-art` (`scripts/slip-art.mjs`) from `CoupleMark`,
  `assets/source/AlexBrush-Regular-latin.ttf` (the signature) and
  `assets/source/us-forest-walk.webp` (copied from the invitation's
  `public/hero`).
- **Lucky numbers** never repeat across the evening. A slip's number is
  issued the first time it prints. It's kept with the guest's name in
  `draw/lucky-numbers.json` on the laptop (gitignored), which is the list to
  draw from and to look a winner up in. A reprint carries the same number. If
  that file can't be read, printing stops rather than start a fresh list
  that could repeat a number, so restore or fix the file.
- **The missions QR** points at `MISSION_URL` in `.env.local`. If it's unset,
  the section is left off.
- **The couple's note** comes from `src/lib/coupleMessage.ts`. For now it is
  a sample note (a mock). It will be read from `rsvps` once that column
  exists in `wedding-invite`. Thai notes get invisible word-break marks so
  they wrap between words.

### Boarding photos

The iPad crops each photo square and sends two copies to the laptop
(`saveBoardingPhoto`) before the slips print: a colour JPEG and a 384 px PNG
already dithered to pure black and white (`src/lib/dither.ts`). 384 px is
exactly the POS58's dot width, so a thermal head prints it crisply instead of
a dark grey blur. Both are saved in `photos/` (gitignored): `{token}.jpg` for
a guest alone, `{token}.guest-{n}.jpg` for guest n of a party.
Each retake overwrites them, so a reprint always uses the latest photo. The colour
JPEGs are a keepsake set for the couple after the wedding.

Check the printer name with `Get-Printer` in PowerShell; if it isn't
`POS58 Printer`, set `PRINTER_NAME` in `.env.local`. Printing only works
when the server runs on Windows.

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
src/lib/printer.ts           boarding-slip layout, photo storage, call to the print script
src/lib/dither.ts            selfie -> 1-bit dots for the thermal printer
src/components/scan/PhotoCapture.tsx   the selfie step after boarding
scripts/print-slip.ps1       draws one slip on the Windows receipt printer
```
