type Variant = "primary" | "outline" | "quiet" | "danger";

const base =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold tracking-wide transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "border border-primary bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
  outline:
    "border border-border bg-surface text-foreground hover:border-primary/40 focus-visible:ring-ring focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
  quiet:
    "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40",
  danger:
    "border border-danger bg-danger text-danger-foreground hover:opacity-90 focus-visible:ring-danger focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40",
};

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: Variant;
}

/** Large touch targets throughout — this is tapped by a thumb, at a door,
 * often in a hurry. Never smaller than the 56px `min-h-14` default. */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
