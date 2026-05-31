import { redirect } from "next/navigation";

// Legacy index route. The canonical OKR list now lives at /company/okrs.
// /okrs/new and /okrs/[id] are unaffected.
export default function LegacyOKRsIndexPage() {
  redirect("/company/okrs");
}
