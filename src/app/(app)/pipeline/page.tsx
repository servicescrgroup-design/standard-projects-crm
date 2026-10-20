import { redirect } from "next/navigation";

/** The old Pipeline board now lives at Deals (Kanban view). */
export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = new URLSearchParams(await searchParams);
  redirect(`/deals${sp.toString() ? `?${sp}` : ""}`);
}
