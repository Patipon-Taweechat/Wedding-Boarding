import { Meta } from "@/components/ui/Meta";
import { couple } from "@/lib/wedding";

/**
 * The guest's boarding pass (wedding-invite/src/components/ui/BoardingPass.tsx),
 * drawn at door size: white stock and the deep-green header band with the
 * couple's nameplate. Kept clean on purpose — no outline, no shadow, no
 * watermark under the camera: just the white card on the ivory page. The
 * scanner sits inside it while the gate waits, and the guest it finds takes
 * its place — so the door screen is the same object the guest is holding up
 * to it.
 */
export function Ticket({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="relative overflow-hidden rounded-2xl bg-pass text-foreground">
      <header className="flex h-15 items-center justify-between gap-4 bg-secondary-deep px-6">
        <p className="font-masthead text-2xl text-secondary-foreground">{couple.monogram} Wedding</p>
        <p className="text-sm text-secondary-foreground/90">{label}</p>
      </header>

      <div className="px-6 pt-5 pb-6">{children}</div>
    </section>
  );
}

export interface PassFact {
  label: string;
  value: React.ReactNode;
  /** The small line under the value ("Please arrive"). */
  note?: string;
  tone?: "primary";
}

/**
 * The grey band across the pass — Date / Boarding / Departure on the guest's
 * own, Party / Table / Seat once the door has found them. It runs edge to edge
 * of the ticket, out through the body's padding.
 */
export function PassBand({ facts, className = "" }: { facts: PassFact[]; className?: string }) {
  return (
    <dl
      className={`-mx-6 grid grid-cols-3 gap-4 border-y border-pass-border bg-pass-band px-6 py-3 text-center ${className}`}
    >
      {facts.map((fact) => (
        <div key={fact.label}>
          <Meta as="dt" tone="muted">
            {fact.label}
          </Meta>
          <dd
            className={`mt-2 text-lg font-semibold whitespace-nowrap tabular-nums ${
              fact.tone === "primary" ? "text-primary" : "text-foreground"
            }`}
          >
            {fact.value}
            {fact.note ? (
              <span className="block text-xs font-normal whitespace-normal text-muted-foreground">{fact.note}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
