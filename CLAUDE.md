# Wedding Check-In

## Purpose

The door app for one wedding: staff scan a guest's boarding-pass QR on an
iPad's camera and it's marked arrived. This is the sibling of the
`Wedding-Invitation` project on this same Desktop — it shares that project's
Supabase database (the `rsvps` table) rather than keeping its own guest list.
Read `Wedding-Invitation/CLAUDE.md` and `Wedding-Invitation/wedding-invite/supabase/migrations`
before changing the schema assumptions here.

Application code lives in `wedding-checkin/` — see `wedding-checkin/README.md`
for setup, environment variables, and how to test from an iPad over the venue
Wi-Fi (the camera needs a secure context, which plain LAN http does not give
iOS Safari).

## Tech stack

Deliberately mirrors `Wedding-Invitation/wedding-invite`: Next.js (App
Router, `src/`, `@/*` alias), TypeScript, Tailwind CSS v4 (CSS-first `@theme`
in `globals.css`), React, Supabase. The brand tokens (`--color-primary`,
`--color-background`, etc.) use the same values as the invitation site, so
this reads as the same wedding rather than a generic scanner tool — see
`wedding-checkin/src/app/globals.css`.

## Core rules

**This app does not own the guest list.** It reads and updates the `rsvps`
table `Wedding-Invitation` created and migrates. Never add a migration or
schema change here — make it in `Wedding-Invitation` and mirror the read
shape in `wedding-checkin/src/app/actions/checkin.ts`.

**Check-in is idempotent by construction.** Every write to `checked_in_at`
goes through `.is("checked_in_at", null)` so a second scan of the same pass
cannot overwrite the original arrival time. Keep that guard if this logic is
ever touched.

**Kiosk, not a guest page.** One iPad, tapped by staff all evening: touch
targets stay large (`min-h-14` on buttons), the camera view and confirm
screen use the shared brand tokens but a plainer layout than the invitation
site, and the whole app sits behind the `STAFF_PIN` lock in `proxy.ts`.
