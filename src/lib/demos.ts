/** Demo projects: statuses, the starter checklist and brief. Pure, unit-tested. */

export const DEMO_STATUSES = [
  { id: "TODO", label: "To do", tone: "bg-line-soft text-ink-2" },
  { id: "BUILDING", label: "Building", tone: "bg-brand-50 text-brand-700" },
  { id: "READY", label: "Ready to send", tone: "bg-amber-50 text-amber-800" },
  { id: "SENT", label: "Sent to client", tone: "bg-indigo-50 text-indigo-700" },
  { id: "INTERESTED", label: "Client interested", tone: "bg-emerald-50 text-emerald-700" },
  { id: "WON", label: "Won", tone: "bg-emerald-600 text-white" },
  { id: "LOST", label: "Not going ahead", tone: "bg-rose-50 text-rose-700" },
] as const;
export type DemoStatus = (typeof DEMO_STATUSES)[number]["id"];
/** The board's columns (won and lost demos are listed separately). */
export const BOARD_STATUSES: DemoStatus[] = ["TODO", "BUILDING", "READY", "SENT", "INTERESTED"];

export function isDemoStatus(v: unknown): v is DemoStatus {
  return DEMO_STATUSES.some((s) => s.id === v);
}

export function demoStatusInfo(v: string) {
  return DEMO_STATUSES.find((s) => s.id === v) ?? DEMO_STATUSES[0];
}

export type DemoTask = { text: string; done: boolean };

/** What usually goes into a demo; the team can edit it per project. */
export function starterTasks(industry: string | null): DemoTask[] {
  const extra: Record<string, string> = {
    Restaurant: "Add the menu and a table booking button",
    Hospitality: "Add a rooms page and a direct booking form",
    Spa: "Add the treatment menu and online booking",
    Wellness: "Add sessions/classes and online booking",
    Gym: "Add the class timetable and a free-trial form",
    Clinic: "Add treatments, the team and an appointment form",
    Trades: "Add services, areas covered and a quote form",
    "Professional-Services": "Add services, team profiles and a consultation form",
    "Export-Trading": "Add a product catalogue and a quote request form",
    Retail: "Add products, opening hours and the map",
  };
  return [
    "Collect their logo, photos and colours (website, Google, Facebook, Instagram)",
    "Build the homepage",
    extra[industry ?? ""] ?? "Add their main services and a contact form",
    "Check it on a phone",
    "Internal review",
    "Attach the offer (quote)",
  ].map((text) => ({ text, done: false }));
}

/** Starting brief, from what we know about the lead. */
export function starterBrief(lead: { company: string; website: string | null; segment: string | null; industry: string | null; needs: string | null; whyFit: string | null; location: string | null }): string {
  return [
    `Demo website for ${lead.company}${lead.location ? ` (${lead.location})` : ""}.`,
    lead.segment || lead.industry ? `Industry: ${lead.segment ?? lead.industry}.` : null,
    lead.website ? `Current website: ${lead.website}` : "They have no website yet.",
    lead.whyFit ? `Why they need it: ${lead.whyFit}` : null,
    lead.needs ? `What they want: ${lead.needs}` : null,
    "Goal: show them what their new site could look like before they've paid anything.",
  ].filter(Boolean).join("\n");
}

export function sanitizeTasks(raw: unknown): DemoTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is { text: unknown; done: unknown } => !!t && typeof t === "object")
    .map((t) => ({ text: String(t.text ?? "").trim().slice(0, 200), done: t.done === true }))
    .filter((t) => t.text)
    .slice(0, 30);
}

/** Only http(s) links can be shown to the client. */
export function cleanDemoUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function taskProgress(tasks: DemoTask[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.done).length, total: tasks.length };
}
