import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ prdId: string }>;
}

export default async function LegacyPRDDetailPage({ params }: Props) {
  const { prdId } = await params;
  redirect(`/documents/${prdId}`);
}
