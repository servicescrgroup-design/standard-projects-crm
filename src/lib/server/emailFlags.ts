import "server-only";
import { db } from "./db";
import { notify } from "./notifications";

/** Stops a lead's running (or waiting-for-approval) sequences and tells whoever started them. Returns who was told. */
async function stopSequences(leadId: string, status: "STOPPED" | "FAILED", reason: string, alert: (company: string) => { title: string; body: string }): Promise<Set<string>> {
  const rows = await db.sequenceEnrollment.findMany({
    where: { leadId, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } },
    select: { id: true, enrolledById: true, lead: { select: { company: true } } },
  });
  const told = new Set(rows.map((r) => r.enrolledById));
  if (!rows.length) return told;
  await db.sequenceEnrollment.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status, stopReason: reason, nextRunAt: null } });
  for (const uid of told) {
    await notify(uid, { type: "SEQUENCE_REPLY", ...alert(rows[0].lead.company), href: `/leads/${leadId}#email` });
  }
  return told;
}

/** Never email this lead again (until someone removes the mark). */
export async function markOptOut(leadId: string, reason: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { emailOptOutAt: true } });
  if (!lead || lead.emailOptOutAt) return;
  await db.lead.update({ where: { id: leadId }, data: { emailOptOutAt: new Date(), emailOptOutReason: reason.slice(0, 300) } });
  await stopSequences(leadId, "STOPPED", "Asked not to be emailed", (company) => ({
    title: `${company} asked not to be emailed again`,
    body: "They're marked “Do not email”, so no more sequence or manual emails will go to them.",
  }));
}

export async function clearOptOut(leadId: string) {
  await db.lead.update({ where: { id: leadId }, data: { emailOptOutAt: null, emailOptOutReason: null } });
}

/** The lead's address bounced: stop emailing it until the address is changed. */
export async function markBounced(leadId: string, reason: string) {
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { emailBouncedAt: true, ownerId: true, company: true } });
  if (!lead || lead.emailBouncedAt) return;
  await db.lead.update({ where: { id: leadId }, data: { emailBouncedAt: new Date(), emailBounceReason: reason.slice(0, 300) } });
  const told = await stopSequences(leadId, "FAILED", "Email bounced", (company) => ({
    title: `Email to ${company} bounced`,
    body: `${reason}. Find a working address (or call them) and update the lead.`,
  }));
  if (lead.ownerId && !told.has(lead.ownerId)) {
    await notify(lead.ownerId, { type: "SEQUENCE_REPLY", title: `${lead.company}: email address bounced`, body: `${reason}. Update the email address on the lead.`, href: `/leads/${leadId}` });
  }
}
