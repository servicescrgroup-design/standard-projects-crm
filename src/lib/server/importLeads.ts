import "server-only";
import { db } from "./db";
import { mapNotionRow, planImport, type ImportedLead, type NotionCustomerRow } from "../notionImport";
import { mapCsvRows } from "../csvImport";
import { mapResearchRow, planResearchImport, type ResearchRow } from "../researchImport";

export type ImportSummary = { read: number; importable: number; created: number; enriched: number; skipped: number };

/**
 * Imports Notion "Customers CRM" rows. New companies become unassigned leads; companies already in
 * the CRM (same phone or name, e.g. typed in by hand) get the missing Notion details filled in,
 * keeping their owner and stage. Re-running is safe.
 */
export async function importNotionRows(rows: NotionCustomerRow[]): Promise<ImportSummary> {
  return importMapped(rows.length, rows.map(mapNotionRow).filter((l): l is ImportedLead => l !== null));
}

/** Spreadsheet rows (already parsed from CSV): same merge rules as the Notion import. */
export async function importCsvRows(rows: Record<string, string>[]): Promise<ImportSummary> {
  return importMapped(rows.length, mapCsvRows(rows));
}

async function importMapped(read: number, mapped: ImportedLead[]): Promise<ImportSummary> {
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

  return { read, importable: mapped.length, created, enriched: plan.update.length, skipped: plan.skipped };
}

/** Imports researched international prospects as new, unassigned leads. Re-running is safe. */
export async function importResearchRows(rows: ResearchRow[]): Promise<ImportSummary> {
  const mapped = rows.map(mapResearchRow).filter((l): l is ImportedLead => l !== null);
  const existing = await db.lead.findMany({ select: { company: true, website: true, externalRef: true } });
  const plan = planResearchImport(mapped, existing);
  let created = 0;
  for (let i = 0; i < plan.create.length; i += 200) {
    const { count } = await db.lead.createMany({
      data: plan.create.slice(i, i + 200).map((l) => ({ ...l, createdAt: undefined })),
      skipDuplicates: true,
    });
    created += count;
  }
  return { read: rows.length, importable: mapped.length, created, enriched: 0, skipped: plan.skipped };
}
