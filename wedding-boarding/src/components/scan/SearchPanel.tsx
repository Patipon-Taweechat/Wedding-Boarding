"use client";

import { useState, useTransition } from "react";
import { searchGuests, type Guest } from "@/app/actions/boarding";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";

export function SearchPanel({
  onPick,
  onClose,
}: {
  onPick: (guest: Guest) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Guest[]>([]);
  const [pending, startTransition] = useTransition();

  function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      setResults(await searchGuests(value));
    });
  }

  // The invitation's own paper and form: an ivory page, an olive label over a
  // plain field, and a list ruled with hairlines rather than a stack of cards.
  return (
    <div className="rise-in fixed inset-0 z-20 flex flex-col bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Meta>Find a guest</Meta>
            <h2 className="mt-3 font-display text-4xl leading-tight text-primary sm:text-5xl">Who is arriving?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="-mr-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl text-muted-foreground transition-colors duration-200 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            ×
          </button>
        </div>

        <label className="mt-8 block">
          <Meta as="span">Name or phone number</Meta>
          <input
            autoFocus
            type="text"
            inputMode="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            className="mt-2 h-14 w-full rounded-lg border border-border bg-surface px-4 text-lg text-foreground transition-colors duration-200 ease-out placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 focus:outline-none"
          />
        </label>

        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          {pending ? <p className="py-6 text-center text-muted-foreground">Searching…</p> : null}

          {!pending && query.trim().length >= 2 && results.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No match</p>
          ) : null}

          {results.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {results.map((guest) => (
                <li key={guest.token}>
                  <button
                    type="button"
                    onClick={() => onPick(guest)}
                    className="flex min-h-18 w-full items-center justify-between gap-4 px-2 py-4 text-left transition-colors duration-200 ease-out hover:bg-surface focus-visible:bg-surface focus-visible:outline-none active:bg-surface-soft"
                  >
                    <span>
                      <span className="block font-display text-2xl leading-snug text-foreground">{guest.name}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        Party of {guest.guests}
                        {guest.table ? ` · Table ${guest.table}` : ""}
                      </span>
                    </span>
                    {guest.boardedAt ? (
                      <Meta as="span" className="shrink-0">
                        Boarded
                      </Meta>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Button variant="outline" className="mt-6 w-full" onClick={onClose}>
          Back to scanning
        </Button>
      </div>
    </div>
  );
}
