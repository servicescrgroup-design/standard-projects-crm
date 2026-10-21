import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { publicBase, visibleQuote } from "@/lib/server/quotes";
import { headers } from "next/headers";
import { canSendEmail } from "@/lib/access";
import { sanitizeItems } from "@/lib/quotes";
import { QuoteEditor } from "@/components/quotes/QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const q = await visibleQuote(user, id).catch(() => null);
  if (!q) notFound();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const prices = await db.priceItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-4">
      <Link href={`/leads/${q.leadId}#quotes`} className="text-sm text-ink-3 hover:text-ink">← {q.lead.company}</Link>
      <QuoteEditor
        canSendDirect={canSendEmail(user)}
        publicLink={`${publicBase(origin)}/q/${q.token}`}
        isOwner={user.role === "OWNER"}
        prices={prices.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, monthly: p.monthly }))}
        quote={{
          id: q.id,
          number: q.number,
          status: q.status,
          title: q.title,
          items: sanitizeItems(q.items),
          discount: q.discount,
          notes: q.notes ?? "",
          validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "",
          token: q.token,
          company: q.lead.company,
          contactName: q.lead.contactName,
          leadEmail: q.lead.email,
          sentAt: q.sentAt?.toISOString() ?? null,
          viewedAt: q.viewedAt?.toISOString() ?? null,
          viewCount: q.viewCount,
          acceptedAt: q.acceptedAt?.toISOString() ?? null,
          acceptedName: q.acceptedName,
          declinedAt: q.declinedAt?.toISOString() ?? null,
          declineReason: q.declineReason,
        }}
      />
    </div>
  );
}
