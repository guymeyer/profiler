"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BriefInput, BriefResult } from "@/lib/llm/brief";

interface Props {
  subject: BriefInput["subject"];
  contextBlocks: BriefInput["contextBlocks"];
}

export function AutoBrief({ subject, contextBlocks }: Props) {
  const [brief, setBrief] = useState<BriefResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, contextBlocks }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Brief failed (${res.status}).`);
      }
      const { brief: result } = (await res.json()) as { brief: BriefResult };
      setBrief(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!brief) {
    return (
      <div>
        <p className="text-[13px] text-muted-foreground mb-3">
          One-paragraph TL;DR + key sections + open questions, compiled from
          everything linked to {subject.name}.
          {contextBlocks.length === 0 &&
            " Add linked artifacts to make this brief load-bearing."}
        </p>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Compiling…
            </>
          ) : (
            <>Brief me on {firstName(subject.name)}</>
          )}
        </Button>
        {error && (
          <div className="mt-2 text-[12px] text-danger">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[11px] text-muted-foreground">
          {brief.generatedBy === "mock" ? "mock" : (brief.model ?? "anthropic")}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      <div className="text-[14px] leading-relaxed text-foreground/90 border-l-2 border-foreground/30 pl-4 mb-5 italic">
        {brief.tldr}
      </div>
      <div className="space-y-5">
        {brief.sections.map((s, i) => (
          <div key={i}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              {s.heading}
            </div>
            <ul className="text-[13px] space-y-1 list-disc pl-5 text-foreground/90 leading-relaxed">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {brief.openQuestions.length > 0 && (
        <div className="mt-5 pt-3 border-t border-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
            Open questions
          </div>
          <ul className="text-[12px] space-y-1 list-disc pl-5 text-muted-foreground leading-relaxed">
            {brief.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
