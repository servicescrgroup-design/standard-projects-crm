// Fictional demo data (people and companies) for trying the app. Wipes the database first.
// Run with `npm run db:demo`; `npm run db:seed` resets to just the owner.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);
const daysAhead = (d: number) => new Date(now + d * DAY);

async function main() {
  if (process.env.ALLOW_DEMO_WIPE !== "yes") {
    throw new Error("This deletes ALL data in the database. Re-run with ALLOW_DEMO_WIPE=yes if you're sure.");
  }
  await db.activity.deleteMany();
  await db.invite.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.goal.deleteMany();
  await db.lead.deleteMany();
  await db.user.deleteMany();
  await db.team.deleteMany();

  const sales = await db.team.create({ data: { name: "Sales" } });
  const owner = await db.user.create({ data: { name: "Olivia Owner", email: "owner@example.com", role: "OWNER" } });
  const lead = await db.user.create({
    data: { name: "Tara Lead", email: "lead@example.com", role: "TEAM_LEAD", teamId: sales.id },
  });
  const rep1 = await db.user.create({ data: { name: "Ravi Rep", email: "rep1@example.com", role: "REP", teamId: sales.id } });
  const rep2 = await db.user.create({
    data: { name: "Sam Rep", email: "rep2@example.com", role: "REP", teamId: sales.id },
  });
  const reps = [lead, rep1, rep2];

  const companies: [string, string, string, number, number][] = [
    // company, industry, stage, value (£), monthly (£)
    ["Northgate Roofing Ltd", "Construction & property", "PROPOSAL_SENT", 2499, 49],
    ["Brightwell Electrical", "Trades", "PROPOSAL_SENT", 1800, 0],
    ["Hartley Groundworks", "Construction & property", "MEETING_BOOKED", 3200, 79],
    ["Oakfield Joinery", "Trades", "CONTACTED", 1200, 0],
    ["Riverside Plumbing & Heating", "Trades", "CONTACTED", 950, 29],
    ["Kestrel Scaffolding", "Construction & property", "CONTACTED", 2100, 0],
    ["Meadow Landscapes", "Landscaping", "NEW", 0, 0],
    ["Pembroke Builders", "Construction & property", "NEW", 0, 0],
    ["Summit Fire Protection", "Trades", "CONTACTED", 1600, 39],
    ["Ashdown Cleaning Group", "Facilities", "CONTACTED", 800, 25],
    ["Cobalt Kitchens", "Trades", "MEETING_BOOKED", 2800, 0],
    ["Fenwick Lofts", "Construction & property", "NEW", 0, 0],
    ["Granite & Co Paving", "Landscaping", "CONTACTED", 1100, 0],
    ["Lumen Glazing", "Trades", "PROPOSAL_SENT", 3900, 99],
    ["Wexford Developments", "Construction & property", "WON", 4500, 99],
    ["Thornbury Decorators", "Trades", "WON", 1500, 29],
    ["Ironbridge Steel", "Construction & property", "LOST", 2000, 0],
    ["Larkspur Gardens", "Landscaping", "CONTACTED", 700, 0],
  ];

  for (const [i, [company, industry, stage, value, monthly]] of companies.entries()) {
    const owner = reps[i % reps.length];
    const slug = company.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 16);
    const closed = stage === "WON" || stage === "LOST";
    const touches = stage === "CONTACTED" && i % 4 === 0 ? 6 : i % 3;
    const lead = await db.lead.create({
      data: {
        company,
        industry,
        stage,
        contactName: ["Alex Morgan", "Tom Reid", "Priya Shah", "Sarah Lowe", "Dan Price"][i % 5],
        email: `hello@${slug}.co.uk`,
        phone: `07700 900${String(100 + i).slice(-3)}`,
        website: `https://www.${slug}.co.uk`,
        location: ["London", "Kent", "Essex", "Surrey", "Herts"][i % 5],
        serviceInterest: ["Website", "CRM", "Back-office"][i % 3],
        value: value * 100,
        monthlyValue: monthly * 100,
        ownerId: i === 7 || i === 11 ? null : owner.id, // two unassigned leads for the team lead to hand out
        unansweredTouches: closed ? 0 : touches,
        stageChangedAt: daysAgo(i % 20),
        lastContactAt: stage === "NEW" ? null : daysAgo((i * 3) % 25),
        lastReplyAt: i === 4 || i === 9 ? daysAgo(0.2) : null,
        nextFollowUpAt: closed || stage === "NEW" ? null : i % 5 === 0 ? daysAhead(4) : daysAgo((i * 2) % 9),
      },
    });

    if (stage === "NEW") continue;
    // A few activities per lead spread across the last fortnight.
    const types = ["CALL", "EMAIL_OUT", "CALL", "MEETING", "EMAIL_OUT"];
    for (let k = 0; k < 1 + (i % 4); k++) {
      const type = types[(i + k) % types.length];
      await db.activity.create({
        data: {
          leadId: lead.id,
          userId: owner.id,
          type,
          outcome: type === "CALL" ? ["CONNECTED", "NO_ANSWER", "VOICEMAIL"][(i + k) % 3] : null,
          summary:
            type === "MEETING" ? "Discovery call: walked through current process" : type === "CALL" ? null : "Follow-up email",
          source: type === "EMAIL_OUT" ? "GMAIL" : type === "MEETING" ? "CALENDAR" : "MANUAL",
          occurredAt: daysAgo((i + k * 3) % 14),
        },
      });
    }
  }

  const goals = [
    { metric: "CALLS", period: "WEEK", target: 25 },
    { metric: "EMAILS", period: "WEEK", target: 30 },
    { metric: "MEETINGS", period: "WEEK", target: 3 },
    { metric: "REVENUE_WON", period: "MONTH", target: 5000 },
  ];
  for (const r of reps) {
    for (const g of goals) await db.goal.create({ data: { ...g, userId: r.id } });
  }

  console.log(`Seeded ${companies.length} leads, ${reps.length + 1} users. Owner: ${owner.email}. Demo users have no passwords; create sign-in links in Settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
