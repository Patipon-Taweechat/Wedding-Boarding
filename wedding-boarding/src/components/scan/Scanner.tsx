"use client";

import { useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import { Viewfinder, ViewfinderNotice } from "./Viewfinder";

interface ScannerProps {
  /** Called on every successful decode. The scanner is not paused
   * automatically — the caller pauses it once it decides the result is worth
   * acting on, via the `paused` prop. */
  onDecode: (text: string) => void;
  paused: boolean;
  /** Laid over the (paused) picture — e.g. while a pass is looked up. */
  notice?: string;
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
export function Scanner({ onDecode, paused, notice }: ScannerProps) {
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
        // Front camera: the iPad stands at the door facing the guests, who
        // hold their pass up to the screen. qr-scanner mirrors the preview
        // for a user-facing camera, so it reads like a mirror.
        preferredCamera: "user",
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
          // qr-scanner rejects with plain strings (e.g. "Camera not found."),
          // not Errors — show those too, so staff see the real reason.
          const detail = err instanceof Error ? err.message : typeof err === "string" ? err : "";
          const insecure = typeof window !== "undefined" && !window.isSecureContext;
          setErrorMessage(
            insecure
              ? "This page is on plain http — open the https:// address instead."
              : detail || "Could not start the camera",
          );
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
    // Release the camera right away (not after qr-scanner's 300ms grace), so
    // the selfie step can open the same front camera without a clash on iOS.
    if (paused) scanner.pause(true);
    else scanner.start();
  }, [paused, status]);

  return (
    <Viewfinder>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

      {status === "error" ? (
        <ViewfinderNotice title="Camera unavailable">
          <p>{errorMessage}</p>
          <p className="mt-2 text-sm text-primary-foreground/60">
            Check Settings → Safari → Camera, and that this page is loaded over https.
          </p>
        </ViewfinderNotice>
      ) : null}

      {status === "starting" ? <ViewfinderNotice>Starting camera…</ViewfinderNotice> : null}

      {notice && status !== "error" ? <ViewfinderNotice title={notice} /> : null}
    </Viewfinder>
  );
}
