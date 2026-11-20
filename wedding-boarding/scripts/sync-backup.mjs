// Uploads the night's keepsakes from this laptop to Supabase: every lucky
// number in draw/lucky-numbers.json (table `lucky_numbers`) and every colour
// photo in photos/ (private Storage bucket `boarding-photos`).
//
// The gate already copies each one as it's made (src/lib/backup.ts); this is
// for anything that missed — the venue Wi-Fi dropped, or the slips printed
// before Wedding-Invitation's migration 0006_boarding_keepsakes.sql was run.
// Safe to run any number of times: numbers already recorded are left as they
// are, photos are overwritten with the laptop's (latest) copy.
//
//   npm run sync-backup
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DRAW_FILE = path.join(ROOT, "draw", "lucky-numbers.json");
const PHOTO_DIR = path.join(ROOT, "photos");
const BUCKET = "boarding-photos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const MISSING_SCHEMA_HINT =
  "\n  Has Wedding-Invitation's supabase/migrations/0006_boarding_keepsakes.sql been run in the Supabase SQL Editor?";

let failures = 0;

// --- Lucky numbers -----------------------------------------------------------
async function syncLuckyNumbers() {
  let ledger;
  try {
    ledger = JSON.parse(await readFile(DRAW_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Lucky numbers: none issued yet (no draw/lucky-numbers.json).");
      return;
    }
    throw error;
  }

  const rows = Object.entries(ledger).map(([slipKey, entry]) => {
    const [token, guestNo] = slipKey.split("#");
    return {
      slip_key: slipKey,
      checkin_token: token,
      guest_no: Number(guestNo) || 1,
      number: entry.number,
      name: entry.name,
      issued_at: entry.issuedAt,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("lucky_numbers")
      .upsert(batch, { onConflict: "slip_key", ignoreDuplicates: true });
    if (error) {
      failures += batch.length;
      console.error(`Lucky numbers: batch failed — ${error.message}${MISSING_SCHEMA_HINT}`);
      return;
    }
  }
  console.log(`Lucky numbers: ${rows.length} synced.`);
}

// --- Photos ------------------------------------------------------------------
async function syncPhotos() {
  let files;
  try {
    files = (await readdir(PHOTO_DIR)).filter((name) => name.endsWith(".jpg"));
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Photos: none taken yet (no photos/ folder).");
      return;
    }
    throw error;
  }

  let done = 0;
  const queue = [...files];
  // A few at a time — quick, without flooding a weak connection.
  async function worker() {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const token = name.split(".")[0];
      const bytes = await readFile(path.join(PHOTO_DIR, name));
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${token}/${name}`, bytes, { contentType: "image/jpeg", upsert: true });
      if (error) {
        failures++;
        console.error(`Photos: ${name} failed — ${error.message}`);
      } else {
        done++;
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`Photos: ${done} of ${files.length} uploaded.`);
  if (done < files.length && done === 0) console.error(MISSING_SCHEMA_HINT.trim());
}

await syncLuckyNumbers();
await syncPhotos();
if (failures > 0) {
  console.error(`\n${failures} item(s) not synced — check the connection and run again.`);
  process.exit(1);
}
console.log("\nAll synced.");
