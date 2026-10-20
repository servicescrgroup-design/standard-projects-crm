import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { scopedActivities } from "@/lib/server/activityQuery";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const notes = await scopedActivities(user, ["NOTE"], q);
  return (
    <div className="space-y-4">
      <SearchBox q={q} placeholder="Search notes or companies">
        <Link href="/log" className="btn-dark ml-auto"><Plus className="h-4 w-4" /> New note</Link>
      </SearchBox>
      <ActivityFeed items={notes} empty="No notes yet. Notes logged on a lead, website enquiries and quote requests appear here." />
    </div>
  );
}
