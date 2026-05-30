"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Notion-shaped sidebar: text-only nav, no icons, no badges, minimal chrome.
// Active item is a subtle background highlight. Spacing is generous.

const NAV = [
  { href: "/", label: "Home" },
  { href: "/people", label: "People" },
  { href: "/customers", label: "Customers" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/objectives", label: "Objectives" },
  { href: "/okrs", label: "OKRs" },
  { href: "/audience", label: "Audience builder" },
  { href: "/analyze", label: "Analyze artifact" },
  { href: "/synthesis", label: "Synthesis" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-border bg-background">
      <div className="px-5 pt-6 pb-5">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-foreground"
        >
          Profiler
        </Link>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Audience intelligence
        </div>
      </div>
      <nav className="flex flex-col gap-px px-3 mt-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-2 py-1 rounded text-[13px] transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-5 py-4 text-[11px] text-muted-foreground border-t border-border">
        Prototype · audience intelligence
      </div>
    </aside>
  );
}
