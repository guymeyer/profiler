import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ memoId: string }>;
}

export default async function LegacyMemoDetailPage({ params }: Props) {
  const { memoId } = await params;
  redirect(`/documents/${memoId}`);
}
