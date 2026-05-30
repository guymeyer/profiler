import { describe, expect, it } from "vitest";
import { migrateV1ToV2 } from "@/lib/store-migrations";

// v1 → v2 migration is the only piece of code that touches persisted user
// data. A regression here turns first-load into data loss. Cover the
// common shapes (research / prd / memo / synthesis / deck), plus the
// graceful-degradation paths (null, garbage input).

describe("migrateV1ToV2", () => {
  it("folds research / prds / memos into documents preserving ids", () => {
    const v1 = {
      research: {
        res_a: {
          id: "res_a",
          title: "Research A",
          summary: "Found X",
          content: "Body of R",
          source: "Research Team",
          conductedAt: "2026-04-15T00:00:00.000Z",
          participants: ["Alice", "Bob"],
          methodology: "interviews",
          tags: ["topic-x"],
          linkedPersonIds: ["p_1"],
          linkedCustomerIds: [],
          linkedObjectiveIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      },
      prds: {
        prd_a: {
          id: "prd_a",
          title: "PRD A",
          summary: "Build Y",
          problem: "P",
          solution: "S",
          targetUsers: ["U"],
          successMetrics: ["+30% conversion"],
          status: "review",
          targetShipDate: "2026-07-01",
          content: "PRD body",
          source: "PM",
          tags: [],
          linkedPersonIds: [],
          linkedCustomerIds: [],
          linkedObjectiveIds: [],
          linkedBusinessUnitId: "bu_x",
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      },
      memos: {
        memo_a: {
          id: "memo_a",
          title: "Memo A",
          summary: "Argues Z",
          memoKind: "brief",
          keyClaims: ["k1"],
          decisions: ["d1"],
          content: "memo body",
          source: "Guy",
          tags: [],
          linkedPersonIds: [],
          linkedCustomerIds: [],
          linkedObjectiveIds: [],
          createdAt: "2026-04-03T00:00:00.000Z",
        },
      },
    };

    const v2 = migrateV1ToV2(v1) as { documents: Record<string, unknown> };
    expect(Object.keys(v2.documents)).toHaveLength(3);
    const research = v2.documents.res_a as {
      kind: string;
      properties: { participants: string[]; methodology: string };
    };
    expect(research.kind).toBe("research");
    expect(research.properties.participants).toEqual(["Alice", "Bob"]);
    expect(research.properties.methodology).toBe("interviews");

    const prd = v2.documents.prd_a as {
      kind: string;
      properties: { status: string; targetShipDate: string };
    };
    expect(prd.kind).toBe("prd");
    expect(prd.properties.status).toBe("review");
    expect(prd.properties.targetShipDate).toBe("2026-07-01");

    const memo = v2.documents.memo_a as {
      kind: string;
      properties: { memoKind: string; keyClaims: string[] };
    };
    expect(memo.kind).toBe("memo");
    expect(memo.properties.memoKind).toBe("brief");
    expect(memo.properties.keyClaims).toEqual(["k1"]);
  });

  it("folds syntheses and decks as kind=microsite / kind=deck", () => {
    const v1 = {
      syntheses: {
        syn_a: {
          id: "syn_a",
          title: "Synthesis A",
          researchIds: ["res_1", "res_2"],
          outline: {
            title: "Synthesis A",
            overview: "Overview",
            lenses: {},
            sources: [],
          },
          html: "<html></html>",
          generatedBy: "anthropic",
          model: "claude-sonnet-4-6",
          createdAt: "2026-04-04T00:00:00.000Z",
        },
      },
      decks: {
        deck_a: {
          id: "deck_a",
          synthesisId: "syn_a",
          title: "Deck for execs",
          audience: { personIds: ["p1"], objectiveIds: [] },
          slides: [{ kind: "title", title: "Opening" }],
          generatedBy: "anthropic",
          createdAt: "2026-04-05T00:00:00.000Z",
        },
      },
    };

    const v2 = migrateV1ToV2(v1) as { documents: Record<string, unknown> };
    const microsite = v2.documents.syn_a as {
      kind: string;
      properties: { researchIds: string[]; html: string };
    };
    expect(microsite.kind).toBe("microsite");
    expect(microsite.properties.researchIds).toEqual(["res_1", "res_2"]);
    expect(microsite.properties.html).toBe("<html></html>");

    const deck = v2.documents.deck_a as {
      kind: string;
      properties: { synthesisId: string; slides: unknown[] };
    };
    expect(deck.kind).toBe("deck");
    expect(deck.properties.synthesisId).toBe("syn_a");
    expect(deck.properties.slides).toHaveLength(1);
  });

  it("preserves unrelated slices (customers, okrs, etc.)", () => {
    const v1 = {
      customers: { c1: { id: "c1", name: "Acme" } },
      okrs: { o1: { id: "o1", objective: "Grow" } },
    };
    const v2 = migrateV1ToV2(v1) as Record<string, unknown>;
    expect(v2.customers).toEqual(v1.customers);
    expect(v2.okrs).toEqual(v1.okrs);
  });

  it("merges with an existing documents record without overwriting", () => {
    const v1 = {
      documents: {
        pre_existing: {
          id: "pre_existing",
          kind: "research",
          title: "Already here",
        },
      },
      research: {
        res_a: {
          id: "res_a",
          title: "R",
          summary: "",
          content: "",
          source: "Internal",
          participants: [],
          tags: [],
          linkedPersonIds: [],
          linkedCustomerIds: [],
          linkedObjectiveIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      },
    };
    const v2 = migrateV1ToV2(v1) as { documents: Record<string, unknown> };
    expect(Object.keys(v2.documents).sort()).toEqual([
      "pre_existing",
      "res_a",
    ]);
  });

  it("returns empty object on null / garbage input rather than throwing", () => {
    expect(migrateV1ToV2(null)).toEqual({});
    expect(migrateV1ToV2(undefined)).toEqual({});
    expect(migrateV1ToV2("not an object")).toEqual({});
    expect(migrateV1ToV2(42)).toEqual({});
  });

  it("skips legacy entries that are missing an id", () => {
    const v1 = {
      research: {
        bad: { title: "no id" },
        res_a: {
          id: "res_a",
          title: "R",
          summary: "",
          content: "",
          source: "Internal",
          participants: [],
          tags: [],
          linkedPersonIds: [],
          linkedCustomerIds: [],
          linkedObjectiveIds: [],
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      },
    };
    const v2 = migrateV1ToV2(v1) as { documents: Record<string, unknown> };
    expect(Object.keys(v2.documents)).toEqual(["res_a"]);
  });
});
