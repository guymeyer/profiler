"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Target, UsersRound } from "lucide-react";
import { OBJECTIVES } from "@/lib/data/objectives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProfilerStore } from "@/lib/store";

export default function ObjectivesPage() {
  const [openId, setOpenId] = useState<string | null>(OBJECTIVES[0]?.id ?? null);
  const selectedIds = useProfilerStore((s) => s.selectedObjectiveIds);
  const toggle = useProfilerStore((s) => s.toggleObjective);

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Objectives library
          </h1>
          <p className="text-muted-foreground mt-1">
            The outcomes you're trying to drive. Select objectives to factor
            into your audience strategy.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <Link href="/audience">
            <Button>
              <UsersRound className="w-3.5 h-3.5" />
              Build audience with {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "objective" : "objectives"}
            </Button>
          </Link>
        )}
      </header>

      <div className="space-y-3">
        {OBJECTIVES.map((o) => {
          const open = openId === o.id;
          const selected = selectedIds.includes(o.id);
          return (
            <Card
              key={o.id}
              className={cn(
                "transition-colors",
                selected && "border-primary/40 bg-primary/[0.02]",
              )}
            >
              <div className="flex items-start gap-4 p-5">
                <label className="flex items-center cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(o.id)}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                    aria-label={`Select ${o.title}`}
                  />
                </label>
                <button
                  onClick={() => setOpenId(open ? null : o.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-muted-foreground shrink-0" />
                        <h2 className="font-semibold tracking-tight">
                          {o.title}
                        </h2>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {o.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {o.tags.map((t) => (
                          <Badge key={t} tone="subtle">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                        open && "rotate-180",
                      )}
                    />
                  </div>
                </button>
              </div>

              {open && (
                <div className="px-5 pb-5 pl-[60px] grid grid-cols-1 md:grid-cols-3 gap-5 border-t pt-4 mt-1">
                  <Block title="Success criteria" items={o.successCriteria} />
                  <Block title="Common risks" items={o.risks} />
                  <Block
                    title="Recommended framing"
                    items={o.recommendedFraming}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="text-sm leading-relaxed text-foreground/90 flex gap-2"
          >
            <span className="text-muted-foreground mt-1.5 shrink-0">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
