"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useProfilerStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { INTERNAL_COMPANY_ID, type OKR } from "@/lib/types";

interface Props {
  companyId: string;
  addHref: string;
}

const STATUS_TONE: Record<NonNullable<OKR["status"]>, "subtle" | "neutral" | "success" | "warning"> = {
  "on-track": "success",
  "at-risk": "warning",
  "off-track": "warning",
  achieved: "neutral",
};

export function OKRsSection({ companyId, addHref }: Props) {
  // Filter inside the selector so unrelated OKR changes don't re-render.
  const okrs = useProfilerStore(
    useShallow((s) => {
      return Object.values(s.okrs ?? {}).filter((o) => {
        const owner = o.companyId ?? INTERNAL_COMPANY_ID;
        return owner === companyId;
      });
    }),
  );

  const sorted = useMemo(
    () =>
      [...okrs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [okrs],
  );

  return (
    <Section
      title="OKRs"
      subtitle={`${okrs.length} on record`}
      trailing={
        <Link href={addHref}>
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            New OKR
          </Button>
        </Link>
      }
    >
      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          No OKRs yet. Add what you know — either confirmed from
          partnership or your best inference from research.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((o) => (
            <li
              key={o.id}
              className="border border-border rounded-md p-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {o.level === "company" ? "Company" : "BU"} · {o.timeframe}
                    </span>
                    {o.status && (
                      <Badge tone={STATUS_TONE[o.status]} className="text-[10px]">
                        {o.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[14px] font-medium leading-snug">
                    {o.objective}
                  </div>
                  {o.keyResults.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground list-disc pl-5">
                      {o.keyResults.slice(0, 5).map((kr, i) => (
                        <li key={i}>{kr}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
