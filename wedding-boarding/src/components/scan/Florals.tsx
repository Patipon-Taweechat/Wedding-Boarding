import Image from "next/image";

/**
 * The invitation cover's cut-out florals (wedding-invite PassportCollage),
 * gathered at two opposite corners of the ticket: greenery and hydrangea
 * behind its top-right corner with one anthurium laid over it, and a blush
 * bouquet behind the bottom-left.
 *
 * Every position is a share of the ticket's width (`cqw` — the stage is the
 * container), so the arrangement keeps its shape from an iPad mini to a
 * laptop. The pieces sit beside the ticket, not over it: only the front
 * anthurium overlaps, and by less than the ticket's own padding, so nothing
 * printed on the pass or tapped on it is ever covered.
 */
const florals = [
  // --- behind the top-right corner ---------------------------------------
  {
    id: "eucalyptus-arc",
    src: "/florals/eucalyptus-arc.webp",
    w: 700,
    h: 577,
    style: "-right-[27cqw] top-[1cqw] w-[38cqw] rotate-[64deg] z-0",
    delay: "[animation-delay:150ms]",
  },
  {
    id: "hydrangea",
    src: "/florals/hydrangea.webp",
    w: 700,
    h: 714,
    style: "-right-[15cqw] -top-[4cqw] w-[25cqw] z-0",
    delay: "[animation-delay:300ms]",
  },
  // Over the corner, in front, as on the cover — overlapping the header band
  // by less than its padding, so the label beside it stays clear.
  {
    id: "anthurium",
    src: "/florals/anthurium.webp",
    w: 672,
    h: 615,
    style: "-right-[19cqw] -top-[6cqw] w-[23cqw] rotate-[10deg] z-20",
    delay: "[animation-delay:600ms]",
  },

  // --- behind the bottom-left corner -------------------------------------
  {
    id: "white-spray",
    src: "/florals/white-spray.webp",
    w: 544,
    h: 900,
    style: "-left-[19cqw] bottom-[12cqw] w-[18cqw] -rotate-[18deg] z-0",
    delay: "[animation-delay:250ms]",
  },
  {
    id: "eucalyptus",
    src: "/florals/eucalyptus.webp",
    w: 672,
    h: 696,
    style: "-left-[27cqw] bottom-[1cqw] w-[32cqw] -rotate-[10deg] z-0",
    delay: "[animation-delay:400ms]",
  },
  {
    id: "blush-cluster",
    src: "/florals/blush-cluster.webp",
    w: 900,
    h: 836,
    style: "-left-[17cqw] -bottom-[5cqw] w-[28cqw] z-0",
    delay: "[animation-delay:500ms]",
  },
] as const;

export function Florals() {
  return florals.map((f) => (
    <Image
      key={f.id}
      src={f.src}
      alt=""
      width={f.w}
      height={f.h}
      sizes="240px"
      priority
      aria-hidden="true"
      className={`bloom-in pointer-events-none absolute h-auto max-w-none select-none ${f.style} ${f.delay}`}
    />
  ));
}
