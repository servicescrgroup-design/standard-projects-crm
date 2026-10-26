import { requireUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { canManagePeople } from "@/lib/access";
import { OPEN_STAGES } from "@/lib/domain";
import { AddPersonForm, CreateTeamForm, PersonRow, TeamRow } from "@/components/SettingsForms";
import { ImportLeads } from "@/components/ImportLeads";
import { MailboxSettings } from "@/components/email/MailboxSettings";
import { isProviderConfigured } from "@/lib/mail/oauth";
import { TwilioSettings } from "@/components/voice/TwilioSettings";
import { PriceList } from "@/components/settings/PriceList";
import { FillIndustries } from "@/components/settings/FillIndustries";
import { AgentsSendToggle } from "@/components/email/AgentsSendToggle";
import { agentsSendDirect } from "@/lib/server/emailPolicy";
import { missingIndustryPlan } from "@/lib/server/industries";
import { AssignmentSettings } from "@/components/settings/AssignmentSettings";
import { getAssignment } from "@/lib/server/assignment";
import { leadFacets } from "@/lib/server/leadFilters";
import { SOURCES, SOURCE_LABELS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const user = await requireUser();
  const isOwner = canManagePeople(user);
  const { email: emailStatus } = await searchParams;
  const mailboxes = await db.mailbox.findMany({
    where: { userId: user.id },
    select: { provider: true, address: true, status: true, lastError: true, lastSyncAt: true },
  });
  const twilio = await db.twilioConnection.findUnique({ where: { userId: user.id }, select: { callerId: true, accountSid: true, record: true } });
  const phoneSection = (
    <section id="phone" className="card scroll-mt-24 p-4">
      <h2 className="font-semibold">Phone &amp; meetings</h2>
      <p className="mb-3 text-sm text-ink-3">How you call leads from the CRM. Meetings use a free video room (no app to install) with notes saved to the lead.</p>
      <TwilioSettings connection={twilio} />
    </section>
  );
  const emailSection = (
    <section id="email" className="card scroll-mt-24 p-4">
      <h2 className="font-semibold">Email</h2>
      <p className="mb-3 text-sm text-ink-3">
        Connect your own mailbox. Emails with your leads are logged on each lead automatically every 10 minutes
        (other mail is never imported), and you can send emails from lead pages.
      </p>
      <MailboxSettings
        status={emailStatus ?? null}
        configured={{ GMAIL: isProviderConfigured("GMAIL"), OUTLOOK: isProviderConfigured("OUTLOOK") }}
        mailboxes={mailboxes.map((m) => ({ ...m, lastSyncAt: m.lastSyncAt?.toISOString() ?? null }))}
      />
      {isOwner && <AgentsSendToggle initial={await agentsSendDirect()} />}
    </section>
  );
  if (!isOwner) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
          <p className="text-sm text-ink-3">Your email connection. Teams and people are managed by the owner.</p>
        </div>
        {emailSection}
        {phoneSection}
      </div>
    );
  }

  const [assignment, prices, facets, industryPlan] = await Promise.all([
    getAssignment(),
    db.priceItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    leadFacets(user),
    missingIndustryPlan(),
  ]);
  const [teamRows, people] = await Promise.all([
    db.team.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    db.user.findMany({
      include: { _count: { select: { leads: { where: { stage: { in: OPEN_STAGES } } } } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);
  const teams = teamRows.map((t) => ({ id: t.id, name: t.name, memberCount: t._count.users }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-ink-3">Your email connection, teams and who can see what.</p>
      </div>

      {emailSection}
      {phoneSection}

      <section id="assignment" className="card scroll-mt-24 p-4">
        <h2 className="font-semibold">Lead assignment</h2>
        <p className="mb-3 text-sm text-ink-3">Give every new website or quote-form enquiry to someone straight away, so nobody misses it and nobody argues over it.</p>
        <AssignmentSettings
          initial={assignment}
          people={people.map((p) => ({ id: p.id, name: p.name }))}
          countries={facets.countries.map((c) => c.name)}
          industries={facets.industries.map((i) => i.name).filter((n) => n !== "none")}
          sources={SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
        />
      </section>

      <section id="prices" className="card scroll-mt-24 p-4">
        <h2 className="font-semibold">Price list</h2>
        <p className="mb-3 text-sm text-ink-3">Your packages, add-ons and monthly plans. Agents pick from these when building a quote and can still adjust prices on each quote.</p>
        <PriceList items={prices.map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.price, monthly: p.monthly }))} />
      </section>

      <section id="import" className="card scroll-mt-24 p-4">
        <h2 className="font-semibold">Import leads</h2>
        <p className="mb-3 text-sm text-ink-3">
          Upload a spreadsheet (.csv with a header row: Company, Contact, Email, Phone, Website, Location, Country,
          Industry, Segment, Priority, Source, Stage, Value, Notes), or a Notion &ldquo;Customers CRM&rdquo; export (.json). New companies arrive unassigned. Companies already in the CRM
          (same phone or name) keep their owner and stage and just get the missing Notion details. Importing the same file
          twice is safe. You can also upload an international prospects list (.json); those arrive as unassigned
          cold-outreach leads, skipping any website already in the CRM.
        </p>
        <ImportLeads />
      </section>

      <section id="industries" className="card scroll-mt-24 p-4">
        <h2 className="font-semibold">Missing industries</h2>
        <p className="mb-3 text-sm text-ink-3">Industry decides which email templates agents are offered, so leads without one only get general templates.</p>
        <FillIndustries
          missing={industryPlan.missing}
          guesses={[...industryPlan.bySegment].map(([segment, ids]) => ({ segment, count: ids.length })).sort((a, b) => b.count - a.count)}
        />
      </section>

      <section className="card">
        <div className="border-b border-line-soft px-4 py-3">
          <h2 className="font-semibold">Teams</h2>
          <p className="text-sm text-ink-3">A team lead sees and manages everyone in their team.</p>
        </div>
        <ul className="divide-y divide-line-soft">
          {teams.map((t) => (
            <TeamRow key={t.id} team={t} />
          ))}
          {teams.length === 0 && <li className="px-4 py-3 text-sm text-ink-3">No teams yet.</li>}
        </ul>
        <div className="border-t border-line-soft p-4">
          <CreateTeamForm />
        </div>
      </section>

      <section className="card">
        <div className="border-b border-line-soft px-4 py-3">
          <h2 className="font-semibold">People</h2>
          <p className="text-sm text-ink-3">
            Owners see everything. Team leads see their team and unassigned leads. Reps see only their own leads.
          </p>
        </div>
        <ul className="divide-y divide-line-soft">
          {people.map((p) => (
            <PersonRow
              key={p.id}
              isMe={p.id === user.id}
              teams={teams}
              person={{ id: p.id, name: p.name, email: p.email, role: p.role, teamId: p.teamId, openLeads: p._count.leads, hasPassword: !!p.passwordHash }}
            />
          ))}
        </ul>
        <div className="border-t border-line-soft p-4">
          <h3 className="mb-3 text-sm font-semibold">Add a person</h3>
          <AddPersonForm teams={teams} />
        </div>
      </section>
    </div>
  );
}
