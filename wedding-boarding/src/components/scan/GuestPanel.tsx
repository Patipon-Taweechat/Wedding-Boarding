"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";
import { formatPhone, formatSeats } from "@/lib/format";
import { partySize } from "@/lib/party";
import type { Guest } from "@/app/actions/boarding";
import { PhotoCapture, type CapturedPhoto, type PhotoCopy } from "./PhotoCapture";
import { PassBand, type PassFact } from "./Ticket";

/** Where the boarding slip for the shown guest is — printed by the server on
 * the door's receipt printer. */
export type PrintStatus =
  | { state: "printing" }
  | { state: "printed"; count: number }
  /** `resumeFrom`: the first slip that didn't print — Retry starts there. */
  | { state: "failed"; message: string; resumeFrom: number };

/** Which photo is being taken: a guest on their own (`slip` left out), or
 * guest `slip` of `party` — a party goes one guest at a time, photo then
 * slip, so each slip can be torn off and handed over before the next. */
export interface PhotoStep {
  slip?: number;
  party: number;
}

/** What the ticket is showing right now — the caller (ScanApp) drives this.
 * "loading" is drawn by ScanApp itself, over the paused camera. */
export type PanelState =
  | { kind: "loading" }
  | { kind: "confirm"; guest: Guest }
  | { kind: "confirming"; guest: Guest }
  | ({ kind: "photo"; guest: Guest; saving?: boolean; error?: string } & PhotoStep)
  /** Guest `slip` of a party: their slip printing, then torn off. */
  | { kind: "slip"; guest: Guest; party: number; slip: number; print: PrintStatus }
  | { kind: "success"; guest: Guest; arrived: number; print?: PrintStatus }
  | { kind: "already"; guest: Guest; print?: PrintStatus }
  | { kind: "not-attending"; guest: Guest }
  | { kind: "not-found" }
  | { kind: "error" };

/** Nothing placed yet — the guest's own pass prints the same. */
const UNASSIGNED = "N/A";

/** Party (or how many arrived), table and seat — the band across the pass. */
function seatFacts(guest: Guest, count: { label: string; value: number }): PassFact[] {
  return [
    count,
    { label: "Table", value: guest.table ?? UNASSIGNED, tone: "primary" },
    { label: "Seat", value: guest.seatLabels.length ? formatSeats(guest.seatLabels) : UNASSIGNED },
  ];
}

function failedFrom(print?: PrintStatus): number {
  return print?.state === "failed" ? print.resumeFrom : 1;
}

function clockTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
}

/** The guest's name at the head of the pass, in the display face, large
 * enough to read back to them across the door. */
function PassName({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 font-display text-[2.75rem] leading-tight text-foreground">{children}</h2>;
}

/** A line of news on the pass, in the invitation's own two kinds of box. */
function PassNote({ tone, children }: { tone: "olive" | "plain"; children: React.ReactNode }) {
  const toneClass =
    tone === "olive"
      ? "border-secondary bg-secondary/10 text-secondary-dark"
      : "border-pass-border bg-pass-band text-muted-foreground";
  return <p className={`mt-6 rounded-lg border px-5 py-4 text-base leading-relaxed ${toneClass}`}>{children}</p>;
}

/**
 * Confirm screen: one tap checks in the full booked party (the common case at
 * a door with a queue). The number row lets staff correct the count down —
 * e.g. a party of four where only two showed — before confirming.
 */
function ConfirmBody({
  guest,
  onConfirm,
  onReset,
  pending,
}: {
  guest: Guest;
  onConfirm: (arrived: number) => void;
  onReset: () => void;
  pending: boolean;
}) {
  const [arrived, setArrived] = useState(guest.guests);

  return (
    <div className="rise-in text-center">
      <Meta>Passenger</Meta>
      <PassName>{guest.name}</PassName>
      <p className="mt-1 text-base text-muted-foreground tabular-nums">{formatPhone(guest.phone)}</p>

      <PassBand className="mt-6" facts={seatFacts(guest, { label: "Party", value: guest.guests })} />

      {guest.guests > 1 ? (
        <fieldset className="mt-6">
          <legend className="mx-auto">
            <Meta as="span">How many arrived?</Meta>
          </legend>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {Array.from({ length: guest.guests }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setArrived(n)}
                aria-pressed={arrived === n}
                className={`h-14 w-14 rounded-lg border text-lg tabular-nums transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pass focus-visible:outline-none ${
                  arrived === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-pass-border bg-pass text-foreground hover:border-secondary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <Button className="mt-7 w-full" disabled={pending} onClick={() => onConfirm(arrived)}>
        {pending ? "Boarding…" : `Board${guest.guests > 1 ? ` · ${arrived} arrived` : ""}`}
      </Button>
      {/* The way back from a wrong pick in search — nothing is written yet. */}
      <Button variant="quiet" className="mx-auto mt-2" disabled={pending} onClick={onReset}>
        Not this guest
      </Button>
    </div>
  );
}

/** A scan that found nobody, or a request that failed — still on the pass,
 * so the door never drops off the card the guest is holding. */
function NoticeBody({ title, body, onReset }: { title: string; body: string; onReset: () => void }) {
  return (
    <div className="rise-in py-6 text-center">
      <PassName>{title}</PassName>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
      <Button variant="outline" className="mt-8 w-full" onClick={onReset}>
        Try again
      </Button>
    </div>
  );
}

/** One slip per guest, so the line counts them. */
function PrintLine({ print, slips }: { print?: PrintStatus; slips: number }) {
  if (!print) return null;
  const text =
    print.state === "printing"
      ? slips > 1
        ? `Printing ${slips} slips…`
        : "Printing slip…"
      : print.state === "printed"
        ? print.count > 1
          ? `${print.count} slips printed`
          : "Slip printed"
        : `Print failed — ${print.message}`;
  return (
    <p
      role="status"
      className={`mt-5 text-center text-sm ${print.state === "failed" ? "text-danger" : "text-muted-foreground"}`}
    >
      {text}
    </p>
  );
}

/** The photo step's wording for a guest alone, or one guest of a party in
 * turn — each prints their own slip straight after their photo. */
function photoCopy({ slip, party }: PhotoStep): PhotoCopy {
  if (slip === undefined) {
    return {
      heading: "Smile 😊",
      doneLabel: "Print slip",
      skipLabel: "Skip photo and print",
    };
  }
  return {
    heading: slip === 1 ? "First guest — smile." : "Next guest — smile.",
    caption: `Guest ${slip} of ${party}`,
    doneLabel: "Print my slip",
    skipLabel: "Skip photo and print",
  };
}

/**
 * One guest of a party: their slip printing, then a moment to tear it off
 * before the next guest's photo comes up by itself (or straight away with
 * "Next guest"). A failed print waits for Retry, or Skip to move on.
 */
function SlipBody({
  party,
  slip,
  print,
  onRetry,
  onNext,
}: {
  party: number;
  slip: number;
  print: PrintStatus;
  onRetry: () => void;
  onNext: () => void;
}) {
  const last = slip === party;
  const heading =
    print.state === "printing"
      ? "Printing your slip…"
      : print.state === "printed"
        ? "Tear off your slip"
        : "The slip didn't print";
  return (
    <div className="rise-in text-center" role="status">
      <Meta>
        Guest {slip} of {party}
      </Meta>
      <h2 className="mt-3 font-display text-4xl leading-tight text-primary italic">{heading}</h2>
      {print.state === "failed" ? (
        <p className="mt-3 text-sm text-danger">{print.message}</p>
      ) : (
        <p className="mt-3 text-base text-muted-foreground">
          {last ? "That's everyone on this pass." : `Next up: guest ${slip + 1} of ${party}.`}
        </p>
      )}
      <div className="mt-7 grid gap-3">
        {print.state === "failed" ? (
          <>
            <Button onClick={onRetry}>Retry print</Button>
            <Button variant="secondary" onClick={onNext}>
              {last ? "Skip — finish" : "Skip — next guest"}
            </Button>
          </>
        ) : (
          <Button disabled={print.state === "printing"} onClick={onNext}>
            {last ? "Done" : "Next guest"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** What the ticket shows once the gate has found someone. */
export function GuestPanel({
  state,
  onConfirm,
  onPhotoDone,
  onSlipRetry,
  onSlipNext,
  onNewPhoto,
  onPrint,
  onReset,
}: {
  state: PanelState;
  onConfirm: (arrived: number) => void;
  onPhotoDone: (photo: CapturedPhoto | null, step: PhotoStep) => void;
  /** Reprints the slip a party's guest is waiting on. */
  onSlipRetry: () => void;
  /** On to the next guest's photo (or the welcome card, after the last). */
  onSlipNext: () => void;
  onNewPhoto: () => void;
  /** Prints the party's slips from slip `from` on. */
  onPrint: (from: number) => void;
  onReset: () => void;
}) {
  if (state.kind === "loading") return null;

  if (state.kind === "confirm" || state.kind === "confirming") {
    return <ConfirmBody
        guest={state.guest}
        onConfirm={onConfirm}
        onReset={onReset}
        pending={state.kind === "confirming"}
      />;
  }

  if (state.kind === "slip") {
    return (
      <SlipBody party={state.party} slip={state.slip} print={state.print} onRetry={onSlipRetry} onNext={onSlipNext} />
    );
  }

  if (state.kind === "photo") {
    const step: PhotoStep = { slip: state.slip, party: state.party };
    return (
      // A fresh camera round for each guest in turn.
      <PhotoCapture
        key={state.slip ?? "alone"}
        copy={photoCopy(step)}
        pending={state.saving}
        error={state.error}
        onDone={(photo) => onPhotoDone(photo, step)}
      />
    );
  }

  if (state.kind === "success") {
    const time = clockTime(state.guest.boardedAt);
    return (
      <div className="rise-in text-center">
        <Meta>Boarded{time ? ` · ${time}` : ""}</Meta>
        {/* The invitation's thank-you line: display italic, in burgundy. */}
        <h2 className="mt-3 font-display text-[2.75rem] leading-tight text-primary italic">
          Welcome aboard
        </h2>

        <PassBand className="mt-6" facts={seatFacts(state.guest, { label: "Arrived", value: state.arrived })} />

        <PrintLine print={state.print} slips={partySize(state.guest)} />
        <div className="mt-6 flex flex-col gap-3">
          {state.print?.state === "failed" ? (
            <Button className="w-full" onClick={() => onPrint(failedFrom(state.print))}>
              Retry print
            </Button>
          ) : null}
          <Button variant="outline" className="w-full" onClick={onReset}>
            Scan next
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "already") {
    const time = clockTime(state.guest.boardedAt);
    const printing = state.print?.state === "printing";
    const slips = partySize(state.guest);
    return (
      <div className="rise-in text-center">
        <Meta>Already boarded</Meta>
        <PassName>{state.guest.name}</PassName>

        <PassNote tone="olive">
          Boarded
          {time && state.guest.boardedAt ? (
            <>
              {" at "}
              <time dateTime={state.guest.boardedAt}>{time}</time>
            </>
          ) : null}
          {state.guest.boardedCount ? ` · ${state.guest.boardedCount} arrived` : ""}
        </PassNote>

        <PrintLine print={state.print} slips={slips} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={printing} onClick={() => onPrint(1)}>
            {slips > 1 ? "Reprint slips" : "Reprint slip"}
          </Button>
          <Button variant="secondary" disabled={printing} onClick={onNewPhoto}>
            New photo
          </Button>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={onReset}>
          Scan next
        </Button>
      </div>
    );
  }

  if (state.kind === "not-attending") {
    return (
      <div className="rise-in text-center">
        <Meta tone="muted">Not expected</Meta>
        <PassName>{state.guest.name}</PassName>

        <PassNote tone="plain">
          Replied that they could not come — confirm with the couple&rsquo;s team before letting them in.
        </PassNote>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onReset}>
            Scan next
          </Button>
          <Button variant="danger" onClick={() => onConfirm(1)}>
            Board anyway
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "not-found") {
    return <NoticeBody title="Not recognised" body="This code doesn't match any RSVP." onReset={onReset} />;
  }

  return <NoticeBody title="Something went wrong" body="Check the connection and try again." onReset={onReset} />;
}
