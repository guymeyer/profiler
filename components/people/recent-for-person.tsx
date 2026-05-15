"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfilerStore } from "@/lib/store";

export function RecentForPerson({ personId }: { personId: string }) {
  const recents = useProfilerStore((s) => s.recentResults);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated) return null;
  const matches = recents.filter((r) => r.personIds.includes(personId)).slice(0, 5);
  if (matches.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        Recent analyses
      </div>
      <ul className="space-y-1.5">
        {matches.map((r) => (
          <li key={r.id}>
            <Link
              href={`/results/${r.id}`}
              className="block text-xs hover:bg-accent/60 rounded-md px-2 py-1.5 -mx-2 transition-colors"
            >
              <div className="font-medium text-foreground truncate">{r.title}</div>
              <div className="text-[11px] text-muted-foreground">
                Fit {r.fitScore}/100 ·{" "}
                {new Date(r.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
