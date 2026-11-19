interface MetaProps {
  children: React.ReactNode;
  tone?: "olive" | "muted" | "light";
  as?: "p" | "span" | "dt" | "dd";
  className?: string;
}

const tones = {
  olive: "text-secondary",
  muted: "text-muted-foreground",
  light: "text-primary-foreground/70",
} as const;

/** Small, uppercase, wide tracking. Labels and captions. */
export function Meta({ children, tone = "olive", as: Tag = "p", className = "" }: MetaProps) {
  return (
    <Tag className={`text-[0.6875rem] font-semibold tracking-[0.2em] uppercase ${tones[tone]} ${className}`}>
      {children}
    </Tag>
  );
}
