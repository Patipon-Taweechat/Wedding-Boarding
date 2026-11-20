interface MetaProps {
  children: React.ReactNode;
  /** Olive is the default; "muted" for captions. */
  tone?: "olive" | "muted";
  as?: "p" | "span" | "dt" | "dd";
  className?: string;
}

const tones = {
  olive: "text-secondary",
  muted: "text-muted-foreground",
} as const;

/** The invitation's meta type: small, uppercase, wide tracking. Labels,
 * dates, captions. */
export function Meta({ children, tone = "olive", as: Tag = "p", className = "" }: MetaProps) {
  return (
    <Tag className={`text-[0.6875rem] font-medium tracking-[0.25em] uppercase ${tones[tone]} ${className}`}>
      {children}
    </Tag>
  );
}
