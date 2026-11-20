/**
 * The camera's window on the pass — the QR scanner and the selfie step both
 * look through it, so the two read as the same frame. Square, the pass's
 * small radius, and dark until the picture arrives.
 */
export function Viewfinder({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-secondary-night ring-1 ring-pass-border ${className}`}
    >
      {children}
    </div>
  );
}

/** A message laid over the viewfinder while the camera starts, fails, or a
 * pass is being looked up. */
export function ViewfinderNotice({ title, children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-secondary-night/90 px-8 text-center text-primary-foreground">
      {title ? <p className="font-display text-3xl">{title}</p> : null}
      {children ? <div className="text-base leading-relaxed text-primary-foreground/80">{children}</div> : null}
    </div>
  );
}
