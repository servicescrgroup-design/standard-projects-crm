import { Info } from "lucide-react";
import { requireUser } from "@/lib/server/session";
import { scopedActivities } from "@/lib/server/activityQuery";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SearchBox } from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const emails = await scopedActivities(user, ["EMAIL_OUT", "EMAIL_IN", "PROPOSAL"], q);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p>
          This is every email logged on a lead (sent, received and proposals). Sending email from the CRM and automatic Gmail sync are not connected yet.
          Until then, log emails from a lead page or Quick log.
        </p>
      </div>
      <SearchBox q={q} placeholder="Search emails or companies" />
      <ActivityFeed items={emails} empty="No emails logged yet." />
    </div>
  );
}
