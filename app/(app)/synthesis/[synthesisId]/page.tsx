"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  Presentation,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useProfilerStore } from "@/lib/store";
import {
  SYNTHESIS_LENSES,
  SYNTHESIS_LENS_BY_ID,
  type DeckDocument,
  type MicrositeDocument,
  type PersonLensDepth,
  type PersonLensSection,
  type SynthesisLensId,
  type SynthesisLensSection,
} from "@/lib/types";
import { renderSynthesisHtml } from "@/lib/llm/synthesize-render";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { PeopleRecommendations } from "@/components/people-recommendations";
import { PageHeader } from "@/components/ui/page-header";
import {
  buildHmwPrototypePrompt,
  buildSynthesisPrototypePrompt,
} from "@/lib/prototype-prompt";
import { cn } from "@/lib/utils";

export default function SynthesisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = (params?.synthesisId as string) ?? "";

  const documents = useProfilerStore((s) => s.documents ?? {});
  const raw = documents[id];
  const synthesis: MicrositeDocument | undefined =
    raw?.kind === "microsite" ? raw : undefined;
  const saveDocument = useProfilerStore((s) => s.saveDocument);
  const deleteDocument = useProfilerStore((s) => s.deleteDocument);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [modifier, setModifier] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const reports = useMemo(
    () =>
      synthesis
        ? synthesis.properties.researchIds
            .map((rid) => documents[rid])
            .filter((d) => d?.kind === "research")
        : [],
    [synthesis, documents],
  );

  // Lenses actually present in this synthesis (LLM may omit some).
  const availableLenses = useMemo(() => {
    if (!synthesis?.properties.outline?.lenses) return [];
    return SYNTHESIS_LENSES.filter((l) => synthesis.properties.outline.lenses[l.id]);
  }, [synthesis]);

  const peopleLenses: PersonLensSection[] = synthesis?.properties.outline?.people ?? [];

  // URL lens param can be either a functional lens id ("product-design") or
  // a person lens id ("person-<personId>"). Treat them as siblings.
  const lensFromUrl = searchParams.get("lens");
  const depthFromUrl = (searchParams.get("depth") ?? "brief") as PersonLensDepth;

  const isPersonLens = !!lensFromUrl?.startsWith("person-");
  const personLensId = isPersonLens
    ? (lensFromUrl as string).slice("person-".length)
    : null;

  const activePersonLens: PersonLensSection | undefined = personLensId
    ? peopleLenses.find((p) => p.personId === personLensId)
    : undefined;

  const activeFunctionalLens: SynthesisLensId | null =
    !isPersonLens &&
    lensFromUrl &&
    availableLenses.some((l) => l.id === lensFromUrl)
      ? (lensFromUrl as SynthesisLensId)
      : isPersonLens && !activePersonLens
        ? // Person lens specified but not found — fall through to functional default.
          (availableLenses[0]?.id ?? "general")
        : !isPersonLens
          ? (availableLenses[0]?.id ?? "general")
          : null;

  const activeFunctionalSection: SynthesisLensSection | undefined =
    activeFunctionalLens
      ? synthesis?.properties.outline?.lenses?.[activeFunctionalLens]
      : undefined;

  // For depth-toggle rendering when a person lens is active.
  const activePersonDepth: PersonLensDepth =
    depthFromUrl === "exec" ? "exec" : "brief";

  if (hydrated && !synthesis) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className="text-xl font-semibold">Synthesis not found</h1>
        <p className="text-muted-foreground mt-2">
          It may have been deleted, or this link came from another browser.
        </p>
        <Link
          href="/synthesis"
          className="text-primary hover:underline inline-flex items-center gap-1 mt-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All syntheses
        </Link>
      </div>
    );
  }

  if (!hydrated || !synthesis) return null;

  async function handleRegenerate() {
    if (!synthesis) return;
    setError(null);
    setRegenerating(true);
    try {
      const selected = synthesis.properties.researchIds
        .map((rid) => documents[rid])
        .filter((d) => d?.kind === "research");
      const res = await fetch("/api/synthesis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: synthesis.title,
          research: selected,
          modifier: modifier.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Regeneration failed (${res.status}).`);
      }
      const { synthesis: next } = (await res.json()) as { synthesis: MicrositeDocument };
      const merged: MicrositeDocument = {
        ...next,
        id: synthesis.id,
        createdAt: synthesis.createdAt,
        updatedAt: new Date().toISOString(),
      };
      saveDocument(merged);
      setModifier("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  function handleDelete() {
    if (!synthesis) return;
    if (!confirm("Delete this synthesis?")) return;
    deleteDocument(synthesis.id);
    router.push("/synthesis");
  }

  // Standalone HTML for download / open-in-tab. Re-render with the currently
  // selected lens as the default so the downloaded artifact opens on whatever
  // the user was viewing.
  function buildStandaloneHtml(): string {
    if (!synthesis?.properties.outline) return synthesis?.properties.html ?? "";
    return renderSynthesisHtml(synthesis.properties.outline, {
      defaultLens: activePersonLens
        ? (`person-${activePersonLens.personId}` as const)
        : (activeFunctionalLens ?? "general"),
      defaultDepth: activePersonDepth,
    });
  }

  function handleDownload() {
    if (!synthesis) return;
    const blob = new Blob([buildStandaloneHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${synthesis.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleOpenInTab() {
    if (!synthesis) return;
    const blob = new Blob([buildStandaloneHtml()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleCopyLensLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      // Fallback: surface a prompt the user can copy from
      window.prompt("Copy this URL", window.location.href);
    }
  }

  const lensMeta = activeFunctionalLens
    ? SYNTHESIS_LENS_BY_ID[activeFunctionalLens]
    : undefined;

  return (
    <div>
      <Link
        href="/synthesis"
        className="text-[12px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ArrowLeft className="w-3 h-3" />
        Syntheses
      </Link>

      <PageHeader
        eyebrow="Multi-lens synthesis"
        title={synthesis.title}
        meta={
          <>
            {synthesis.updatedAt
              ? `Updated ${new Date(synthesis.updatedAt).toLocaleString()}`
              : `Created ${new Date(synthesis.createdAt).toLocaleString()}`}
            {" · "}
            {synthesis.properties.generatedBy === "mock"
              ? "mock"
              : (synthesis.properties.model ?? "anthropic")}
            {" · "}
            {reports.length} source{reports.length === 1 ? "" : "s"}
          </>
        }
        actions={
          <>
            <CopyPromptButton
              getPrompt={() => buildSynthesisPrototypePrompt(synthesis)}
            />
            <Button variant="secondary" onClick={handleCopyLensLink}>
              {linkCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Link copied
                </>
              ) : (
                "Copy lens link"
              )}
            </Button>
            <Button variant="secondary" onClick={handleOpenInTab}>
              Open standalone
            </Button>
            <Button variant="secondary" onClick={handleDownload}>
              Download
            </Button>
            <Button variant="ghost" onClick={handleDelete}>
              Delete
            </Button>
          </>
        }
      />

      {!synthesis.properties.outline ? (
        <div className="border border-dashed border-border rounded-md p-10 text-center text-[14px]">
          <div className="font-semibold text-foreground mb-1">
            This synthesis is on an older schema.
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Delete it and regenerate to get lens routing and HMW questions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-6 items-start">
          {/* Lens sidebar */}
          <aside className="lg:sticky lg:top-20">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-2 py-1 mb-1">
                Read this for · function
              </div>
              <nav className="flex flex-col">
                {availableLenses.map((l) => {
                  const active =
                    !isPersonLens && l.id === activeFunctionalLens;
                  return (
                    <Link
                      key={l.id}
                      href={`/synthesis/${synthesis.id}?lens=${l.id}`}
                      replace
                      scroll={false}
                      className={cn(
                        "flex flex-col gap-0.5 px-2.5 py-2 rounded-md transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                      )}
                    >
                      <span
                        className={cn(
                          "text-sm leading-tight",
                          active && "font-semibold",
                        )}
                      >
                        {l.name}
                      </span>
                      <span className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
                        {l.brief}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {peopleLenses.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-2 py-1 mt-3 mb-1 border-t pt-3">
                    Read this for · person
                  </div>
                  <nav className="flex flex-col">
                    {peopleLenses.map((pl) => {
                      const active =
                        isPersonLens && pl.personId === personLensId;
                      return (
                        <Link
                          key={pl.personId}
                          href={`/synthesis/${synthesis.id}?lens=person-${pl.personId}&depth=${activePersonDepth}`}
                          replace
                          scroll={false}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors",
                            active
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                          )}
                        >
                          <Avatar name={pl.personName} size={26} />
                          <span
                            className={cn(
                              "text-sm leading-tight truncate",
                              active && "font-semibold",
                            )}
                          >
                            {pl.personName}
                          </span>
                        </Link>
                      );
                    })}
                  </nav>
                </>
              )}
            </Card>
          </aside>

          {/* Microsite content */}
          <main className="min-w-0">
            <Card className="p-6 md:p-8">
              {activePersonLens ? (
                <PersonLensContent
                  outline={synthesis.properties.outline}
                  synthesis={synthesis}
                  personLens={activePersonLens}
                  depth={activePersonDepth}
                  synthesisId={synthesis.id}
                />
              ) : (
                <SyntheisMicrositeContent
                  synthesis={synthesis}
                  outline={synthesis.properties.outline}
                  activeLens={activeFunctionalLens ?? "general"}
                  section={activeFunctionalSection}
                />
              )}
            </Card>
          </main>

          {/* Right rail: people + decks + regenerate */}
          <aside className="lg:sticky lg:top-20 flex flex-col gap-4">
            <SynthesisPeopleRecommendations synthesisId={synthesis.id} />

            <DecksCard synthesisId={synthesis.id} />

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">Regenerate</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Same reports, all lenses, different framing.
              </p>
              <textarea
                value={modifier}
                onChange={(e) => setModifier(e.target.value)}
                placeholder='e.g. "Lead with accessibility implications" or "Be more skeptical about evidence strength"'
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {error && (
                <div className="mt-2 text-sm text-danger border border-danger/30 bg-danger/5 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <Button
                className="w-full mt-3"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerate all lenses
                  </>
                )}
              </Button>
              {synthesis.properties.modifier && (
                <div className="mt-3 pt-3 border-t text-xs">
                  <div className="text-muted-foreground mb-1">Last modifier</div>
                  <div className="italic">{synthesis.properties.modifier}</div>
                </div>
              )}
            </Card>

            {activePersonLens ? (
              <Card className="p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                  Viewing person lens
                </div>
                <div className="font-semibold mb-1">
                  {activePersonLens.personName}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Microscopic read of the corpus through this person&apos;s
                  profile. Toggle Full brief / Executive summary above the
                  content.
                </p>
              </Card>
            ) : (
              lensMeta && (
                <Card className="p-5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
                    Viewing lens
                  </div>
                  <div className="font-semibold mb-1">{lensMeta.name}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {lensMeta.guidance}
                  </p>
                </Card>
              )
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function SyntheisMicrositeContent({
  synthesis,
  outline,
  activeLens,
  section,
  hideOverview,
}: {
  synthesis: MicrositeDocument;
  outline: MicrositeDocument["properties"]["outline"];
  activeLens: SynthesisLensId;
  section: SynthesisLensSection | undefined;
  hideOverview?: boolean;
}) {
  const lens = SYNTHESIS_LENS_BY_ID[activeLens];
  return (
    <article className="prose-microsite">
      {!hideOverview && (
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-primary font-medium mb-2">
            Research synthesis · {lens.name} lens
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
            {outline.title}
          </h2>
        </header>
      )}

      {!hideOverview && (
        <Section id="overview" title="Overview">
          <p className="text-foreground/90 leading-relaxed">
            {outline.overview}
          </p>
        </Section>
      )}

      {section && (
        <>
          <Section id="for-this-lens" title="For this lens">
            <p className="text-foreground/90 leading-relaxed">
              {section.summary}
            </p>
            {section.hmwQuestions && section.hmwQuestions.length > 0 && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  How might we
                </div>
                <ul className="space-y-2">
                  {section.hmwQuestions.map((q, i) => (
                    <li
                      key={i}
                      className="flex gap-3 items-start rounded-md border border-border/70 bg-accent/30 px-3.5 py-2.5 text-sm leading-snug"
                    >
                      <span className="text-primary font-mono text-[11px] mt-1">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-foreground/90 flex-1">{q}</span>
                      <CopyPromptButton
                        getPrompt={() =>
                          buildHmwPrototypePrompt(synthesis, q)
                        }
                        iconOnly
                        ariaLabel="Copy prototype prompt for this HMW"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section id="insights" title="Insights">
            {section.insights.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No insights for this lens.
              </p>
            ) : (
              <div className="space-y-4">
                {section.insights.map((i, idx) => (
                  <div
                    key={idx}
                    className="border-t border-border pt-4 first:border-t-0 first:pt-0"
                  >
                    <h4 className="font-semibold mb-1.5">{i.headline}</h4>
                    <p className="text-foreground/90 leading-relaxed text-sm">
                      {i.body}
                    </p>
                    {i.citations && i.citations.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Citations:{" "}
                        {i.citations.map((c, ci) => (
                          <span key={ci}>
                            {ci > 0 && ", "}
                            <em>[{c}]</em>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section id="implications" title="Implications">
            <BulletList items={section.implications} />
          </Section>

          <Section id="tensions" title="Tensions & gaps">
            <BulletList items={section.tensions} />
          </Section>

          <Section id="next" title="What to do next">
            <OrderedList items={section.next} />
          </Section>
        </>
      )}

      <Section id="sources" title="Sources">
        <ul className="space-y-3">
          {outline.sources.map((s, i) => (
            <li
              key={i}
              className="border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div className="font-semibold text-sm">{s.title}</div>
              <p className="text-sm text-muted-foreground mt-0.5">{s.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-5 border-t border-border first:border-t-0">
      <h3 className="text-lg font-semibold mb-3 scroll-mt-20">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0)
    return (
      <p className="text-muted-foreground text-sm">No items for this lens.</p>
    );
  return (
    <ul className="space-y-2 list-disc pl-5 text-sm leading-relaxed">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function OrderedList({ items }: { items: string[] }) {
  if (items.length === 0)
    return (
      <p className="text-muted-foreground text-sm">No items for this lens.</p>
    );
  return (
    <ol className="space-y-2 list-decimal pl-5 text-sm leading-relaxed">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ol>
  );
}

function PersonLensContent({
  outline,
  synthesis,
  personLens,
  depth,
  synthesisId,
}: {
  outline: MicrositeDocument["properties"]["outline"];
  synthesis: MicrositeDocument;
  personLens: PersonLensSection;
  depth: PersonLensDepth;
  synthesisId: string;
}) {
  const isBrief = depth === "brief";
  const baseHref = `/synthesis/${synthesisId}?lens=person-${personLens.personId}`;
  return (
    <article>
      <header className="mb-5">
        <div className="text-xs uppercase tracking-wider text-primary font-medium mb-2">
          Person lens · microscopic read
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={personLens.personName} size={44} />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight leading-tight">
              {personLens.personName}
            </h2>
            <div className="text-sm text-muted-foreground">
              Reading {outline.title}
            </div>
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Depth"
          className="inline-flex items-center bg-accent/40 border border-border rounded-md p-0.5 mt-1"
        >
          <Link
            role="tab"
            aria-selected={isBrief}
            replace
            scroll={false}
            href={`${baseHref}&depth=brief`}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              isBrief
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Full brief
          </Link>
          <Link
            role="tab"
            aria-selected={!isBrief}
            replace
            scroll={false}
            href={`${baseHref}&depth=exec`}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium transition-colors",
              !isBrief
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Executive summary
          </Link>
        </div>
      </header>

      <Section id="overview" title="Overview">
        <p className="text-foreground/90 leading-relaxed">{outline.overview}</p>
      </Section>

      {isBrief ? (
        <SyntheisMicrositeContent
          outline={outline}
          synthesis={synthesis}
          activeLens={"general"}
          section={personLens.fullBrief}
          hideOverview
        />
      ) : (
        <PersonExecutiveSummaryView personLens={personLens} />
      )}
    </article>
  );
}

function PersonExecutiveSummaryView({
  personLens,
}: {
  personLens: PersonLensSection;
}) {
  const { tldr, keyPoints, callToAction } = personLens.executiveSummary;
  return (
    <>
      <Section id="tldr" title="TL;DR">
        <p className="text-foreground/90 leading-relaxed text-base font-medium">
          {tldr}
        </p>
      </Section>

      <Section id="key-points" title="Key points">
        <ol className="space-y-2 list-decimal pl-5 text-sm leading-relaxed">
          {keyPoints.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ol>
      </Section>

      <Section id="call-to-action" title="Call to action">
        <p className="text-foreground/90 leading-relaxed border-l-2 border-primary pl-4 italic">
          {callToAction}
        </p>
      </Section>
    </>
  );
}

// People recommendations for a synthesis. We don't have person links on the
// synthesis itself — but we have its source research, which does. Aggregate
// tags and linked entities from the source research and feed the result to
// the standard PeopleRecommendations component.
function SynthesisPeopleRecommendations({
  synthesisId,
}: {
  synthesisId: string;
}) {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const synthRaw = documents[synthesisId];
  const synthesis =
    synthRaw?.kind === "microsite" ? synthRaw : undefined;
  const aggregate = useMemo(() => {
    if (!synthesis) {
      return {
        id: synthesisId,
        tags: [] as string[],
        linkedPersonIds: [] as string[],
        linkedCustomerIds: [] as string[],
        linkedObjectiveIds: [] as string[],
      };
    }
    const tags = new Set<string>();
    const personIds = new Set<string>();
    const customerIds = new Set<string>();
    const objectiveIds = new Set<string>();
    for (const rid of synthesis.properties.researchIds) {
      const r = documents[rid];
      if (!r || r.kind !== "research") continue;
      for (const t of r.tags) tags.add(t);
      for (const id of r.linkedPersonIds) personIds.add(id);
      for (const id of r.linkedCustomerIds) customerIds.add(id);
      for (const id of r.linkedObjectiveIds) objectiveIds.add(id);
    }
    return {
      id: synthesis.id,
      tags: Array.from(tags),
      linkedPersonIds: Array.from(personIds),
      linkedCustomerIds: Array.from(customerIds),
      linkedObjectiveIds: Array.from(objectiveIds),
    };
  }, [synthesis, synthesisId, documents]);
  return <PeopleRecommendations artifact={aggregate} />;
}

function DecksCard({ synthesisId }: { synthesisId: string }) {
  const documents = useProfilerStore((s) => s.documents ?? {});
  const list = useMemo(
    () =>
      (Object.values(documents).filter(
        (d) => d.kind === "deck",
      ) as DeckDocument[])
        .filter((d) => d.properties.synthesisId === synthesisId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [documents, synthesisId],
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Presentation className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Decks</h2>
          {list.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {list.length}
            </span>
          )}
        </div>
        <Link href={`/synthesis/${synthesisId}/decks/new`}>
          <Button size="sm" variant="secondary">
            <Presentation className="w-3 h-3" />
            New deck
          </Button>
        </Link>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Compress this synthesis into a presentation for a specific audience.
        Many decks per synthesis — one per room.
      </p>
      {list.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          No decks yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((d) => (
            <li key={d.id}>
              <Link
                href={`/synthesis/${synthesisId}/decks/${d.id}`}
                className="block border border-border rounded-md p-2.5 hover:bg-accent/40 transition-colors"
              >
                <div className="text-sm font-medium leading-snug line-clamp-2">
                  {d.title}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {d.properties.slides.length} slides ·{" "}
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
