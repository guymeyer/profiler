"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Presentation,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { renderDeckHtml } from "@/lib/llm/slide-deck-render";
import type { DeckDocument, MicrositeDocument, Slide } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ synthesisId: string; deckId: string }>;
}

export default function DeckViewerPage({ params }: Props) {
  const { synthesisId, deckId } = use(params);
  const router = useRouter();
  const documents = useProfilerStore((s) => s.documents ?? {});
  const deckRaw = documents[deckId];
  const deck: DeckDocument | undefined =
    deckRaw?.kind === "deck" ? deckRaw : undefined;
  const synthRaw = documents[synthesisId];
  const synthesis: MicrositeDocument | undefined =
    synthRaw?.kind === "microsite" ? synthRaw : undefined;
  const deleteDocument = useProfilerStore((s) => s.deleteDocument);
  const allPeople = useEffectivePeople();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(true);
  const [modifier, setModifier] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const saveDocument = useProfilerStore((s) => s.saveDocument);

  const slides = deck?.properties.slides ?? [];
  const total = slides.length;

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);
  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement | null)?.tagName ?? "",
        )
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "n") {
        setShowNotes((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const audiencePeople = useMemo(
    () =>
      deck
        ? allPeople.filter((p) => deck.properties.audience.personIds.includes(p.id))
        : [],
    [deck, allPeople],
  );
  const audienceObjectives = useMemo(
    () =>
      deck
        ? OBJECTIVES.filter((o) => deck.properties.audience.objectiveIds.includes(o.id))
        : [],
    [deck],
  );

  if (hydrated && !deck) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h1 className="text-xl font-semibold">Deck not found</h1>
        <div className="mt-6">
          <Link href={`/synthesis/${synthesisId}`}>
            <Button>Back to synthesis</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!hydrated || !deck) return null;

  const slide = slides[Math.max(0, Math.min(index, total - 1))];

  function handleDelete() {
    if (!deck) return;
    if (!confirm("Delete this deck?")) return;
    deleteDocument(deck.id);
    router.push(`/synthesis/${synthesisId}`);
  }

  function buildStandaloneHtml(): string {
    if (!deck) return "";
    return renderDeckHtml(deck);
  }

  function handleDownload() {
    if (!deck) return;
    const blob = new Blob([buildStandaloneHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePresentInTab() {
    if (!deck) return;
    const blob = new Blob([buildStandaloneHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRegenerate() {
    if (!deck || !synthesis) return;
    setRegenError(null);
    setRegenerating(true);
    try {
      const audiencePeople = allPeople.filter((p) =>
        deck.properties.audience.personIds.includes(p.id),
      );
      const audienceObjectives = OBJECTIVES.filter((o) =>
        deck.properties.audience.objectiveIds.includes(o.id),
      );
      const res = await fetch("/api/synthesis/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synthesis,
          audience: deck.properties.audience,
          audiencePeople,
          audienceObjectives,
          modifier: modifier.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Regeneration failed (${res.status}).`);
      }
      const { deck: next } = (await res.json()) as { deck: DeckDocument };
      // Preserve the deck id so this is an in-place update, not a new deck.
      const merged: DeckDocument = {
        ...next,
        id: deck.id,
        createdAt: deck.createdAt,
        updatedAt: new Date().toISOString(),
      };
      saveDocument(merged);
      setModifier("");
      setIndex(0);
    } catch (e) {
      setRegenError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <Link
          href={`/synthesis/${synthesisId}`}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {synthesis?.title ?? "Synthesis"}
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNotes((v) => !v)}
          >
            {showNotes ? "Hide notes" : "Show notes"}
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePresentInTab}>
            <ExternalLink className="w-3.5 h-3.5" />
            Present in tab
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <header className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Presentation className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">
            Deck
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{deck.title}</h1>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {audiencePeople.map((p) => (
            <Badge key={p.id} tone="subtle" className="text-[10px]">
              {p.name}
            </Badge>
          ))}
          {audienceObjectives.map((o) => (
            <Badge key={o.id} tone="neutral" className="text-[10px]">
              {o.title}
            </Badge>
          ))}
        </div>
      </header>

      <Card className="p-0 overflow-hidden bg-white">
        <div className="aspect-[16/9] flex flex-col p-10 md:p-14 relative">
          {slide && <SlideView slide={slide} index={index} total={total} />}
        </div>
      </Card>

      <div className="flex items-center justify-between mt-3 gap-3">
        <Button variant="secondary" size="sm" onClick={prev} disabled={index === 0}>
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </Button>
        <div className="text-xs text-muted-foreground">
          Slide {index + 1} / {total} · ← → keys to navigate · &ldquo;n&rdquo; toggles notes
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={next}
          disabled={index >= total - 1}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {showNotes && slide?.speakerNotes && (
        <Card className="p-4 mt-3 bg-amber-50/50 border-amber-200">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 mb-1.5">
            Speaker notes
          </div>
          <p className="text-sm text-amber-950 leading-relaxed">
            {slide.speakerNotes}
          </p>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-1">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index
                ? "w-6 bg-primary"
                : "w-3 bg-border hover:bg-muted-foreground",
            )}
            title={s.title}
          />
        ))}
      </div>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Regenerate this deck</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Same audience, same synthesis — different framing. The deck is
          replaced in place. For a different audience, start a{" "}
          <Link
            href={`/synthesis/${synthesisId}/decks/new`}
            className="text-primary hover:underline"
          >
            new deck
          </Link>
          .
        </p>
        <textarea
          value={modifier}
          onChange={(e) => setModifier(e.target.value)}
          placeholder='e.g. "Be more skeptical about evidence strength", "Lead with the funding ask", "Cut to 6 slides — execs only"'
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {regenError && (
          <div className="mt-2 text-sm text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
            {regenError}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SlideView({
  slide,
  index,
  total,
}: {
  slide: Slide;
  index: number;
  total: number;
}) {
  return (
    <>
      <div className="absolute top-5 right-6 text-xs text-muted-foreground tracking-wider">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {slide.kind === "title" ? (
        <div className="m-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">
            {slide.title}
          </h2>
          {slide.subtitle && (
            <p className="text-muted-foreground mt-4 text-lg">
              {slide.subtitle}
            </p>
          )}
        </div>
      ) : slide.kind === "quote" && slide.quote ? (
        <div className="m-auto max-w-3xl">
          <div className="text-5xl text-primary/30 mb-3 leading-none">
            &ldquo;
          </div>
          <blockquote className="text-2xl md:text-3xl font-medium leading-snug text-foreground">
            {slide.quote.text}
          </blockquote>
          {slide.quote.attribution && (
            <div className="mt-5 text-sm text-muted-foreground">
              — {slide.quote.attribution}
            </div>
          )}
        </div>
      ) : slide.kind === "sources" ? (
        <div className="m-auto max-w-4xl w-full">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Sources
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-5">
            {slide.title}
          </h3>
          <ul className="space-y-2 text-base text-foreground">
            {(slide.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-muted-foreground font-mono text-sm pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : slide.kind === "narrative" ? (
        <div className="m-auto max-w-3xl w-full">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {slide.subtitle ?? "Narrative"}
          </div>
          <h3 className="text-3xl font-semibold tracking-tight mb-5 leading-tight">
            {slide.title}
          </h3>
          {slide.body && (
            <p className="text-lg leading-relaxed text-foreground/90">
              {slide.body}
            </p>
          )}
        </div>
      ) : (
        // insight / implication / setup / decision — bulleted slides
        <div className="m-auto max-w-4xl w-full">
          <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">
            {slide.kind === "setup"
              ? "Setup"
              : slide.kind === "decision"
                ? "Decision"
                : slide.kind === "implication"
                  ? "Implication"
                  : "Insight"}
          </div>
          <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5 leading-tight">
            {slide.title}
          </h3>
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="space-y-3">
              {slide.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-lg text-foreground/90 leading-snug"
                >
                  <span className="text-primary mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          {slide.citations && slide.citations.length > 0 && (
            <div className="mt-6 text-xs text-muted-foreground">
              {slide.citations.map((c, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <em>{c}</em>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
