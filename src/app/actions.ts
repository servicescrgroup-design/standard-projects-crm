"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { endSession, requireUser, startSession } from "@/lib/server/session";
import {
  INVITE_DAYS,
  LOGIN_WINDOW_MINUTES,
  MAX_FAILED_LOGINS,
  hashPassword,
  hashToken,
  newInviteToken,
  passwordProblem,
  verifyPassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/server/activities";
import { sanitizeLayout } from "@/lib/analytics";
import { sanitizeConfig } from "@/lib/reports";
import { canAssignTo, canManageGoals, canManagePeople, canSeeLead, wouldLeaveNoOwner } from "@/lib/access";
import {
  CLOSED_STAGES,
  DAY_MS,
  GOAL_METRICS,
  GOAL_PERIODS,
  isActivityType,
  isOutcome,
  isPriority,
  isRole,
  isSource,
  isStage,
  SOURCE_LABELS,
  toMinor,
  type GoalMetric,
  type GoalPeriod,
} from "@/lib/domain";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}


/** "1", "3", "7", "14" = days from now; otherwise a yyyy-mm-dd date; empty = let the cadence decide. */
function parseFollowUp(raw: string): Date | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const d = new Date(Date.now() + Number(raw) * DAY_MS);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const d = new Date(`${raw}T09:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadVisibleLead(leadId: string) {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) throw new Error("Lead not found");
  return { user, lead };
}

function revalidateAll(leadId?: string) {
  revalidatePath("/today");
  revalidatePath("/leads");
  revalidatePath("/team");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

/** Sales reps start on their Workspace; owners and team leads on the Dashboard. */
const homeFor = (role: string) => (role === "REP" ? "/workspace" : "/dashboard");

export type SignInResult = { error?: string };

const GENERIC_SIGN_IN_ERROR = "Wrong email or password";

export async function signIn(_prev: SignInResult, fd: FormData): Promise<SignInResult> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password" };

  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
  const recentFailures = await db.loginAttempt.count({ where: { email, createdAt: { gte: since } } });
  if (recentFailures >= MAX_FAILED_LOGINS) {
    return { error: `Too many attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user?.passwordHash || !ok) {
    await db.loginAttempt.create({ data: { email } });
    return { error: GENERIC_SIGN_IN_ERROR };
  }
  await db.loginAttempt.deleteMany({ where: { email } });
  await startSession({ id: user.id, passwordHash: user.passwordHash });
  redirect(homeFor(user.role));
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export type InviteResult = { error?: string };

/** Sets a password from a one-time invite link, then signs the person in. */
export async function acceptInvite(_prev: InviteResult, fd: FormData): Promise<InviteResult> {
  const token = str(fd, "token");
  const password = String(fd.get("password") ?? "");
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The passwords don't match" };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "This link has expired or was already used. Ask the owner for a new one." };
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db.$transaction([
    db.user.update({ where: { id: invite.userId }, data: { passwordHash } }),
    db.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    // Any other outstanding links for this person stop working too.
    db.invite.deleteMany({ where: { userId: invite.userId, usedAt: null, id: { not: invite.id } } }),
  ]);
  await startSession({ id: user.id, passwordHash });
  redirect(homeFor(user.role));
}

async function inviteLink(userId: string): Promise<string> {
  const { token, tokenHash } = newInviteToken();
  await db.invite.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS) },
  });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/invite/${token}`;
}

export async function quickLog(fd: FormData) {
  const leadId = str(fd, "leadId");
  const type = str(fd, "type");
  const outcome = str(fd, "outcome");
  if (!isActivityType(type)) throw new Error("Pick what you did");
  const { user } = await loadVisibleLead(leadId);

  await logActivity({
    leadId,
    userId: user.id,
    type,
    outcome: isOutcome(outcome) ? outcome : null,
    summary: str(fd, "summary") || null,
    occurredAt: new Date(),
    nextFollowUpAt: parseFollowUp(str(fd, "followUp")),
  });
  revalidateAll(leadId);
  const back = str(fd, "redirectTo");
  if (back.startsWith("/")) redirect(back);
}

export async function createLead(fd: FormData) {
  const user = await requireUser();
  const company = str(fd, "company");
  if (!company) throw new Error("Company name is required");

  // Reps always own what they add. Managers can assign on creation.
  let ownerId: string | null = user.id;
  const requested = str(fd, "ownerId");
  if (user.role !== "REP") {
    const assignee = requested ? await db.user.findUnique({ where: { id: requested } }) : null;
    ownerId = requested === "" ? null : assignee && canAssignTo(user, assignee) ? assignee.id : user.id;
  }

  const lead = await db.lead.create({
    data: {
      company,
      contactName: str(fd, "contactName") || null,
      email: str(fd, "email").toLowerCase() || null,
      phone: str(fd, "phone") || null,
      website: str(fd, "website") || null,
      location: str(fd, "location") || null,
      industry: str(fd, "industry") || null,
      serviceInterest: str(fd, "serviceInterest") || null,
      priority: isPriority(str(fd, "priority")) ? str(fd, "priority") : null,
      segment: str(fd, "segment") || null,
      source: isSource(str(fd, "source")) ? str(fd, "source") : "MANUAL",
      value: toMinor(str(fd, "value")),
      monthlyValue: toMinor(str(fd, "monthlyValue")),
      ownerId,
      nextFollowUpAt: parseFollowUp(str(fd, "followUp")),
    },
  });
  revalidateAll();
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(fd: FormData) {
  const leadId = str(fd, "leadId");
  const { user, lead } = await loadVisibleLead(leadId);
  const priority = str(fd, "priority");
  const data: Record<string, unknown> = {
    priority: isPriority(priority) ? priority : null,
    segment: str(fd, "segment") || null,
    package: str(fd, "package") || null,
    budget: toMinor(str(fd, "budget")),
    needs: str(fd, "needs") || null,
    notes: str(fd, "notes") || null,
    lostReason: str(fd, "lostReason") || null,
    contactName: str(fd, "contactName") || null,
    email: str(fd, "email").toLowerCase() || null,
    phone: str(fd, "phone") || null,
    website: str(fd, "website") || null,
    value: toMinor(str(fd, "value")),
    monthlyValue: toMinor(str(fd, "monthlyValue")),
  };

  const stage = str(fd, "stage");
  if (isStage(stage) && stage !== lead.stage) {
    data.stage = stage;
    data.stageChangedAt = new Date();
    if (CLOSED_STAGES.includes(stage)) data.nextFollowUpAt = null;
  }

  if (fd.has("ownerId")) {
    const requested = str(fd, "ownerId");
    if ((requested || null) !== lead.ownerId) {
      const assignee = requested ? await db.user.findUnique({ where: { id: requested } }) : null;
      if (requested && !assignee) throw new Error("Unknown user");
      if (!canAssignTo(user, assignee)) throw new Error("You can't reassign this lead");
      data.ownerId = assignee?.id ?? null;
    }
  }

  await db.lead.update({ where: { id: leadId }, data });
  revalidateAll(leadId);
}

/** For leads that hit the unanswered-touch limit: start a fresh round, or close as lost. */
export async function decideLead(fd: FormData) {
  const leadId = str(fd, "leadId");
  await loadVisibleLead(leadId);
  const decision = str(fd, "decision");
  if (decision === "close") {
    await db.lead.update({
      where: { id: leadId },
      data: { stage: "LOST", stageChangedAt: new Date(), nextFollowUpAt: null },
    });
  } else {
    await db.lead.update({
      where: { id: leadId },
      data: { unansweredTouches: 0, nextFollowUpAt: new Date(Date.now() + 30 * DAY_MS) },
    });
  }
  revalidateAll(leadId);
}

export async function setGoal(fd: FormData) {
  const user = await requireUser();
  const target = await db.user.findUnique({ where: { id: str(fd, "userId") } });
  if (!target || !canManageGoals(user, target)) throw new Error("You can't set goals for this person");
  const metric = str(fd, "metric") as GoalMetric;
  const period = str(fd, "period") as GoalPeriod;
  if (!GOAL_METRICS.includes(metric) || !GOAL_PERIODS.includes(period)) throw new Error("Invalid goal");
  const value = Math.max(0, Math.round(Number(str(fd, "target")) || 0));

  if (value === 0) {
    await db.goal.deleteMany({ where: { userId: target.id, metric, period } });
  } else {
    await db.goal.upsert({
      where: { userId_metric_period: { userId: target.id, metric, period } },
      create: { userId: target.id, metric, period, target: value },
      update: { target: value },
    });
  }
  revalidatePath("/team");
}

// ---------- People & teams (owner only) ----------

async function requireOwner() {
  const user = await requireUser();
  if (!canManagePeople(user)) throw new Error("Only the owner can manage people and teams");
  return user;
}

export type FormResult = { error?: string; ok?: boolean; link?: string; linkFor?: string; message?: string };

/** "" = no team; otherwise the id must exist. Returns undefined for an unknown team. */
async function resolveTeamId(raw: string): Promise<string | null | undefined> {
  if (!raw) return null;
  return (await db.team.findUnique({ where: { id: raw } }))?.id;
}

function revalidatePeople() {
  revalidatePath("/settings");
  revalidatePath("/team");
  revalidatePath("/leads");
}

export async function createTeam(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const name = str(fd, "name");
  if (!name) return { error: "Team name is required" };
  await db.team.create({ data: { name } });
  revalidatePeople();
  return { ok: true };
}

export async function renameTeam(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const name = str(fd, "name");
  if (!name) return { error: "Team name is required" };
  await db.team.update({ where: { id: str(fd, "teamId") }, data: { name } });
  revalidatePeople();
  return { ok: true };
}

/** Deleting a team keeps its people; they just become team-less. */
export async function deleteTeam(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const id = str(fd, "teamId");
  await db.$transaction([
    db.user.updateMany({ where: { teamId: id }, data: { teamId: null } }),
    db.team.delete({ where: { id } }),
  ]);
  revalidatePeople();
  return { ok: true };
}

export async function addPerson(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Name and a valid email are required" };
  if (!isRole(role)) return { error: "Invalid role" };
  if (await db.user.findUnique({ where: { email } })) return { error: `${email} is already in the CRM` };
  const teamId = await resolveTeamId(str(fd, "teamId"));
  if (teamId === undefined) return { error: "That team no longer exists" };
  const person = await db.user.create({ data: { name, email, role, teamId } });
  revalidatePeople();
  return { ok: true, link: await inviteLink(person.id), linkFor: person.name };
}

export async function updatePerson(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const id = str(fd, "userId");
  const role = str(fd, "role");
  if (!isRole(role)) return { error: "Invalid role" };
  const everyone = await db.user.findMany({ select: { id: true, role: true } });
  if (wouldLeaveNoOwner(everyone, id, role)) return { error: "There must always be at least one owner" };
  const teamId = await resolveTeamId(str(fd, "teamId"));
  if (teamId === undefined) return { error: "That team no longer exists" };
  await db.user.update({ where: { id }, data: { role, teamId } });
  revalidatePeople();
  return { ok: true };
}

/** Removing someone returns their leads to the unassigned pool; their logged history stays. */
export async function removePerson(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const me = await requireOwner();
  const id = str(fd, "userId");
  if (id === me.id) return { error: "You can't remove yourself" };
  const everyone = await db.user.findMany({ select: { id: true, role: true } });
  if (wouldLeaveNoOwner(everyone, id, null)) return { error: "There must always be at least one owner" };
  await db.$transaction([
    db.lead.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
    db.activity.updateMany({ where: { userId: id }, data: { userId: null } }),
    db.user.delete({ where: { id } }),
  ]);
  revalidatePeople();
  return { ok: true };
}

/** New one-time link for someone to set (or reset) their password. Their current password keeps working until it's used. */
export async function createSignInLink(_prev: FormResult, fd: FormData): Promise<FormResult> {
  await requireOwner();
  const person = await db.user.findUnique({ where: { id: str(fd, "userId") } });
  if (!person) return { error: "Person not found" };
  return { ok: true, link: await inviteLink(person.id), linkFor: person.name };
}

/** Owners and team leads hand out leads in bulk (e.g. 50 priority-A spa leads to one rep). */
export async function assignLeads(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const user = await requireUser();
  if (user.role === "REP") return { error: "Only owners and team leads can assign leads" };
  const ids = fd.getAll("leadIds").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "Tick at least one lead first" };
  if (ids.length > 500) return { error: "Assign at most 500 leads at a time" };

  const requested = str(fd, "ownerId");
  const assignee = requested ? await db.user.findUnique({ where: { id: requested } }) : null;
  if (requested && !assignee) return { error: "Unknown person" };
  if (!canAssignTo(user, assignee)) return { error: "You can't assign leads to that person" };

  // Only leads this person can see are touched, whatever was posted.
  const leads = await db.lead.findMany({ where: { id: { in: ids } }, include: { owner: true } });
  const allowed = leads.filter((l) => canSeeLead(user, l)).map((l) => l.id);
  const { count } = await db.lead.updateMany({ where: { id: { in: allowed } }, data: { ownerId: assignee?.id ?? null } });
  revalidateAll();
  return { ok: true, message: `${count} lead${count === 1 ? "" : "s"} ${assignee ? `assigned to ${assignee.name}` : "moved to unassigned"}` };
}

/** Saves this user's dashboard widget order and visibility (validated server-side). */
export async function saveDashboardLayout(layout: unknown): Promise<FormResult> {
  const user = await requireUser();
  const clean = sanitizeLayout(layout);
  const prefs = (user.preferences && typeof user.preferences === "object" ? user.preferences : {}) as Record<string, unknown>;
  await db.user.update({ where: { id: user.id }, data: { preferences: { ...prefs, dashboard: clean } } });
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Kanban drag: moves a lead to a stage (and position in that column). Server re-checks access. */
export async function moveLeadOnBoard(leadId: string, stage: string, position: number | null): Promise<FormResult> {
  const user = await requireUser();
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead || !canSeeLead(user, lead)) return { error: "You can't move this deal." };
  if (!isStage(stage)) return { error: "Unknown stage." };
  const data: Record<string, unknown> = { boardPosition: position };
  if (stage !== lead.stage) {
    data.stage = stage;
    data.stageChangedAt = new Date();
    if (CLOSED_STAGES.includes(stage)) data.nextFollowUpAt = null;
  }
  await db.lead.update({ where: { id: leadId }, data });
  revalidatePath("/deals");
  revalidatePath("/dashboard");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Owner records marketing spend for a lead source and month (0 removes it). */
export async function saveSpend(_prev: FormResult, fd: FormData): Promise<FormResult> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can adjust spend." };
  const source = str(fd, "source");
  const month = str(fd, "month");
  if (!isSource(source)) return { error: "Pick a source." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "Pick a month." };
  const amount = toMinor(str(fd, "amount"));
  if (amount === 0) {
    await db.acquisitionSpend.deleteMany({ where: { source, month } });
  } else {
    await db.acquisitionSpend.upsert({
      where: { source_month: { source, month } },
      create: { source, month, amount, createdById: user.id },
      update: { amount, createdById: user.id },
    });
  }
  revalidatePath("/companies");
  return { ok: true, message: amount ? `Saved ${SOURCE_LABELS[source]} spend for ${month}` : `Removed ${SOURCE_LABELS[source]} spend for ${month}` };
}

/** Creates or updates a saved report. Only its owner can change it. */
export async function saveReport(input: { id?: string | null; title: string; config: unknown; shared: boolean }): Promise<FormResult & { id?: string }> {
  const user = await requireUser();
  const title = input.title.trim().slice(0, 120) || "Untitled report";
  const config = sanitizeConfig(input.config);
  if (input.id) {
    const existing = await db.report.findUnique({ where: { id: input.id } });
    if (!existing || existing.ownerId !== user.id) return { error: "You can only change your own reports. Save a copy instead." };
    await db.report.update({ where: { id: input.id }, data: { title, config, shared: input.shared } });
    revalidatePath("/reports");
    return { ok: true, id: input.id, message: "Report saved" };
  }
  const created = await db.report.create({ data: { title, config, shared: input.shared, ownerId: user.id } });
  revalidatePath("/reports");
  return { ok: true, id: created.id, message: "Report saved" };
}

export async function deleteReport(id: string): Promise<FormResult> {
  const user = await requireUser();
  const existing = await db.report.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== user.id) return { error: "You can only delete your own reports." };
  await db.report.delete({ where: { id } });
  revalidatePath("/reports");
  return { ok: true, message: "Report deleted" };
}
