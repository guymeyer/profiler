"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useProfilerStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { INTERNAL_COMPANY_ID } from "@/lib/types";

interface Props {
  companyId: string;
  addHref: string;
}

export function BusinessUnitsSection({ companyId, addHref }: Props) {
  const bus = useProfilerStore(
    useShallow((s) => {
      return Object.values(s.businessUnits ?? {}).filter((b) => {
        const owner = b.companyId ?? INTERNAL_COMPANY_ID;
        return owner === companyId;
      });
    }),
  );

  const sorted = useMemo(
    () => [...bus].sort((a, b) => a.name.localeCompare(b.name)),
    [bus],
  );

  return (
    <Section
      title="Business units"
      subtitle={`${bus.length} on record`}
      trailing={
        <Link href={addHref}>
          <Button size="sm">
            <Plus className="w-3.5 h-3.5" />
            New BU
          </Button>
        </Link>
      }
    >
      {sorted.length === 0 ? (
        <p className="text-[13px] text-muted-foreground italic">
          No business units yet. Add the org structure as you map it.
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {sorted.map((b) => (
            <li key={b.id}>
              <Link
                href={`/business-units/${b.id}`}
                className="flex items-start gap-3 border border-border rounded-md p-3 hover:bg-accent/40 transition-colors"
              >
                <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium leading-tight">
                    {b.name}
                  </div>
                  {b.description && (
                    <div className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
                      {b.description}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
