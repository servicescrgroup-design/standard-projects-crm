import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { findDuplicates, phoneDigits } from "@/lib/duplicates";
import { websiteDomain } from "@/lib/matching";
import { canSeeLead } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * "Is this lead already in the CRM?" while someone types a new one. Checks every lead (not just the
 * person's own), but only says who owns a match; details are hidden unless they can see it.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ matches: [] }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const c = { company: p.get("company"), phone: p.get("phone"), email: p.get("email"), website: p.get("website") };
  const name = (c.company ?? "").trim();
  const digits = phoneDigits(c.phone);
  const domain = websiteDomain(c.website);
  const email = (c.email ?? "").trim().toLowerCase();
  if (name.length < 3 && !digits && !domain && !email.includes("@")) return NextResponse.json({ matches: [] });

  // Narrow in the database first, then match precisely.
  const firstWord = name.toLowerCase().replace(/^(the)\s+/, "").split(/\s+/)[0] ?? "";
  const candidates = await db.lead.findMany({
    where: {
      OR: [
        ...(firstWord.length >= 3 ? [{ company: { contains: firstWord, mode: "insensitive" as const } }] : []),
        ...(digits ? [{ phone: { contains: digits.slice(-7) } }] : []),
        ...(domain ? [{ website: { contains: domain, mode: "insensitive" as const } }] : []),
        ...(email.includes("@") ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    take: 300,
    select: { id: true, company: true, phone: true, email: true, website: true, ownerId: true, owner: { select: { name: true, teamId: true } } },
  });
  const found = findDuplicates(c, candidates);
  return NextResponse.json({
    matches: found.map((m) => {
      const lead = candidates.find((x) => x.id === m.id)!;
      const visible = canSeeLead(user, lead);
      return { id: visible ? m.id : null, company: m.company, why: m.why, owner: lead.owner?.name ?? "Unassigned" };
    }),
  });
}
