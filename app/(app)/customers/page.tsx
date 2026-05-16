"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Building2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfilerStore } from "@/lib/store";

export default function CustomersPage() {
  const customers = useProfilerStore((s) => s.customers ?? {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const list = Object.values(customers).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Companies you&apos;re presenting to. Add them manually or trigger deep
            research to draft a profile from public sources.
          </p>
        </div>
        <Link href="/customers/new">
          <Button>
            <Plus className="w-3.5 h-3.5" />
            Add customer
          </Button>
        </Link>
      </header>

      {!hydrated ? null : list.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-1">No customers yet</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Add a company manually if you already know who you&apos;re pitching, or
            kick off a deep-research draft from a name.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link href="/customers/new">
              <Button>
                <Plus className="w-3.5 h-3.5" />
                Add customer
              </Button>
            </Link>
            <Link href="/customers/new?research=1">
              <Button variant="secondary">
                <Sparkles className="w-3.5 h-3.5" />
                Research a company
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="p-5 hover:border-primary/30 hover:shadow-sm transition-all h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    {c.industry && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.industry}
                        {c.size ? ` · ${c.size}` : ""}
                        {c.region ? ` · ${c.region}` : ""}
                      </div>
                    )}
                  </div>
                  <Badge tone={c.source === "research" ? "primary" : "subtle"}>
                    {c.source === "research" ? "Researched" : "Manual"}
                  </Badge>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-3 mt-2">
                  {c.summary || "No summary yet."}
                </p>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {c.tags.slice(0, 4).map((t) => (
                      <Badge key={t} tone="subtle" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
