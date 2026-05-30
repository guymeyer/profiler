import { redirect } from "next/navigation";

export default function LegacyMemoIntakePage() {
  redirect("/knowledge/new?kind=memo");
}
