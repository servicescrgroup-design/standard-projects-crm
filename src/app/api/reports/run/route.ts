import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { runReportFor } from "@/lib/server/reportData";

/** Runs a report configuration over the data this user may see. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const body = await req.json().catch(() => null);
  return NextResponse.json(await runReportFor(user, body?.config));
}
