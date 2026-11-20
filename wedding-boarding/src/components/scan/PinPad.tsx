"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

export function PinPad({ next }: { next: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function press(key: (typeof DIGITS)[number]) {
    if (pending) return;
    setError(false);
    if (key === "") return;
    if (key === "back") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => (p.length >= 8 ? p : p + key));
  }

  function submit() {
    if (!pin) return;
    startTransition(async () => {
      const result = await login(pin);
      if (result.ok) {
        router.replace(next);
        router.refresh();
      } else {
        setError(true);
        setPin("");
      }
    });
  }

  // On the pass's white stock, like the ticket it unlocks: burgundy dots for
  // the digits entered, and keys drawn as the invitation's square number
  // buttons — a hairline, the display face for the figures.
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-8">
      <div className="flex gap-3" aria-live="polite" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(pin.length, 4) }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border ${
              error ? "border-danger" : i < pin.length ? "border-primary bg-primary" : "border-muted-foreground/50"
            }`}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="-mt-4 text-[0.6875rem] font-medium tracking-[0.25em] text-danger uppercase">
          Wrong PIN — try again
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-3 no-select">
        {DIGITS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={pending}
              aria-label={key === "back" ? "Delete" : undefined}
              className="flex h-16 w-20 items-center justify-center rounded-lg border border-pass-border bg-pass font-display text-3xl text-foreground lining-nums transition-colors duration-200 ease-out hover:border-secondary active:bg-pass-band focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-pass focus-visible:outline-none disabled:opacity-50"
            >
              {key === "back" ? "⌫" : key}
            </button>
          ),
        )}
      </div>

      <Button className="w-full" disabled={!pin || pending} onClick={submit}>
        {pending ? "Checking…" : "Enter"}
      </Button>
    </div>
  );
}
