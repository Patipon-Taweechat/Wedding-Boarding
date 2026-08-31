"use client";

import { useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";

interface ScannerProps {
  /** Called on every successful decode. The scanner is not paused
   * automatically — the caller pauses it once it decides the result is worth
   * acting on, via the `paused` prop. */
  onDecode: (text: string) => void;
  paused: boolean;
}

/**
 * The camera viewfinder. Wraps the `qr-scanner` library (a thin, dependency-free
 * wrapper around the browser's own camera + a Web Worker decoder) rather than
 * hand-rolling getUserMedia — it already handles iOS Safari's quirks around
 * `playsInline`, camera selection, and torch support.
 *
 * Requires a secure context (https, or localhost) — iOS Safari refuses camera
 * access to a plain-http page over the LAN. See the project README.
 */
export function Scanner({ onDecode, paused }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const onDecodeRef = useRef(onDecode);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let scanner: QrScannerType | null = null;

    import("qr-scanner").then(({ default: QrScanner }) => {
      if (cancelled) return;
      QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";

      scanner = new QrScanner(video, (result) => onDecodeRef.current(result.data), {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 8,
      });
      scannerRef.current = scanner;

      scanner
        .start()
        .then(() => !cancelled && setStatus("ready"))
        .catch((err: unknown) => {
          if (cancelled) return;
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Could not start the camera");
        });
    });

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || status !== "ready") return;
    if (paused) scanner.pause();
    else scanner.start();
  }, [paused, status]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foreground/90 px-6 text-center text-primary-foreground">
          <p className="font-display text-xl">Camera unavailable</p>
          <p className="text-sm text-primary-foreground/80">{errorMessage}</p>
          <p className="mt-2 text-xs text-primary-foreground/60">
            Check Settings → Safari → Camera, and that this page is loaded over https.
          </p>
        </div>
      ) : null}

      {status === "starting" ? (
        <div className="absolute inset-0 flex items-center justify-center text-primary-foreground/70">
          Starting camera…
        </div>
      ) : null}
    </div>
  );
}
