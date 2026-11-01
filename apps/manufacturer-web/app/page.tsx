import { redirect } from "next/navigation";

// The manufacturer landing route must never show sample or demo workspace data.
// Send all visitors to the authenticated, API-backed manufacturer workspace.
export default function HomePage() {
  redirect("/portal");
}
