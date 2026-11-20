"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Meta } from "@/components/ui/Meta";
import { ditherForThermal } from "@/lib/dither";
import { Viewfinder, ViewfinderNotice } from "./Viewfinder";

/** One selfie, in the two forms the server needs. */
export interface CapturedPhoto {
  /** Colour JPEG — the keepsake copy saved on the laptop. */
  jpeg: string;
  /** 384 px wide, 1-bit dithered PNG — exactly the POS58's dot width. */
  print: string;
}

/** The POS58 burns 384 dots across its 48 mm print width (203 dpi). */
const PRINT_DOTS = 384;
const KEEPSAKE_PX = 720;
const COUNTDOWN_FROM = 3;

type Stage =
  | { name: "starting" }
  | { name: "live" }
  | { name: "countdown"; n: number }
  | { name: "review"; photo: CapturedPhoto }
  | { name: "error"; message: string };

/** What one round of the photo step says — set by GuestPanel for a guest on
 * their own, or one guest of a party in turn. */
export interface PhotoCopy {
  /** The line to the guest above the camera ("Smile 😊"). */
  heading: string;
  /** A small line over it — whose turn it is ("Guest 2 of 3"). */
  caption?: string;
  /** The burgundy action once the photo looks right ("Print 3 slips"). */
  doneLabel: string;
  /** The quiet way past the photo ("Skip photo and print"). */
  skipLabel: string;
}

/**
 * The selfie step after a guest boards: a mirrored front-camera preview, a
 * 3-2-1 countdown so the guest can pose without anyone touching the screen
 * mid-smile, then a review with Retake and the next step. Skipping leaves the
 * slip to print its eucalyptus placeholder instead.
 *
 * The scanner releases the front camera when it pauses (see Scanner.tsx), so
 * this opens its own stream and stops it on unmount. `pending` holds the
 * buttons while the photo just taken is uploading; `error` is why the last
 * one didn't.
 */
export function PhotoCapture({
  copy,
  pending = false,
  error,
  onDone,
}: {
  copy: PhotoCopy;
  pending?: boolean;
  error?: string;
  onDone: (photo: CapturedPhoto | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [stage, setStage] = useState<Stage>({ name: "starting" });
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const open = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
      : Promise.reject(new Error("This browser can't open the camera (is the page on https?)."));

    open
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        await video.play().catch(() => {});
        if (!cancelled) setStage({ name: "live" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not start the camera";
        setStage({ name: "error", message });
      });

    const pending = timers.current;
    return () => {
      cancelled = true;
      pending.forEach(clearTimeout);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStage({ name: "error", message: "The camera isn't ready yet." });
      return;
    }

    // Centre square crop, mirrored — so the photo matches the preview the
    // guest just posed in front of.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    const draw = (size: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
      return canvas;
    };

    const keepsake = draw(KEEPSAKE_PX);
    const forPrint = draw(PRINT_DOTS);
    ditherForThermal(forPrint);

    setFlash(true);
    timers.current.push(setTimeout(() => setFlash(false), 180));
    setStage({
      name: "review",
      photo: { jpeg: keepsake.toDataURL("image/jpeg", 0.82), print: forPrint.toDataURL("image/png") },
    });
  }, []);

  const startCountdown = useCallback(() => {
    for (let i = 0; i < COUNTDOWN_FROM; i++) {
      timers.current.push(setTimeout(() => setStage({ name: "countdown", n: COUNTDOWN_FROM - i }), i * 1000));
    }
    timers.current.push(setTimeout(capture, COUNTDOWN_FROM * 1000));
  }, [capture]);

  // On the ticket, under its "Boarding photo" header: a line to the guest in
  // the invitation's display italic, the same square window the scanner
  // looked through, and the one burgundy action under it.
  return (
    <div className="rise-in text-center">
      {copy.caption ? <Meta>{copy.caption}</Meta> : null}
      <h2 className={`font-display text-[2.75rem] leading-tight text-primary italic ${copy.caption ? "mt-2" : ""}`}>
        {copy.heading}
      </h2>

      <Viewfinder className="mt-5">
        <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline autoPlay />

        {stage.name === "review" ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimise
          <img src={stage.photo.jpeg} alt="Your boarding photo" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}

        {stage.name === "countdown" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span key={stage.n} className="rise-in font-display text-9xl text-primary-foreground drop-shadow-lg">
              {stage.n}
            </span>
          </div>
        ) : null}

        {stage.name === "starting" ? <ViewfinderNotice>Starting camera…</ViewfinderNotice> : null}

        {stage.name === "error" ? <ViewfinderNotice title="Camera unavailable">{stage.message}</ViewfinderNotice> : null}

        {flash ? <div className="absolute inset-0 bg-pass" /> : null}
      </Viewfinder>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {stage.name === "review" ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" disabled={pending} onClick={() => setStage({ name: "live" })}>
            Retake
          </Button>
          <Button disabled={pending} onClick={() => onDone(stage.photo)}>
            {pending ? "Saving…" : copy.doneLabel}
          </Button>
        </div>
      ) : (
        <Button className="mt-5 w-full" disabled={stage.name !== "live"} onClick={startCountdown}>
          {stage.name === "countdown" ? "Get ready…" : "Take photo"}
        </Button>
      )}

      <Button
        variant="quiet"
        className="mx-auto mt-2"
        disabled={stage.name === "countdown" || pending}
        onClick={() => onDone(null)}
      >
        {copy.skipLabel}
      </Button>
    </div>
  );
}
