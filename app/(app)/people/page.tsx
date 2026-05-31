import { redirect } from "next/navigation";

// Legacy index route. The canonical list of internal people now lives at
// /company/people. Person detail pages stay at /people/[id] as their
// stable, scope-agnostic URL.
export default function LegacyPeopleIndexPage() {
  redirect("/company/people");
}
