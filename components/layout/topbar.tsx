"use client";
import Link from "next/link";
import { FileSearch, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="h-14 border-b bg-surface/60 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 md:px-8">
      <div className="md:hidden flex items-center gap-2">
        <Link href="/" className="font-semibold tracking-tight">
          Profiler
        </Link>
      </div>
      <div className="hidden md:block text-sm text-muted-foreground">
        Helping you present work to the people who decide.
      </div>
      <div className="flex items-center gap-2">
        <Link href="/audience">
          <Button variant="secondary" size="sm">
            <UsersRound className="w-3.5 h-3.5" />
            Audience
          </Button>
        </Link>
        <Link href="/analyze">
          <Button size="sm">
            <FileSearch className="w-3.5 h-3.5" />
            Analyze artifact
          </Button>
        </Link>
      </div>
    </header>
  );
}
