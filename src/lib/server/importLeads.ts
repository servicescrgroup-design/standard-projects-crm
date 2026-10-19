import "server-only";
import { db } from "./db";
import { mapNotionRow, type ImportedLead, type NotionCustomerRow } from "../notionImport";

export type ImportSummary = { read: number; importable: number; imported: number; alreadyThere: number };

/** Imports Notion "Customers CRM" rows as unassigned leads. Re-running skips leads already imported. */
export async function importNotionRows(rows: NotionCustomerRow[]): Promise<ImportSummary> {
  const leads = rows.map(mapNotionRow).filter((l): l is ImportedLead => l !== null);
  let imported = 0;
  for (let i = 0; i < leads.length; i += 200) {
    const { count } = await db.lead.createMany({
      data: leads.slice(i, i + 200).map((l) => ({
        ...l,
        createdAt: l.createdAt ?? undefined,
        stageChangedAt: l.createdAt ?? undefined,
      })),
      skipDuplicates: true,
    });
    imported += count;
  }
  return { read: rows.length, importable: leads.length, imported, alreadyThere: leads.length - imported };
}
