"use client";

import { useCallback, useRef, useState } from "react";
import {
  boardGuest,
  findByToken,
  printBoardingSlips,
  saveBoardingPhoto,
  type Guest,
} from "@/app/actions/boarding";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { FlightPath } from "@/components/ui/FlightPath";
import { partySize } from "@/lib/party";
import { extractToken } from "@/lib/token";
import { couple, passTimes, weddingDate } from "@/lib/wedding";
import { Florals } from "./Florals";
import { GuestPanel, type PanelState, type PhotoMode, type PhotoStep, type PrintStatus } from "./GuestPanel";
import type { CapturedPhoto } from "./PhotoCapture";
import { Scanner } from "./Scanner";
import { SearchPanel } from "./SearchPanel";
import { PassBand, Ticket, type PassFact } from "./Ticket";

function toPanelState(guest: Guest): PanelState {
  if (guest.boardedAt) return { kind: "already", guest };
  if (!guest.attending) return { kind: "not-attending", guest };
  return { kind: "confirm", guest };
}

/** The photo step for a guest just boarded: a party is asked first whether
 * it's one photo together or one each; a guest alone goes straight to it. */
function photoStart(guest: Guest): PanelState {
  const party = partySize(guest);
  return party > 1 ? { kind: "photo-choice", guest, party } : { kind: "photo", guest, party };
}

/** The band the guest's own pass prints, under the camera while it waits. */
const gateFacts: PassFact[] = [
  { label: "Date", value: <time dateTime={weddingDate.iso}>{weddingDate.short}</time>, note: weddingDate.weekday },
  { label: "Boarding", value: passTimes.boarding, note: "Please arrive", tone: "primary" },
  { label: "Departure", value: passTimes.departure, note: "Ceremony start" },
];

/** What the ticket's header calls itself while it shows each thing. */
function ticketLabel(panel: PanelState | null) {
  if (!panel || panel.kind === "loading") return "Boarding gate";
  if (panel.kind === "photo" || panel.kind === "photo-choice") return "Boarding photo";
  if (panel.kind === "not-found" || panel.kind === "error") return "Boarding gate";
  return "Boarding pass";
}

export function ScanApp() {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // The active token, kept outside React state — it drives what `onConfirm`
  // acts on and needs to survive re-renders without itself triggering one.
  const activeToken = useRef<string | null>(null);
  const lastDecoded = useRef<string | null>(null);
  const busy = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanning = panel === null && !searchOpen;
  const lookingUp = panel?.kind === "loading";

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
    activeToken.current = null;
    lastDecoded.current = null;
    busy.current = false;
    setPanel(null);
  }, []);

  const lookup = useCallback(async (token: string) => {
    activeToken.current = token;
    setPanel({ kind: "loading" });
    const result = await findByToken(token);
    if (!result.ok) {
      setPanel({ kind: "not-found" });
      return;
    }
    setPanel(toPanelState(result.guest));
  }, []);

  const handleDecode = useCallback(
    (text: string) => {
      if (busy.current) return;
      const token = extractToken(text);
      // Ignore repeats of the same code while it's still in the frame, but a
      // reset (scanning again) clears lastDecoded so the same guest can be
      // re-scanned later if needed.
      if (!token || token === lastDecoded.current) return;
      lastDecoded.current = token;
      busy.current = true;
      lookup(token).finally(() => {
        busy.current = false;
      });
    },
    [lookup],
  );

  /**
   * Prints the active guest's slips on the door printer (via the server), one
   * per guest, from slip `from` on. Only touches the panel if it still shows
   * that same guest, so a slow print can't paint its status onto the next
   * guest's screen. After a successful print on the welcome screen, the
   * scanner comes back by itself.
   */
  const runPrint = useCallback(
    async (autoReset: boolean, from: number) => {
      const token = activeToken.current;
      if (!token) return;
      const setPrint = (print: PrintStatus) => {
        if (activeToken.current !== token) return;
        setPanel((current) =>
          current && (current.kind === "success" || current.kind === "already") ? { ...current, print } : current,
        );
      };

      setPrint({ state: "printing" });
      const result = await printBoardingSlips(token, from).catch(() => ({
        ok: false as const,
        message: "Could not reach the server",
        resumeFrom: from,
      }));
      if (!result.ok) {
        setPrint({ state: "failed", message: result.message, resumeFrom: result.resumeFrom });
        return;
      }
      setPrint({ state: "printed", count: result.printed });
      if (autoReset && activeToken.current === token) {
        resetTimer.current = setTimeout(reset, 2200);
      }
    },
    [reset],
  );

  /** The welcome card, and every slip of the party sent to the printer. */
  const finish = useCallback(
    (guest: Guest) => {
      setPanel({ kind: "success", guest, arrived: partySize(guest) });
      void runPrint(true, 1);
    },
    [runPrint],
  );

  const handleConfirm = useCallback(async (arrived: number) => {
    const token = activeToken.current;
    if (!token) return;
    setPanel((current) =>
      current && (current.kind === "confirm" || current.kind === "not-attending")
        ? { kind: "confirming", guest: current.guest }
        : current,
    );

    const result = await boardGuest(token, arrived);

    if (result.ok) {
      // Boarded — now the photo; the slips print once it's taken.
      setPanel(photoStart(result.guest));
      return;
    }
    if (result.reason === "already" && result.guest) {
      setPanel({ kind: "already", guest: result.guest });
      return;
    }
    if (result.reason === "not-found") {
      setPanel({ kind: "not-found" });
      return;
    }
    setPanel({ kind: "error" });
  }, []);

  /** A party's answer: one photo of them all, one each in turn, or none. */
  const handlePhotoChoice = useCallback(
    (mode: PhotoMode) => {
      if (panel?.kind !== "photo-choice") return;
      const { guest, party } = panel;
      if (mode === "skip") finish(guest);
      else setPanel({ kind: "photo", guest, party, slip: mode === "each" ? 1 : undefined });
    },
    [panel, finish],
  );

  /**
   * A photo taken (or skipped). It goes up to the laptop before anything
   * moves on, so the slip that prints is sure to have it; then the next guest
   * in turn, or — the last photo — the welcome card and the slips.
   */
  const savingPhoto = useRef(false);
  const handlePhotoDone = useCallback(
    async (photo: CapturedPhoto | null, { slip, party }: PhotoStep) => {
      const token = activeToken.current;
      if (!token || savingPhoto.current || panel?.kind !== "photo") return;
      const guest = panel.guest;

      if (photo) {
        savingPhoto.current = true;
        setPanel({ ...panel, saving: true, error: undefined });
        const saved = await saveBoardingPhoto(token, photo, slip).catch(() => ({
          ok: false as const,
          message: "Could not reach the server",
        }));
        savingPhoto.current = false;
        if (activeToken.current !== token) return;
        if (!saved.ok) {
          setPanel({ ...panel, saving: false, error: saved.message });
          return;
        }
      }

      if (slip !== undefined && slip < party) setPanel({ kind: "photo", guest, party, slip: slip + 1 });
      else finish(guest);
    },
    [panel, finish],
  );

  /** An already-boarded guest (or party) wants new photos, and new slips. */
  const handleNewPhoto = useCallback(() => {
    setPanel((current) => (current?.kind === "already" ? photoStart(current.guest) : current));
  }, []);

  const handlePickFromSearch = useCallback((guest: Guest) => {
    setSearchOpen(false);
    activeToken.current = guest.token;
    setPanel(toPanelState(guest));
  }, []);

  // The invitation's cover, as the last page of it: ivory paper, a line
  // spoken to the guest, the couple's names in script with the flight path
  // between them, and — where the cover has its passport collage — the
  // boarding pass itself, florals gathered at its corners, with the camera
  // inside it. One column at every size, top to bottom: words, ticket, search.
  return (
    <main className="relative min-h-svh overflow-hidden">
      <form action={logout} className="absolute top-3 left-3 z-10">
        <Button type="submit" variant="quiet" size="small">
          Lock screen
        </Button>
      </form>

      <div className="mx-auto flex min-h-svh w-full max-w-[34rem] flex-col items-center justify-center gap-y-8 px-6 py-14">
        <header className="rise-in w-full text-center">
          <p className="text-lg font-medium text-foreground">Please present your boarding pass</p>

          {/* On one line, so the height goes to the ticket. */}
          <h1 className="mt-3 flex items-center justify-center gap-4 text-6xl">
            <span className="font-script leading-[1.2] text-secondary-deep">{couple.one}</span>
            <FlightPath className="w-16 shrink-0 text-secondary-deep" />
            <span className="sr-only">and</span>
            <span className="font-script leading-[1.2] text-secondary-deep">{couple.two}</span>
          </h1>
        </header>

        {/* The stage the florals are placed against: the ticket's own width. */}
        <div className="@container relative isolate w-[min(100%,30rem)]">
          <Florals />

          <div className="relative z-10">
            <Ticket label={ticketLabel(panel)}>
              <div className={scanning || lookingUp ? "rise-in" : "hidden"}>
                <Scanner onDecode={handleDecode} paused={!scanning} notice={lookingUp ? "Checking pass…" : undefined} />
                <PassBand facts={gateFacts} className="mt-5" />
                <p className="mt-4 text-center text-base text-muted-foreground">Hold your pass up to the camera</p>
              </div>

              {panel && !lookingUp ? (
                <GuestPanel
                  state={panel}
                  onConfirm={handleConfirm}
                  onPhotoChoice={handlePhotoChoice}
                  onPhotoDone={(photo, step) => void handlePhotoDone(photo, step)}
                  onNewPhoto={handleNewPhoto}
                  onPrint={(from) => void runPrint(false, from)}
                  onReset={reset}
                />
              ) : null}
            </Ticket>
          </div>
        </div>

        {/* Only while the gate is waiting — a guest on the ticket is dealt
            with first. Hidden, not removed, so the ticket does not shift. */}
        <div
          className={`rise-in w-[min(100%,30rem)] [animation-delay:150ms] ${
            panel ? "invisible" : ""
          }`}
        >
          <Button variant="outline" className="w-full" onClick={() => setSearchOpen(true)}>
            Find a guest
          </Button>
        </div>
      </div>

      {searchOpen ? <SearchPanel onPick={handlePickFromSearch} onClose={() => setSearchOpen(false)} /> : null}
    </main>
  );
}
