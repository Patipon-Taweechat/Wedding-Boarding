type Variant = "primary" | "secondary" | "outline" | "quiet" | "danger";

// The invitation's button (wedding-invite/src/components/ui/Button.tsx):
// uppercase, wide tracking, a small radius — the letterpress reference. Two
// kiosk changes: never shorter than 56px (`min-h-14`), because this is tapped
// by a thumb at a door all evening, and a step up from `text-xs` so the label
// reads at arm's length on an iPad.
//
// Padding and text size live in the variant and size maps, never in `base`:
// two utilities for the same property in one class list are resolved by
// Tailwind's stylesheet order, not by which comes last in the string.
const base =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl py-3 text-center leading-snug font-medium tracking-[0.2em] uppercase transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<Variant, string> = {
  // Burgundy is the only call to action. One per view.
  primary:
    "border border-primary bg-primary px-8 text-primary-foreground hover:bg-primary-hover active:bg-primary-hover focus-visible:ring-ring disabled:hover:bg-primary",
  // Olive outline for the second action; burgundy never carries this one.
  secondary:
    "border border-secondary px-8 text-secondary-dark hover:bg-secondary/10 active:bg-secondary/20 focus-visible:ring-secondary disabled:hover:bg-transparent",
  // The page's own hairline with a burgundy label — an action that sits under
  // what it belongs to.
  outline:
    "border border-border px-8 text-primary hover:border-primary/40 hover:bg-primary/5 active:bg-primary/10 focus-visible:ring-ring disabled:hover:bg-transparent",
  quiet:
    "px-3 text-muted-foreground underline-offset-8 hover:text-foreground hover:underline focus-visible:ring-ring",
  // Letting in someone who said they could not come. An outline, not a fill:
  // a second solid red beside the burgundy would read as the way forward.
  danger:
    "border border-danger px-8 text-danger hover:bg-danger/10 active:bg-danger/15 focus-visible:ring-danger disabled:hover:bg-transparent",
};

/** "small" is for the quiet housekeeping links (Lock screen), not actions. */
const sizes = {
  regular: "text-sm",
  small: "text-xs",
} as const;

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: Variant;
  size?: keyof typeof sizes;
}

export function Button({
  variant = "primary",
  size = "regular",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
