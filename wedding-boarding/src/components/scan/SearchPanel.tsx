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

  return (
    <div className="pop-in fixed inset-0 z-20 flex flex-col bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <Meta>Find a guest</Meta>
          <button type="button" onClick={onClose} className="text-2xl text-muted-foreground">
            ×
          </button>
        </div>

        <input
          autoFocus
          type="text"
          inputMode="text"
          placeholder="Name or phone number"
          value={query}
          onChange={(e) => search(e.target.value)}
          className="mt-4 h-14 w-full rounded-xl border border-border bg-surface px-4 text-lg text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {pending ? <p className="py-4 text-center text-muted-foreground">Searching…</p> : null}

          {!pending && query.trim().length >= 2 && results.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">No match</p>
          ) : null}

          {results.map((guest) => (
            <button
              key={guest.token}
              type="button"
              onClick={() => onPick(guest)}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-4 text-left"
            >
              <span>
                <span className="block text-base font-medium text-foreground">{guest.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Party of {guest.guests}
                  {guest.table ? ` · Table ${guest.table}` : ""}
                </span>
              </span>
              {guest.boardedAt ? (
                <span className="text-xs font-medium tracking-wide text-secondary-dark uppercase">In</span>
              ) : null}
            </button>
          ))}
        </div>

        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>
          Back to scanning
        </Button>
      </div>
    </div>
  );
}
