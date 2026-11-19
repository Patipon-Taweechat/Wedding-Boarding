// qr-scanner ships a worker file that has to be served as a static asset —
// Next's bundler does not follow the package's own worker import, so this
// copies it into public/ on every install. Documented approach for
// frameworks (Next, CRA) that don't support bundling a Worker from a
// node_modules import path.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "qr-scanner", "qr-scanner-worker.min.js");
const destDir = join(root, "public");
const dest = join(destDir, "qr-scanner-worker.min.js");

if (!existsSync(src)) {
  console.warn("qr-scanner worker not found — did `npm install` finish?");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("Copied qr-scanner worker to public/qr-scanner-worker.min.js");
