import type { Person } from "@/lib/types";

export interface AudienceConflict {
  severity: "info" | "warn";
  message: string;
}

// Deterministic conflict detection across a multi-person audience.
// Surfaces the framing tensions an analysis would otherwise discover late.
export function detectAudienceConflicts(people: Person[]): AudienceConflict[] {
  if (people.length < 2) return [];

  const out: AudienceConflict[] = [];
  const styles = new Set(people.flatMap((p) => p.commStyle));

  const styleNames = (style: Person["commStyle"][number]) =>
    people
      .filter((p) => p.commStyle.includes(style))
      .map((p) => p.name.split(" ")[0]);

  if (styles.has("data-driven") && styles.has("narrative")) {
    const dataPeople = styleNames("data-driven");
    const narrPeople = styleNames("narrative");
    out.push({
      severity: "warn",
      message: `${dataPeople.join(", ")} want data-led framing; ${narrPeople.join(", ")} want narrative. Pick a primary lens.`,
    });
  }

  if (styles.has("operational") && styles.has("narrative")) {
    out.push({
      severity: "warn",
      message: `Engineering wants failure modes named first; executive narrative wants momentum. Order both — methodology, then story.`,
    });
  }

  if (styles.has("consensus") && styles.has("data-driven")) {
    out.push({
      severity: "info",
      message: `Consensus-style and data-driven readers pace differently. Pre-read the data; debate the implications live.`,
    });
  }

  const execs = people.filter((p) => p.influence === "executive").length;
  const ics = people.filter((p) => p.influence === "ic").length;
  if (execs === 0 && people.length >= 2) {
    out.push({
      severity: "info",
      message: `No executive in this audience — useful for working sessions, not a deciding readout.`,
    });
  } else if (execs >= 2 && ics === 0) {
    out.push({
      severity: "info",
      message: `Multi-exec audience with no IC voice. Be ready to defend specifics — they'll ask.`,
    });
  }

  return out.slice(0, 4);
}
