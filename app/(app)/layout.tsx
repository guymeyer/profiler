import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireWorkspace, ensureWorkspaceRow } from "@/lib/auth";

// Workspace shell. Every route under (app) requires a signed-in user with
// an active workspace (Clerk organization). Sign-in and onboarding live
// outside this layout so they don't render the sidebar.
export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await requireWorkspace();
  // Sync the workspace row in our DB on first read after sign-up / org
  // switch. Idempotent and cheap when the row already exists.
  await ensureWorkspaceRow(ctx);

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
