"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { useProfilerStore } from "@/lib/store";
import {
  BLANK_PERSON_MARKDOWN,
  markdownToPerson,
  slugifyId,
} from "@/lib/profile-md";
import { PEOPLE } from "@/lib/data/people";

export default function NewPersonPage() {
  const router = useRouter();
  const saveProfile = useProfilerStore((s) => s.saveProfile);
  const customProfiles = useProfilerStore((s) => s.customProfiles ?? {});
  const [draft, setDraft] = useState(BLANK_PERSON_MARKDOWN);
  const [warnings, setWarnings] = useState<string[]>([]);

  function handleSave() {
    const { person, warnings: parseWarnings } = markdownToPerson(draft);
    // Ensure a unique id if it clashes with seed or another custom
    const taken = new Set([
      ...PEOPLE.map((p) => p.id),
      ...Object.keys(customProfiles),
    ]);
    let id = slugifyId(person.name);
    let n = 2;
    while (taken.has(id)) id = `${slugifyId(person.name)}-${n++}`;
    const finalPerson = { ...person, id };
    saveProfile(finalPerson);
    setWarnings(parseWarnings);
    router.push(`/people/${id}`);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/people"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All people
      </Link>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">New person</h1>
        <p className="text-muted-foreground mt-1">
          Profiles are markdown. The metadata bullets at the top set typed
          fields (influence, communication style, tags) and each{" "}
          <code>##</code> heading is a section.
        </p>
      </header>

      <Card className="p-5">
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          onSave={handleSave}
          warnings={warnings}
          saveLabel="Create profile"
        />
      </Card>
    </div>
  );
}
