import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { scopedActivities } from "@/lib/server/activityQuery";
import { ActivityFeed } from "@/components/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const user = await requireUser();
  const all = await scopedActivities(user, ["MEETING", "VISIT"], undefined, 300);
  const now = new Date();
  const upcoming = all.filter((a) => a.occurredAt >= now).reverse();
  const past = all.filter((a) => a.occurredAt < now);
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Link href="/log" className="btn-dark"><Plus className="h-4 w-4" /> Log a meeting</Link></div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Upcoming</h2>
        <ActivityFeed items={upcoming} empty="No upcoming meetings logged." />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Past meetings and site visits</h2>
        <ActivityFeed items={past} empty="No meetings logged yet." />
      </section>
    </div>
  );
}
