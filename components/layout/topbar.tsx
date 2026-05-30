"use client";
import Link from "next/link";

// Notion-shaped topbar: barely there. Just the app name on mobile and a
// thin border-bottom. Page-level actions live in the PageHeader, not here.

export function Topbar() {
  return (
    <header className="h-11 border-b border-border bg-background sticky top-0 z-30 flex items-center justify-between px-5 md:px-8">
      <div className="md:hidden flex items-center gap-2">
        <Link
          href="/"
          className="text-[14px] font-semibold tracking-tight text-foreground"
        >
          Profiler
        </Link>
      </div>
      <div className="hidden md:block text-[12px] text-muted-foreground">
        Audience intelligence
      </div>
    </header>
  );
}
