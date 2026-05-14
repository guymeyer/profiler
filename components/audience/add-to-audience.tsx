"use client";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfilerStore } from "@/lib/store";

export function AddToAudience({ personId }: { personId: string }) {
  const selected = useProfilerStore((s) =>
    s.selectedPersonIds.includes(personId),
  );
  const toggle = useProfilerStore((s) => s.togglePerson);

  return (
    <Button
      variant={selected ? "secondary" : "outline"}
      className="w-full"
      onClick={() => toggle(personId)}
    >
      {selected ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Added to audience
        </>
      ) : (
        <>
          <Plus className="w-3.5 h-3.5" />
          Add to audience
        </>
      )}
    </Button>
  );
}
