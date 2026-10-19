/**
 * Imports leads exported from the Notion "Customers CRM" database.
 *
 *   npx tsx scripts/import-notion.ts <dir-with-page-*.json>             # into the database in .env
 *   npx tsx scripts/import-notion.ts <dir> --sql <out-dir> [--batch 100] # write SQL batches instead
 *
 * Each JSON file is an array of Notion rows (see src/lib/notionImport.ts). Re-running is safe:
 * rows already imported (same Notion page URL) are skipped. Exported data stays out of git.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { mapNotionRow, type ImportedLead } from "../src/lib/notionImport";

function loadRows(dir: string): Record<string, unknown>[] {
  return readdirSync(dir)
    .filter((f) => /^page-\d+\.json$/.test(f))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>[]);
}

const sqlText = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const sqlNum = (v: number | null) => (v === null ? "NULL" : String(v));
const sqlDate = (v: Date | null) => (v === null ? "NULL" : `'${v.toISOString()}'`);
const sqlArray = (v: string[]) => (v.length ? `ARRAY[${v.map(sqlText).join(",")}]::text[]` : `ARRAY[]::text[]`);

const COLUMNS = [
  "id", "externalRef", "company", "contactName", "email", "phone", "socialLinks", "website", "address",
  "location", "industry", "segment", "serviceInterest", "priority", "source", "sourceLink", "googleRating",
  "googleReviews", "whyFit", "needs", "offersToPitch", "caseStudies", "notes", "budget", "value",
  "monthlyValue", "package", "lostReason", "stage", "nextFollowUpAt", "lastContactAt", "stageChangedAt",
  "createdAt", "updatedAt",
];

function toSqlValues(l: ImportedLead): string {
  const created = l.createdAt ?? new Date();
  return `(${[
    sqlText(randomUUID()), sqlText(l.externalRef), sqlText(l.company), sqlText(l.contactName), sqlText(l.email),
    sqlText(l.phone), sqlText(l.socialLinks), sqlText(l.website), sqlText(l.address), sqlText(l.location),
    sqlText(l.industry), sqlText(l.segment), sqlText(l.serviceInterest), sqlText(l.priority), sqlText(l.source),
    sqlText(l.sourceLink), sqlNum(l.googleRating), sqlNum(l.googleReviews), sqlText(l.whyFit), sqlText(l.needs),
    sqlArray(l.offersToPitch), sqlArray(l.caseStudies), sqlText(l.notes), sqlNum(l.budget), sqlNum(l.value),
    sqlNum(l.monthlyValue), sqlText(l.package), sqlText(l.lostReason), sqlText(l.stage), sqlDate(l.nextFollowUpAt),
    sqlDate(l.lastContactAt), sqlDate(created), sqlDate(created), "now()",
  ].join(", ")})`;
}

async function main() {
  const [dir, ...rest] = process.argv.slice(2);
  if (!dir) throw new Error("Usage: import-notion.ts <dir> [--sql <out-dir>] [--batch 100]");
  const rows = loadRows(dir);
  const leads = rows.map(mapNotionRow).filter((l): l is ImportedLead => l !== null);
  console.log(`Read ${rows.length} rows, ${leads.length} importable, ${rows.length - leads.length} skipped.`);

  const sqlIdx = rest.indexOf("--sql");
  if (sqlIdx >= 0) {
    const out = rest[sqlIdx + 1];
    const batchIdx = rest.indexOf("--batch");
    const size = batchIdx >= 0 ? Number(rest[batchIdx + 1]) : 100;
    mkdirSync(out, { recursive: true });
    for (let i = 0; i * size < leads.length; i++) {
      const chunk = leads.slice(i * size, (i + 1) * size);
      const sql =
        `INSERT INTO "Lead" (${COLUMNS.map((c) => `"${c}"`).join(", ")}) VALUES\n` +
        chunk.map(toSqlValues).join(",\n") +
        `\nON CONFLICT ("externalRef") DO NOTHING;\n`;
      writeFileSync(join(out, `batch-${String(i + 1).padStart(2, "0")}.sql`), sql);
    }
    console.log(`Wrote ${Math.ceil(leads.length / size)} SQL batch file(s) to ${out}.`);
    return;
  }

  const db = new PrismaClient();
  try {
    const before = await db.lead.count();
    const result = await db.lead.createMany({
      data: leads.map((l) => ({ ...l, createdAt: l.createdAt ?? undefined, stageChangedAt: l.createdAt ?? undefined })),
      skipDuplicates: true,
    });
    console.log(`Imported ${result.count} new lead(s); ${leads.length - result.count} already existed. Leads before: ${before}, after: ${before + result.count}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
