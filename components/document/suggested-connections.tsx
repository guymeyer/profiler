"use client";
import Link from "next/link";
import { Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hrefForEntity } from "@/components/rich-editor/mention-list";
import type { DetectedMention } from "@/lib/auto-detect-mentions";

// Surface auto-detected names found in the body that aren't yet linked
// to the document. Each row offers a one-click action:
//   - "alreadyLinked: true" rows have nothing to add — they just show a
//     hint that the user could replace the raw text with a chip later.
//   - "alreadyLinked: false" person/customer rows offer "Link" to add the
//     id to the matching linked-* array on the document.
//   - Document rows offer "Open" (raw text matches aren't auto-promoted
//     to chips — we can't safely edit the editor's body from here).

interface Props {
  suggestions: DetectedMention[];
  onLinkPerson?: (id: string) => void;
  onLinkCustomer?: (id: string) => void;
  disabled?: boolean;
}

const KIND_LABEL: Record<DetectedMention["kind"], string> = {
  person: "Person",
  customer: "Customer",
  document: "Document",
};

export function SuggestedConnections({
  suggestions,
  onLinkPerson,
  onLinkCustomer,
  disabled,
}: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <div
          key={`${s.kind}-${s.id}`}
          className="flex items-start gap-3 border border-border rounded-md p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={hrefForEntity(
                  s.kind === "document" ? "document" : s.kind,
                  s.id,
                )}
                className="text-[13px] font-medium hover:underline"
              >
                {s.label}
              </Link>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {KIND_LABEL[s.kind]}
              </span>
              {s.alreadyLinked && (
                <span className="text-[10px] text-muted-foreground italic">
                  already linked
                </span>
              )}
            </div>
            <div className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
              {s.snippet}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {!s.alreadyLinked && s.kind === "person" && onLinkPerson && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onLinkPerson(s.id)}
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                Link
              </Button>
            )}
            {!s.alreadyLinked && s.kind === "customer" && onLinkCustomer && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onLinkCustomer(s.id)}
                disabled={disabled}
              >
                <Plus className="w-3 h-3" />
                Link
              </Button>
            )}
            {s.kind === "document" && (
              <Link href={`/documents/${s.id}`}>
                <Button size="sm" variant="ghost">
                  <Link2 className="w-3 h-3" />
                  Open
                </Button>
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
