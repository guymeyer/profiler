import { redirect } from "next/navigation";

export default function LegacyPRDIntakePage() {
  redirect("/knowledge/new?kind=prd");
}
