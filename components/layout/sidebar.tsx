"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  UsersRound,
  FileSearch,
  Sparkles,
  Building2,
  BookOpen,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/research", label: "Research", icon: BookOpen },
  { href: "/objectives", label: "Objectives", icon: Target },
  { href: "/okrs", label: "OKRs", icon: Flag },
  { href: "/audience", label: "Audience builder", icon: UsersRound },
  { href: "/analyze", label: "Analyze artifact", icon: FileSearch },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r bg-surface/40 backdrop-blur">
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground inline-flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold tracking-tight">Profiler</span>
          <span className="text-[11px] text-muted-foreground">
            Audience intelligence
          </span>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 mt-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-4 py-4 text-[11px] text-muted-foreground border-t">
        <div className="font-medium text-foreground/80 mb-1">Prototype</div>
        Mock data · LLM-powered analysis · Phase 0–7 build complete
      </div>
    </aside>
  );
}
