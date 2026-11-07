/**
 * Fills Lead.country for leads that don't have it yet (run once after migration 0015, and any time
 * leads were inserted by SQL, e.g. the website-enquiry trigger). Safe to re-run.
 *   npm run db:backfill-country
 */
import { PrismaClient } from "@prisma/client";
import { countryOfLead } from "../src/lib/countries";

async function main() {
  const db = new PrismaClient();
  const leads = await db.lead.findMany({ where: { country: null }, select: { id: true, location: true, industry: true, phone: true, company: true } });
  const byCode = new Map<string, string[]>();
  for (const l of leads) {
    const code = countryOfLead(l)?.code;
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), l.id]);
  }
  let n = 0;
  for (const [code, ids] of byCode) {
    for (let i = 0; i < ids.length; i += 500) n += (await db.lead.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { country: code } })).count;
  }
  console.log(`${leads.length} leads without a country checked; ${n} set; ${leads.length - n} have no detectable country.`);
  await db.$disconnect();
}
main();
