import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

// Workspace shell. Sign-in and onboarding live outside this layout so they
// don't render the sidebar.
//
// DEMO MODE: requireWorkspace() / ensureWorkspaceRow() temporarily disabled
// so the prototype is reachable without sign-in. Restore the auth import
// and the two calls below to re-enable.
export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 px-6 md:px-12 lg:px-16 py-8 md:py-10 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
