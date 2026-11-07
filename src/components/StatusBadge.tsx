import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeKind = "mastered" | "live" | "reference" | "notyet";

const STYLE: Record<BadgeKind, string> = {
  mastered: "bg-brand-2 text-brand-2-foreground border-brand-2",
  live: "bg-match-bg text-match border-match",
  reference: "bg-reference-bg text-reference border-reference border-dashed",
  notyet: "bg-notyet-bg text-notyet border-notyet",
};
const ICON: Record<BadgeKind, string> = { mastered: "✓", live: "●", reference: "○", notyet: "!" };

/**
 * A status pill built on the shadcn Badge. The meaning is always in the text, with an icon, never colour alone.
 *
 * Props
 * - kind: "mastered" | "live" | "reference" | "notyet".
 * - children: the label text, e.g. "Mastered", "Reference only".
 */
export function StatusBadge({ kind, children }: { kind: BadgeKind; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[13px] font-semibold", STYLE[kind])}>
      <span aria-hidden="true">{ICON[kind]}</span>
      {children}
    </Badge>
  );
}
