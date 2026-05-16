"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2, Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findMatchingWorkspaces,
  requestToJoinWorkspace,
  createWorkspaceForCompany,
  type CompanyMatch,
} from "@/app/onboarding/actions";

export default function OnboardingCompanyPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [matches, setMatches] = useState<CompanyMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSearch() {
    setError(null);
    if (!companyName.trim()) return;
    startTransition(async () => {
      try {
        const found = await findMatchingWorkspaces(companyName);
        setMatches(found);
        setSearched(true);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleJoin(workspaceId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await requestToJoinWorkspace(workspaceId);
        if (res.status === "joined") {
          router.push("/onboarding/joining");
        } else {
          router.push("/onboarding/pending");
        }
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function handleCreate() {
    setError(null);
    if (!companyName.trim()) return;
    startTransition(async () => {
      try {
        await createWorkspaceForCompany({ companyName });
        router.push("/onboarding/joining");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome — what company do you work at?
        </h1>
        <p className="text-muted-foreground mt-2">
          We&apos;ll check if your team already has a workspace. If not,
          we&apos;ll create one and seed it with research on your company.
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Company name
          </label>
          <div className="flex gap-2 mt-1">
            <Input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setSearched(false);
              }}
              placeholder="e.g. ServiceNow"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            <Button onClick={handleSearch} disabled={pending || !companyName.trim()}>
              {pending && !searched ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/[0.05] p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {searched && matches.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              Found matching workspaces — request to join?
            </div>
            <ul className="space-y-2">
              {matches.map((m) => (
                <li
                  key={m.workspaceId}
                  className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent/40"
                >
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      {m.memberCount} member{m.memberCount === 1 ? "" : "s"}
                      {m.primaryDomain && <span>· {m.primaryDomain}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleJoin(m.workspaceId)}
                    disabled={pending}
                  >
                    Request to join
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searched && (
          <div className="pt-3 border-t">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">
              {matches.length > 0 ? "Or create a new workspace" : "No matches found — create a new one"}
            </div>
            <Button
              onClick={handleCreate}
              disabled={pending || !companyName.trim()}
              size="lg"
              className="w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating + starting research…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create workspace for {companyName}
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">
              We&apos;ll kick off background research on the company + its
              executive leadership. Takes ~60–90 seconds.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
