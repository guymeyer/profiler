import { redirect } from "next/navigation";

// Legacy route — research detail moved to /documents/[id]. Keeping this
// file as a redirect so external links and pre-PR-5 navigation still
// reach the right page. Delete in PR 6 once intake flows route directly
// to /documents.

interface Props {
  params: Promise<{ researchId: string }>;
}

export default async function LegacyResearchDetailPage({ params }: Props) {
  const { researchId } = await params;
  redirect(`/documents/${researchId}`);
}
