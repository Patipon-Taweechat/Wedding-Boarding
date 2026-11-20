import { Florals } from "@/components/scan/Florals";
import { PinPad } from "@/components/scan/PinPad";
import { Ticket } from "@/components/scan/Ticket";
import { FlightPath } from "@/components/ui/FlightPath";
import { couple } from "@/lib/wedding";

/**
 * The lock in front of the gate, drawn as the gate itself: the couple's
 * names in script over the same ticket, florals at its corners, with the PIN
 * pad where the camera will be.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-14 text-center">
      <h1 className="rise-in flex items-center justify-center gap-4 text-6xl">
        <span className="font-script leading-[1.2] text-secondary-deep">{couple.one}</span>
        <FlightPath className="w-16 shrink-0 text-secondary-deep" />
        <span className="sr-only">and</span>
        <span className="font-script leading-[1.2] text-secondary-deep">{couple.two}</span>
      </h1>

      <div className="@container relative isolate mt-10 w-[min(100%,26rem)]">
        <Florals />
        <div className="relative z-10">
          <Ticket label="Staff only">
            <p className="font-display text-3xl text-foreground">Enter the gate PIN</p>
            <div className="mt-8">
              <PinPad next={next && next.startsWith("/") ? next : "/scan"} />
            </div>
          </Ticket>
        </div>
      </div>
    </main>
  );
}
