"use client";
import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, redirect } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Settings2,
  Trash2,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  InlineDatabase,
  type InlineDatabaseColumn,
} from "@/components/ui/inline-database";
import { useProfilerStore } from "@/lib/store";
import { useEffectivePeople } from "@/lib/people-hooks";
import { OBJECTIVES } from "@/lib/data/objectives";
import { CopyPromptButton } from "@/components/copy-prompt-button";
import { buildResearchPrototypePrompt } from "@/lib/prototype-prompt";
import {
  extractMetricsFromResearch,
  extractMetricsFromPRD,
  extractMetricsFromMemo,
} from "@/lib/llm/extract-metrics";
import {
  METRIC_KIND_LABELS,
  type DerivedMetric,
  type Document,
  type DocumentOfKind,
} from "@/lib/types";
import { PeopleRecommendations } from "@/components/people-recommendations";
import { ReclassifyButton } from "@/components/reclassify-button";
import { QualitySignals } from "@/components/quality-signals";
import { RichEditor, type EntityChoice } from "@/components/rich-editor";
import {
  documentToMarkdown,
  markdownToDocument,
} from "@/lib/document-md";
import {
  getDocumentKindConfig,
  type KindRenderContext,
  type PropertiesPanelProps,
} from "@/lib/document-kinds";
import {
  documentToResearch,
  documentToPRD,
  documentToMemo,
} from "@/lib/document-adapters";
import "@/components/document/properties-panels";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ documentId: string }>;
}

const AUTOSAVE_MS = 600;

export default function DocumentDetailPage({ params }: Props) {
  const { documentId } = use(params);
  const router = useRouter();
  const document = useProfilerStore((s) => s.documents?.[documentId]);
  const saveDocument = useProfilerStore((s) => s.saveDocument);
  const deleteDocument = useProfilerStore((s) => s.deleteDocument);
  const customers = useProfilerStore((s) => s.customers ?? {});
  const businessUnits = useProfilerStore((s) => s.businessUnits ?? {});
  const metrics = useProfilerStore((s) => s.metrics ?? {});
  const replaceMetricsForResearch = useProfilerStore(
    (s) => s.replaceMetricsForResearch,
  );
  const replaceMetricsForPRD = useProfilerStore(
    (s) => s.replaceMetricsForPRD,
  );
  const replaceMetricsForMemo = useProfilerStore(
    (s) => s.replaceMetricsForMemo,
  );
  const people = useEffectivePeople();

  const [hydrated, setHydrated] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved"
  >("idle");
  useEffect(() => setHydrated(true), []);

  const derivedMetrics = useMemo(
    () =>
      Object.values(metrics).filter((m) => m.sourceDocumentId === documentId),
    [metrics, documentId],
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSave(nextMarkdown: string) {
    if (!document || document.locked) return;
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState("saving");
      const { document: parsed } = markdownToDocument(nextMarkdown, {
        existing: document,
      });
      saveDocument(parsed);
      setSaveState("saved");
      setTimeout(
        () => setSaveState((s) => (s === "saved" ? "idle" : s)),
        1500,
      );
    }, AUTOSAVE_MS);
  }

  function handlePropertyChange<K extends Document["kind"]>(
    updater: (d: DocumentOfKind<K>) => DocumentOfKind<K>,
  ) {
    if (!document || document.locked) return;
    const next = updater(document as DocumentOfKind<K>);
    setSaveState("saving");
    saveDocument(next);
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
  }

  function handleToggleLock() {
    if (!document) return;
    saveDocument({ ...document, locked: !document.locked } as Document);
  }

  function handleDelete() {
    if (!document) return;
    if (!confirm(`Delete this ${document.kind}?`)) return;
    deleteDocument(document.id);
    router.push("/knowledge");
  }

  async function handleReExtract() {
    if (!document) return;
    setExtractError(null);
    setExtracting(true);
    try {
      if (document.kind === "research") {
        const next = await extractMetricsFromResearch({
          research: documentToResearch(document),
          businessUnits: Object.values(businessUnits),
        });
        replaceMetricsForResearch(document.id, next);
      } else if (document.kind === "prd") {
        const next = await extractMetricsFromPRD({
          prd: documentToPRD(document),
          businessUnits: Object.values(businessUnits),
        });
        replaceMetricsForPRD(document.id, next);
      } else if (document.kind === "memo") {
        const next = await extractMetricsFromMemo({
          memo: documentToMemo(document),
          businessUnits: Object.values(businessUnits),
        });
        replaceMetricsForMemo(document.id, next);
      }
    } catch (e) {
      setExtractError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  if (!hydrated) return null;
  if (!document) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Document not found</h1>
        <div className="mt-6">
          <Link href="/knowledge">
            <Button>Back to Knowledge</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Microsite and Deck have bespoke viewers — bounce there.
  if (document.kind === "microsite") {
    redirect(`/synthesis/${document.id}`);
  }
  if (document.kind === "deck") {
    redirect(`/synthesis/${document.properties.synthesisId}/decks/${document.id}`);
  }

  const config = getDocumentKindConfig(document.kind);
  const ctx: KindRenderContext = {
    people,
    customers: Object.values(customers),
    objectives: OBJECTIVES,
    businessUnits: Object.values(businessUnits),
  };

  const initialMarkdown = documentToMarkdown(document);

  const entityChoices: EntityChoice[] = [
    ...people.map((p) => ({
      id: p.id,
      label: p.name,
      sub: `${p.title}${p.team ? ` · ${p.team}` : ""}`,
      kind: "person" as const,
    })),
    ...Object.values(customers).map((c) => ({
      id: c.id,
      label: c.name,
      sub: c.industry,
      kind: "customer" as const,
    })),
    ...OBJECTIVES.map((o) => ({
      id: o.id,
      label: o.title,
      sub: o.description,
      kind: "objective" as const,
    })),
    ...Object.values(businessUnits).map((b) => ({
      id: b.id,
      label: b.name,
      sub: b.description,
      kind: "business-unit" as const,
    })),
  ];

  const Panel = config.PropertiesPanel as
    | ((props: PropertiesPanelProps<typeof document.kind>) => React.ReactElement)
    | undefined;

  const canReclassify =
    document.kind === "research" ||
    document.kind === "prd" ||
    document.kind === "memo";

  return (
    <div>
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="w-3 h-3" />
        Knowledge
      </Link>

      <PageHeader
        eyebrow={config.eyebrow}
        title={document.title}
        meta={
          <>
            {config.renderMetaInline(document, ctx)}
            {document.sourceUrl && (
              <>
                {" · "}
                <a
                  href={document.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  source
                </a>
              </>
            )}
            <span className="ml-2 text-[11px]">
              <SaveIndicator state={saveState} locked={!!document.locked} />
            </span>
          </>
        }
        actions={
          <>
            {config.hasPrototypePrompt && document.kind === "research" && (
              <CopyPromptButton
                getPrompt={() =>
                  buildResearchPrototypePrompt(documentToResearch(document))
                }
              />
            )}
            <Button
              variant="secondary"
              onClick={() => setPropertiesOpen((v) => !v)}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Properties
            </Button>
            <Button variant="secondary" onClick={handleToggleLock}>
              {document.locked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Lock
                </>
              )}
            </Button>
            {config.hasMetrics && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleReExtract}
                disabled={extracting}
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting…
                  </>
                ) : (
                  "Re-extract metrics"
                )}
              </Button>
            )}
            {canReclassify && <ReclassifyButton current={document} />}
            <Button variant="ghost" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </>
        }
      >
        {config.hasMetrics && (
          <QualitySignals
            artifactKind={document.kind as "research" | "prd" | "memo"}
            artifactId={document.id}
            artifactTitle={document.title}
          />
        )}
      </PageHeader>

      {propertiesOpen && Panel && (
        <Panel
          document={document as never}
          onChange={handlePropertyChange as never}
          disabled={!!document.locked}
          ctx={ctx}
        />
      )}

      <RichEditor
        initialMarkdown={initialMarkdown}
        onChangeMarkdown={scheduleSave}
        readOnly={!!document.locked}
        entities={entityChoices}
        placeholder={`Start writing the ${config.label.toLowerCase()}…  # for headings, @ to mention`}
      />

      {extractError && (
        <div className="text-[13px] text-danger mt-4">
          Metric extraction failed: {extractError}
        </div>
      )}

      {config.hasMetrics && (derivedMetrics.length > 0 || extracting) && (
        <Section
          title="Derived metrics"
          subtitle={`${derivedMetrics.length} extracted`}
          divider
        >
          {derivedMetrics.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic">
              Extracting metrics from this {config.label.toLowerCase()}…
            </p>
          ) : (
            <MetricsTable
              metrics={derivedMetrics}
              businessUnits={businessUnits}
            />
          )}
        </Section>
      )}

      <Section title="People to talk to" divider>
        <PeopleRecommendations
          artifact={{
            id: document.id,
            tags: document.tags,
            linkedPersonIds: document.linkedPersonIds,
            linkedCustomerIds: document.linkedCustomerIds,
            linkedObjectiveIds: document.linkedObjectiveIds,
            linkedBusinessUnitId: document.linkedBusinessUnitId,
          }}
          hideTitle
        />
      </Section>
    </div>
  );
}

function SaveIndicator({
  state,
  locked,
}: {
  state: "idle" | "dirty" | "saving" | "saved";
  locked: boolean;
}) {
  if (locked) return <span className="text-muted-foreground">Locked</span>;
  if (state === "saving")
    return <span className="text-muted-foreground">Saving…</span>;
  if (state === "saved")
    return <span className="text-muted-foreground">Saved</span>;
  if (state === "dirty")
    return <span className="text-muted-foreground">Unsaved</span>;
  return null;
}

function MetricsTable({
  metrics,
  businessUnits,
}: {
  metrics: DerivedMetric[];
  businessUnits: Record<string, { id: string; name: string }>;
}) {
  const columns: InlineDatabaseColumn<DerivedMetric>[] = [
    {
      key: "name",
      label: "Metric",
      render: (m) => <span className="font-medium">{m.name}</span>,
      sortValue: (m) => m.name,
    },
    {
      key: "value",
      label: "Value",
      kind: "number",
      width: "w-[110px]",
      render: (m) =>
        typeof m.value === "number" ? (
          <span>
            {m.value}
            {m.unit ? ` ${m.unit}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (m) => m.value ?? Number.NEGATIVE_INFINITY,
    },
    {
      key: "change",
      label: "Change",
      kind: "number",
      width: "w-[110px]",
      render: (m) =>
        typeof m.changeMagnitude === "number" ? (
          <span
            className={cn(
              m.sentiment === "positive" && "text-success",
              m.sentiment === "negative" && "text-danger",
            )}
          >
            {m.changeDirection === "up" ? "+" : "−"}
            {m.changeMagnitude}
            {m.changeUnit === "pct" ? "%" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "period",
      label: "Period",
      kind: "muted",
      width: "w-[140px]",
      render: (m) => m.periodLabel,
    },
    {
      key: "kind",
      label: "Kind",
      kind: "muted",
      width: "w-[110px]",
      render: (m) => METRIC_KIND_LABELS[m.kind],
    },
    {
      key: "bu",
      label: "BU",
      kind: "muted",
      width: "w-[140px]",
      render: (m) => {
        if (!m.businessUnitId) return null;
        const bu = businessUnits[m.businessUnitId];
        if (!bu) return null;
        return (
          <Link
            href={`/business-units/${bu.id}`}
            className="link"
            onClick={(e) => e.stopPropagation()}
          >
            {bu.name}
          </Link>
        );
      },
    },
  ];
  return <InlineDatabase rows={metrics} columns={columns} />;
}
