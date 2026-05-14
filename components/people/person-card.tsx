import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Person } from "@/lib/types";

export function PersonCard({ person }: { person: Person }) {
  return (
    <Link href={`/people/${person.id}`} className="group block">
      <Card className="p-5 h-full transition-shadow group-hover:shadow-md group-hover:border-foreground/15">
        <div className="flex items-start gap-3">
          <Avatar name={person.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold leading-tight truncate">
              {person.name}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {person.title}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {person.team}
            </div>
          </div>
        </div>
        <p className="text-sm text-foreground/80 mt-3.5 leading-relaxed line-clamp-3">
          {person.summary}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-4">
          {person.tags.slice(0, 4).map((t) => (
            <Badge key={t} tone="subtle">
              {t}
            </Badge>
          ))}
        </div>
      </Card>
    </Link>
  );
}
