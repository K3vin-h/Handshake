import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusMark, type MarkState } from "./StatusMark";

export type BadgeKind = MarkState;

const STYLE: Record<BadgeKind, string> = {
  mastered: "bg-brand-2 text-brand-2-foreground border-brand-2",
  practicing: "bg-card text-foreground border-brand-2",
  "not-started": "bg-card text-muted-foreground border-border-strong",
  "reference-only": "bg-reference-bg text-reference border-reference border-dashed",
};

/**
 * A status pill on the shadcn Badge: StatusMark shape + your text. Never colour alone.
 *
 * Props
 * - kind: "mastered" | "practicing" | "not-started" | "reference-only".
 * - children: the label text, e.g. "Mastered", "Practicing: 2 of 3 in a row". Use MARK_LABEL for the plain names.
 */
export function StatusBadge({ kind, children }: { kind: BadgeKind; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-0.5 text-[13px] font-semibold", STYLE[kind])}>
      <StatusMark state={kind} size={14} />
      {children}
    </Badge>
  );
}
