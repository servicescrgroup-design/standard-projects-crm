import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { leadScope } from "@/lib/access";
import { OPEN_STAGES, STAGE_LABELS, formatMoney, type Stage } from "@/lib/domain";
import { QUEUE_SELECT, buildQueue } from "@/lib/queue";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const SYSTEM = `You are the assistant inside the Standard Projects sales CRM (a Chiang Mai company that builds websites and business systems; money is in Thai baht).
Answer the user's question using ONLY the CRM data provided in the <crm_data> block. That data is already limited to what this user is allowed to see.
If the data doesn't contain the answer, say so plainly and suggest where in the CRM to look. Never invent leads, numbers, dates or people.
Be concise and practical: short paragraphs or bullet points, company names in bold, concrete next actions. When drafting a message to a customer, write it ready to send.`;

/** Builds a compact, permission-scoped snapshot of the CRM for this user. */
async function crmSnapshot(user: { id: string; name: string; role: string; teamId: string | null }) {
  const scope = leadScope(user);
  const [byStage, mine, recent] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], where: scope, _count: true, _sum: { value: true, monthlyValue: true } }),
    db.lead.findMany({
      where: { ownerId: user.id, stage: { in: OPEN_STAGES } },
      select: { ...QUEUE_SELECT, company: true, segment: true, contactName: true, phone: true, whyFit: true },
    }),
    db.activity.findMany({
      where: { lead: scope },
      orderBy: { occurredAt: "desc" },
      take: 40,
      select: { type: true, outcome: true, summary: true, occurredAt: true, lead: { select: { company: true } }, user: { select: { name: true } } },
    }),
  ]);
  const queue = buildQueue(mine).slice(0, 25);
  return {
    today: new Date().toISOString().slice(0, 10),
    user: { name: user.name, role: user.role },
    pipeline: byStage.map((s) => ({
      stage: STAGE_LABELS[s.stage as Stage] ?? s.stage,
      leads: s._count,
      value: formatMoney((s._sum.value ?? 0) + (s._sum.monthlyValue ?? 0) * 12),
    })),
    myTopFollowUps: queue.map((q) => ({
      company: q.lead.company,
      stage: STAGE_LABELS[q.lead.stage as Stage] ?? q.lead.stage,
      priority: q.lead.priority,
      segment: q.lead.segment,
      contact: q.lead.contactName,
      phone: q.lead.phone,
      why: q.reasons.join("; "),
      whyFit: q.lead.whyFit,
    })),
    recentActivity: recent.map((a) => ({
      when: a.occurredAt.toISOString().slice(0, 16).replace("T", " "),
      company: a.lead.company,
      by: a.user?.name ?? "automatic",
      type: a.type,
      outcome: a.outcome,
      note: a.summary?.slice(0, 200) ?? null,
    })),
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "not_connected", message: "Ask AI isn't connected yet. The owner can add an ANTHROPIC_API_KEY in Vercel to switch it on." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question) return NextResponse.json({ error: "Type a question first." }, { status: 400 });

  const snapshot = await crmSnapshot(user);
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // If Claude declines (safety classifier), the API retries once on the fallback model.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: SYSTEM,
      messages: [{ role: "user", content: `<crm_data>\n${JSON.stringify(snapshot)}\n</crm_data>\n\n${question}` }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The assistant couldn't help with that request." }, { status: 422 });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ answer: answer || "No answer was returned.", model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "The AI key is invalid. Ask the owner to check it." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The assistant is busy. Try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `The assistant failed (${e.status}).` }, { status: 502 });
    return NextResponse.json({ error: "Couldn't reach the assistant. Check your connection." }, { status: 502 });
  }
}
