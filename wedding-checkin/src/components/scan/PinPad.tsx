"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";

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

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-8">
      <div className="flex gap-3" aria-live="polite">
        {Array.from({ length: Math.max(pin.length, 4) }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border ${
              i < pin.length ? "border-primary bg-primary" : "border-border bg-transparent"
            } ${error ? "border-danger" : ""}`}
          />
        ))}
      </div>

      {error ? (
        <Meta tone="muted" className="!text-danger -mt-4">
          Wrong PIN — try again
        </Meta>
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
              className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface font-display text-2xl text-foreground transition-colors active:bg-surface-soft disabled:opacity-50"
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
