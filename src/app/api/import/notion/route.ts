import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { canManagePeople } from "@/lib/access";
import { importNotionRows, importResearchRows } from "@/lib/server/importLeads";
import { isResearchFile } from "@/lib/researchImport";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 5000;

/** Owner-only: import a JSON array of Notion "Customers CRM" rows or researched prospects (see src/lib/notionImport.ts, src/lib/researchImport.ts). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canManagePeople(user)) return NextResponse.json({ error: "Only the owner can import leads" }, { status: 403 });

  const size = Number(req.headers.get("content-length") ?? 0);
  if (size > MAX_BYTES) return NextResponse.json({ error: "File is too large (max 4 MB)" }, { status: 413 });

  const body = await req.json().catch(() => null);
  const rows = Array.isArray(body) ? body : Array.isArray(body?.rows) ? body.rows : null;
  if (!rows) return NextResponse.json({ error: "Expected a JSON array of Notion rows" }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `At most ${MAX_ROWS} rows per import` }, { status: 400 });
  if (!rows.every((r: unknown) => r && typeof r === "object" && !Array.isArray(r))) {
    return NextResponse.json({ error: "Every row must be an object" }, { status: 400 });
  }

  return NextResponse.json(isResearchFile(rows) ? await importResearchRows(rows) : await importNotionRows(rows));
}
