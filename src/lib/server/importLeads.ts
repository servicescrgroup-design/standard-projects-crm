import "server-only";
import { db } from "./db";
import { mapNotionRow, planImport, type ImportedLead, type NotionCustomerRow } from "../notionImport";

export type ImportSummary = { read: number; importable: number; created: number; enriched: number; skipped: number };

/**
 * Imports Notion "Customers CRM" rows. New companies become unassigned leads; companies already in
 * the CRM (same phone or name, e.g. typed in by hand) get the missing Notion details filled in,
 * keeping their owner and stage. Re-running is safe.
 */
export async function importNotionRows(rows: NotionCustomerRow[]): Promise<ImportSummary> {
  const mapped = rows.map(mapNotionRow).filter((l): l is ImportedLead => l !== null);
  const existing = await db.lead.findMany({
    select: {
      id: true, company: true, phone: true, externalRef: true, contactName: true, email: true, socialLinks: true,
      website: true, address: true, location: true, industry: true, segment: true, serviceInterest: true,
      priority: true, sourceLink: true, googleRating: true, googleReviews: true, whyFit: true, needs: true,
      offersToPitch: true, caseStudies: true, notes: true, package: true, lostReason: true,
    },
  });
  const plan = planImport(mapped, existing);

  let created = 0;
  for (let i = 0; i < plan.create.length; i += 200) {
    const { count } = await db.lead.createMany({
      data: plan.create.slice(i, i + 200).map((l) => ({
        ...l,
        createdAt: l.createdAt ?? undefined,
        stageChangedAt: l.createdAt ?? undefined,
      })),
      skipDuplicates: true,
    });
    created += count;
  }
  for (let i = 0; i < plan.update.length; i += 50) {
    await db.$transaction(plan.update.slice(i, i + 50).map((u) => db.lead.update({ where: { id: u.id }, data: u.data })));
  }

  return { read: rows.length, importable: mapped.length, created, enriched: plan.update.length, skipped: plan.skipped };
}
