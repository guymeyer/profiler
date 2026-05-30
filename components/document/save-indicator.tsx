"use client";

export type SaveState = "idle" | "dirty" | "saving" | "saved";

// The tiny "Saving… / Saved / Unsaved / Locked" badge that sits next to
// the meta line on document surfaces. Shared between the detail page and
// (after PR 3) the intake review stage so both speak the same language.
export function SaveIndicator({
  state,
  locked,
}: {
  state: SaveState;
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
