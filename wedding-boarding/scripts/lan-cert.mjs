// Makes the dev HTTPS certificate cover this machine's Wi-Fi address, not just
// localhost. `next dev --experimental-https` alone issues a certificate for
// localhost / 127.0.0.1 / ::1, so the iPad opening https://<laptop-ip>:3000
// gets "certificate is for a different address" — Chrome won't let you past
// that at all. Next can add one more host, but only via `-H`, which also binds
// the server to that address and breaks https://localhost:3000.
//
// So this calls Next's own certificate helper with the LAN IP and writes into
// the same `certificates/` folder Next uses. The result still covers
// localhost, so the `next dev --experimental-https` that runs next reuses it.
// It is regenerated whenever the IP changes (e.g. at the venue's Wi-Fi).
//
// Override the detected address with LAN_IP=192.168.x.y if it picks the wrong
// network adapter (VPN, WSL / Hyper-V on Windows).
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";

const require = createRequire(import.meta.url);
const { createSelfSignedCertificate } = require("next/dist/lib/mkcert");

// Home and venue routers hand out 192.168.x first, then 10.x; 172.16–31 is
// last because Docker / WSL / Hyper-V virtual adapters live there.
const PREFERENCE = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];

function detectLanIp() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
  for (const range of PREFERENCE) {
    const match = addresses.find((address) => range.test(address));
    if (match) return match;
  }
  return undefined;
}

const lanIp = process.env.LAN_IP || detectLanIp();
if (!lanIp) {
  console.warn("No Wi-Fi/LAN address found — the certificate will cover localhost only.");
}

const cert = await createSelfSignedCertificate(lanIp, "certificates");
if (!cert) {
  console.error("Could not create the HTTPS certificate (see the error above).");
  process.exit(1);
}

if (lanIp) {
  console.log(`\n  iPad URL:  https://${lanIp}:3000`);
  console.log(`  To skip the certificate warning, install this CA on the iPad: ${cert.rootCA}\n`);
}
