// Minimal layout — no sidebar/topbar. Onboarding is its own flow that
// runs before the user has an active workspace.
export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
