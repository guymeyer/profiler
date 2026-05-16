import Link from "next/link";
import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PendingPage() {
  return (
    <Card className="p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-warning/10 text-warning inline-flex items-center justify-center mx-auto">
        <Hourglass className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        Join request sent
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        The workspace owner will see your request and can approve it. Until
        then, you can sign out and come back, or start a workspace of your own
        if you&apos;d rather.
      </p>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Link href="/onboarding/company">
          <Button variant="secondary">Start a new workspace</Button>
        </Link>
      </div>
    </Card>
  );
}
