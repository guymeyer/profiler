"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2, Users, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWorkspaceOnboardingStatus } from "@/app/onboarding/actions";

export default function JoiningPage() {
  const router = useRouter();
  const [status, setStatus] = useState<{
    workspaceId: string;
    workspaceName: string;
    researchInProgress: boolean;
    selfCompanyId: string | null;
    peopleCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await getWorkspaceOnboardingStatus();
        if (cancelled) return;
        setStatus(s);
        if (!s.researchInProgress) return; // stop polling once done
        setTimeout(poll, 4000);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight leading-tight">
              {status?.workspaceName || "Setting up your workspace…"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Drafting the company profile + executive leadership.
            </p>
          </div>
        </div>

        <ul className="space-y-3 text-sm">
          <Step
            done={!!status?.selfCompanyId}
            inProgress={!status?.selfCompanyId}
            label="Company profile"
            sub="Industry, size, region, buying triggers, evaluation criteria, red flags."
          />
          <Step
            done={(status?.peopleCount ?? 0) > 0}
            inProgress={
              !!status?.selfCompanyId && (status?.peopleCount ?? 0) === 0
            }
            label={`Executive leadership ${status?.peopleCount ? `· ${status.peopleCount} drafted` : ""}`}
            sub="Named leaders, their typical decision triggers, dos / don'ts, comm style."
          />
        </ul>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/[0.05] p-3 text-sm text-danger">
            {error}
          </div>
        )}

        {status && !status.researchInProgress ? (
          <Button
            onClick={() => router.push("/")}
            className="w-full"
            size="lg"
          >
            <Check className="w-4 h-4" />
            Open workspace
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Researching… you can stay or come back to this page later.
          </div>
        )}
      </Card>
    </div>
  );
}

function Step({
  done,
  inProgress,
  label,
  sub,
}: {
  done: boolean;
  inProgress: boolean;
  label: string;
  sub: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 mt-0.5 ${
          done
            ? "bg-success text-background"
            : inProgress
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? (
          <Check className="w-3 h-3" />
        ) : inProgress ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Users className="w-3 h-3" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </li>
  );
}
