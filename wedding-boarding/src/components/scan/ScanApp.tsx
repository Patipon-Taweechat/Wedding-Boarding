"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  boardGuest,
  findByToken,
  getStats,
  type Guest,
  type Stats,
} from "@/app/actions/boarding";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";
import { extractToken } from "@/lib/token";
import { couple } from "@/lib/wedding";
import { GuestPanel, type PanelState } from "./GuestPanel";
import { Scanner } from "./Scanner";
import { SearchPanel } from "./SearchPanel";
import { StatsBar } from "./StatsBar";

function toPanelState(guest: Guest): PanelState {
  if (guest.boardedAt) return { kind: "already", guest };
  if (!guest.attending) return { kind: "not-attending", guest };
  return { kind: "confirm", guest };
}

export function ScanApp({ initialStats }: { initialStats: Stats }) {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [searchOpen, setSearchOpen] = useState(false);

  // The active token, kept outside React state — it drives what `onConfirm`
  // acts on and needs to survive re-renders without itself triggering one.
  const activeToken = useRef<string | null>(null);
  const lastDecoded = useRef<string | null>(null);
  const busy = useRef(false);

  const scanning = panel === null && !searchOpen;

  const refreshStats = useCallback(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const reset = useCallback(() => {
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

  const handleConfirm = useCallback(
    async (arrived: number) => {
      const token = activeToken.current;
      if (!token) return;
      setPanel((current) =>
        current && (current.kind === "confirm" || current.kind === "not-attending")
          ? { kind: "confirming", guest: current.guest }
          : current,
      );

      const result = await boardGuest(token, arrived);
      refreshStats();

      if (result.ok) {
        setPanel({ kind: "success", guest: result.guest, arrived });
        setTimeout(reset, 2200);
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
    },
    [reset, refreshStats],
  );

  const handlePickFromSearch = useCallback((guest: Guest) => {
    setSearchOpen(false);
    activeToken.current = guest.token;
    setPanel(toPanelState(guest));
  }, []);

  useEffect(() => {
    const id = setInterval(refreshStats, 30_000);
    return () => clearInterval(id);
  }, [refreshStats]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <Meta tone="muted">
            {couple.one} &amp; {couple.two} · Boarding gate
          </Meta>
          <div className="mt-2">
            <StatsBar stats={stats} />
          </div>
        </div>
      </header>

      <div className="mt-6 flex-1">
        <div className={scanning ? "" : "hidden"}>
          <Scanner onDecode={handleDecode} paused={!scanning} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Hold the guest&rsquo;s pass up to the camera
          </p>
          <Button variant="quiet" className="mx-auto mt-6 block" onClick={() => setSearchOpen(true)}>
            Can&rsquo;t scan? Search by name or phone
          </Button>
        </div>

        {panel ? <GuestPanel state={panel} onConfirm={handleConfirm} onReset={reset} /> : null}
      </div>

      <form action={logout} className="mt-8 text-center">
        <button type="submit" className="text-xs text-muted-foreground/60 underline-offset-4 hover:underline">
          Lock screen
        </button>
      </form>

      {searchOpen ? <SearchPanel onPick={handlePickFromSearch} onClose={() => setSearchOpen(false)} /> : null}
    </main>
  );
}
