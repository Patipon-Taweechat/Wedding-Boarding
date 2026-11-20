"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";
import { formatPhone, formatSeats } from "@/lib/format";
import type { Guest } from "@/app/actions/boarding";
import { PhotoCapture, type CapturedPhoto } from "./PhotoCapture";

/** Where the boarding slip for the shown guest is — printed by the server on
 * the door's receipt printer. */
export type PrintStatus =
  | { state: "printing" }
  | { state: "printed" }
  | { state: "failed"; message: string };

/** What the panel is showing right now — the caller (ScanApp) drives this. */
export type PanelState =
  | { kind: "loading" }
  | { kind: "confirm"; guest: Guest }
  | { kind: "confirming"; guest: Guest }
  | { kind: "photo"; guest: Guest; arrived: number }
  | { kind: "success"; guest: Guest; arrived: number; print?: PrintStatus }
  | { kind: "already"; guest: Guest; print?: PrintStatus }
  | { kind: "not-attending"; guest: Guest }
  | { kind: "not-found" }
  | { kind: "error" };

function GuestFacts({ guest }: { guest: Guest }) {
  return (
    <dl className="mt-6 space-y-4 border-t border-border pt-6 text-left">
      <div className="flex items-baseline justify-between gap-6">
        <Meta as="dt" tone="muted">Party</Meta>
        <dd className="font-display text-2xl text-foreground tabular-nums">{guest.guests}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-6">
        <Meta as="dt" tone="muted">Table</Meta>
        <dd className="font-display text-2xl text-primary tabular-nums">
          {guest.table ?? "—"}
          {guest.seatLabels.length ? (
            <span className="ml-2 text-sm text-muted-foreground">{formatSeats(guest.seatLabels)}</span>
          ) : null}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-6">
        <Meta as="dt" tone="muted">Phone</Meta>
        <dd className="text-sm text-foreground tabular-nums">{formatPhone(guest.phone)}</dd>
      </div>
    </dl>
  );
}

/**
 * Confirm screen: one tap checks in the full booked party (the common case at
 * a door with a queue). The number row lets staff correct the count down —
 * e.g. a party of four where only two showed — before confirming.
 */
function ConfirmCard({
  guest,
  onConfirm,
  pending,
}: {
  guest: Guest;
  onConfirm: (arrived: number) => void;
  pending: boolean;
}) {
  const [arrived, setArrived] = useState(guest.guests);

  return (
    <div className="pop-in text-center">
      <Meta>Scanned</Meta>
      <h2 className="mt-2 font-display text-4xl text-primary">{guest.name}</h2>
      <GuestFacts guest={guest} />

      {guest.guests > 1 ? (
        <div className="mt-6 space-y-2 text-left">
          <Meta tone="muted">How many arrived?</Meta>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: guest.guests }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setArrived(n)}
                aria-pressed={arrived === n}
                className={`h-12 w-12 rounded-lg border text-base tabular-nums transition-colors ${
                  arrived === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Button className="mt-8 w-full text-lg" disabled={pending} onClick={() => onConfirm(arrived)}>
        {pending ? "Boarding…" : `Board${guest.guests > 1 ? ` · ${arrived} arrived` : ""}`}
      </Button>
    </div>
  );
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "success" | "warn" | "danger";
  title: string;
  body?: React.ReactNode;
}) {
  const toneClass = {
    success: "border-success bg-success/10 text-success",
    warn: "border-secondary bg-secondary/10 text-secondary-dark",
    danger: "border-danger bg-danger/10 text-danger",
  }[tone];

  return (
    <div className={`pop-in rounded-2xl border px-6 py-8 text-center ${toneClass}`}>
      <p className="font-display text-3xl">{title}</p>
      {body ? <div className="mt-3 text-sm text-foreground/80">{body}</div> : null}
    </div>
  );
}

function PrintLine({ print }: { print?: PrintStatus }) {
  if (!print) return null;
  const text =
    print.state === "printing"
      ? "Printing slip…"
      : print.state === "printed"
        ? "Slip printed"
        : `Print failed — ${print.message}`;
  return (
    <p
      role="status"
      className={`mt-4 text-center text-sm ${print.state === "failed" ? "text-danger" : "text-muted-foreground"}`}
    >
      {text}
    </p>
  );
}

export function GuestPanel({
  state,
  onConfirm,
  onPhotoDone,
  onNewPhoto,
  onPrint,
  onReset,
}: {
  state: PanelState;
  onConfirm: (arrived: number) => void;
  onPhotoDone: (photo: CapturedPhoto | null) => void;
  onNewPhoto: () => void;
  onPrint: () => void;
  onReset: () => void;
}) {
  if (state.kind === "loading") {
    return <p className="py-10 text-center text-muted-foreground">Looking up pass…</p>;
  }

  if (state.kind === "confirm" || state.kind === "confirming") {
    return <ConfirmCard guest={state.guest} onConfirm={onConfirm} pending={state.kind === "confirming"} />;
  }

  if (state.kind === "photo") {
    return <PhotoCapture guestName={state.guest.name} onDone={onPhotoDone} />;
  }

  if (state.kind === "success") {
    return (
      <>
      <StatusCard
        tone="success"
        title={`Welcome, ${state.guest.name.split(" ")[0]}!`}
        body={
          <>
            Table {state.guest.table ?? "—"} ·{" "}
            {state.arrived} {state.arrived === 1 ? "guest" : "guests"} boarded
          </>
        }
      />
      <PrintLine print={state.print} />
      <div className="mt-4 flex gap-3">
        {state.print?.state === "failed" ? (
          <Button className="flex-1" onClick={onPrint}>
            Retry print
          </Button>
        ) : null}
        <Button variant="outline" className="flex-1" onClick={onReset}>
          Scan next
        </Button>
      </div>
      </>
    );
  }

  if (state.kind === "already") {
    const time = state.guest.boardedAt
      ? new Date(state.guest.boardedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : null;
    return (
      <>
        <StatusCard
          tone="warn"
          title={`${state.guest.name} — already boarded`}
          body={
            <>
              Boarded{time ? ` at ${time}` : ""}
              {state.guest.boardedCount ? ` · ${state.guest.boardedCount} arrived` : ""}
            </>
          }
        />
        <PrintLine print={state.print} />
        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={state.print?.state === "printing"}
            onClick={onPrint}
          >
            Reprint slip
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={state.print?.state === "printing"}
            onClick={onNewPhoto}
          >
            New photo
          </Button>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={onReset}>
          Scan next
        </Button>
      </>
    );
  }

  if (state.kind === "not-attending") {
    return (
      <>
        <StatusCard
          tone="warn"
          title={state.guest.name}
          body="Replied that they could not come — confirm with the couple's team before letting them in."
        />
        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onReset}>
            Scan next
          </Button>
          <Button variant="danger" className="flex-1" onClick={() => onConfirm(1)}>
            Board anyway
          </Button>
        </div>
      </>
    );
  }

  if (state.kind === "not-found") {
    return (
      <>
        <StatusCard tone="danger" title="Not recognised" body="This code doesn't match any RSVP." />
        <Button variant="outline" className="mt-4 w-full" onClick={onReset}>
          Try again
        </Button>
      </>
    );
  }

  return (
    <>
      <StatusCard tone="danger" title="Something went wrong" body="Check the connection and try again." />
      <Button variant="outline" className="mt-4 w-full" onClick={onReset}>
        Try again
      </Button>
    </>
  );
}
