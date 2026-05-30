import { describe, expect, it } from "vitest";
import {
  blankMarkdownFor,
  documentToMarkdown,
  markdownToDocument,
} from "@/lib/document-md";
import type {
  MemoDocument,
  PRDDocument,
  ResearchDocument,
} from "@/lib/types";

// Round-trip tests for the unified markdown spec. The round-trip is the
// load-bearing contract between the rich editor and the document store —
// a regression here corrupts every document on next save.

describe("document-md round-trip", () => {
  it("preserves a research document end-to-end", () => {
    const original: ResearchDocument = {
      id: "res_test_1",
      kind: "research",
      title: "Pricing willingness-to-pay study",
      summary: "Users frame value through outcome stories, not feature lists.",
      content:
        "Body paragraph one.\n\nBody paragraph two with **bold** and a [link](https://example.com).",
      source: "Customer Research Team",
      tags: ["pricing", "willingness-to-pay", "enterprise"],
      linkedPersonIds: ["p_alice", "p_bob"],
      linkedCustomerIds: ["c_acme"],
      linkedObjectiveIds: ["o_pricing_q3"],
      linkedBusinessUnitId: undefined,
      createdAt: "2026-04-15T10:00:00.000Z",
      properties: {
        participants: ["6 PMs (Series B+ SaaS)", "4 Heads of Procurement"],
        methodology: "45-min semi-structured interviews",
        conductedAt: "2026-04-10T00:00:00.000Z",
      },
    };

    const md = documentToMarkdown(original);
    const { document, warnings } = markdownToDocument(md, {
      existing: original,
    });

    expect(warnings).toEqual([]);
    expect(document.kind).toBe("research");
    expect(document.title).toBe(original.title);
    expect(document.summary).toBe(original.summary);
    expect(document.content).toBe(original.content);
    expect(document.source).toBe(original.source);
    expect(document.tags).toEqual(original.tags);
    expect(document.linkedPersonIds).toEqual(original.linkedPersonIds);
    expect(document.linkedCustomerIds).toEqual(original.linkedCustomerIds);
    expect(document.linkedObjectiveIds).toEqual(original.linkedObjectiveIds);
    expect(document.properties).toEqual(original.properties);
  });

  it("preserves a PRD document end-to-end", () => {
    const original: PRDDocument = {
      id: "prd_test_1",
      kind: "prd",
      title: "Trial-to-paid conversion lift",
      summary: "Reduce trial cliff by adding contextual save offer at day 12.",
      content: "Body of the PRD with multiple sections.",
      source: "Growth PM team",
      tags: ["growth", "trial", "conversion"],
      linkedPersonIds: [],
      linkedCustomerIds: [],
      linkedObjectiveIds: ["o_arr_growth"],
      linkedBusinessUnitId: "bu_growth",
      createdAt: "2026-05-01T00:00:00.000Z",
      properties: {
        problem:
          "Free trial users drop off at day 14 without a structured save path.",
        solution:
          "In-product save offer shown at day 12 of trial, gated on usage signal.",
        targetUsers: ["Self-serve trial users on Pro plan"],
        successMetrics: [
          "Trial-to-paid conversion +5pp",
          "Day-14 churn -20%",
        ],
        status: "review",
        targetShipDate: "2026-07-15T00:00:00.000Z",
      },
    };

    const md = documentToMarkdown(original);
    const { document, warnings } = markdownToDocument(md, {
      existing: original,
    });

    expect(warnings).toEqual([]);
    expect(document.kind).toBe("prd");
    expect(document.title).toBe(original.title);
    expect(document.summary).toBe(original.summary);
    expect(document.content).toBe(original.content);
    expect(document.linkedBusinessUnitId).toBe(original.linkedBusinessUnitId);
    expect(document.properties).toEqual(original.properties);
  });

  it("preserves a memo document end-to-end", () => {
    const original: MemoDocument = {
      id: "memo_test_1",
      kind: "memo",
      title: "Q2 strategy retro",
      summary: "What worked, what didn't, what we'd cut next time.",
      content: "Long-form retro body with several themes.",
      source: "Guy",
      tags: ["retro", "strategy", "q2-2026"],
      linkedPersonIds: ["p_alice"],
      linkedCustomerIds: [],
      linkedObjectiveIds: [],
      linkedBusinessUnitId: "bu_platform",
      createdAt: "2026-06-01T00:00:00.000Z",
      properties: {
        memoKind: "post-mortem",
        keyClaims: [
          "We shipped late because scope grew silently in week 4.",
          "Customer feedback loop was 3 days too slow during validation.",
        ],
        decisions: [
          "Cut scope at the week-3 checkpoint, not at integration.",
          "Move customer calls to async-first by default.",
        ],
      },
    };

    const md = documentToMarkdown(original);
    const { document, warnings } = markdownToDocument(md, {
      existing: original,
    });

    expect(warnings).toEqual([]);
    expect(document.kind).toBe("memo");
    expect(document.title).toBe(original.title);
    expect(document.summary).toBe(original.summary);
    expect(document.content).toBe(original.content);
    expect(document.properties).toEqual(original.properties);
  });

  it("blank templates parse without errors", () => {
    for (const kind of ["research", "prd", "memo"] as const) {
      const md = blankMarkdownFor(kind);
      const { document, warnings } = markdownToDocument(md, { kind });
      expect(warnings).toEqual([]);
      expect(document.kind).toBe(kind);
      expect(document.title).toMatch(/Untitled/);
    }
  });

  it("preserves system metadata (createdAt, locked, uploadedFrom) across round-trip", () => {
    const original: ResearchDocument = {
      id: "res_meta_test",
      kind: "research",
      title: "Test",
      summary: "",
      content: "Body.",
      source: "Internal",
      tags: [],
      linkedPersonIds: [],
      linkedCustomerIds: [],
      linkedObjectiveIds: [],
      uploadedFrom: { filename: "test.pdf", kind: "pdf" },
      sourceUrl: "https://example.com/doc",
      locked: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      properties: { participants: [] },
    };
    const md = documentToMarkdown(original);
    const { document } = markdownToDocument(md, { existing: original });
    expect(document.id).toBe(original.id);
    expect(document.createdAt).toBe(original.createdAt);
    expect(document.locked).toBe(true);
    expect(document.uploadedFrom).toEqual(original.uploadedFrom);
    expect(document.sourceUrl).toBe(original.sourceUrl);
  });

  it("warns on unknown sections instead of throwing", () => {
    const md = `# Some doc

- Source: Test

## Summary

Hi

## Unknown section

Not a known field.

## Body

Body content.`;
    const { warnings } = markdownToDocument(md, { kind: "research" });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join(" ")).toContain("unknown section");
  });

  it("falls back to generic shape for unsupported kinds", () => {
    const md = `# A note

## Summary

Just a quick note.

## Body

Body text.`;
    const { document } = markdownToDocument(md, { kind: "note" });
    expect(document.kind).toBe("note");
    expect(document.title).toBe("A note");
    expect(document.summary).toBe("Just a quick note.");
  });
});
