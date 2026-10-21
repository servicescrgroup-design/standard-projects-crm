import { ArrowRight, Zap } from "lucide-react";
import { CADENCE_DAYS, MAX_UNANSWERED_TOUCHES, PROPOSAL_FOLLOW_UP_GAPS, STAGE_LABELS, STALLED_AFTER_DAYS } from "@/lib/domain";

/** The automation rules that actually run, read from the same constants the code uses. */
const RULES = [
  { when: "A call, email, visit or meeting is logged on a new lead", then: `Stage moves to ${STAGE_LABELS.CONTACTED}` },
  { when: "A meeting is logged (or arrives from Calendar sync)", then: `Stage moves to ${STAGE_LABELS.MEETING_BOOKED}; follow-up set for the day after` },
  { when: "A proposal is logged", then: `Stage moves to ${STAGE_LABELS.PROPOSAL_SENT}; follow-ups on day ${PROPOSAL_FOLLOW_UP_GAPS.reduce<number[]>((a, g) => [...a, (a.at(-1) ?? 0) + g], []).join(", day ")}` },
  { when: `${PROPOSAL_FOLLOW_UP_GAPS.length + 1} proposal touches go unanswered`, then: "The lead asks for a decision on Today: try again in 30 days, or close as lost" },
  { when: "A call is logged as “Not interested”", then: `Stage moves to ${STAGE_LABELS.LOST}` },
  { when: "The customer replies (email in, call answered, meeting)", then: "Unanswered count resets; the lead jumps to the top of Today" },
  { when: "Anything else goes unanswered", then: `Next follow-up after ${CADENCE_DAYS.CONTACTED} days when contacted; decision after ${MAX_UNANSWERED_TOUCHES} unanswered touches` },
  { when: "Someone submits the website contact form", then: "A new unassigned lead is created, due today, with the message as a note" },
  { when: "Someone submits the Get a quote form", then: "A new unassigned lead (or the existing one with that email) gets every answer and an estimated value" },
  { when: `An open deal has no contact for ${STALLED_AFTER_DAYS}+ days`, then: "It appears under Stalled deals on the Team page" },
  { when: "A deal is dragged to Won, Maintenance or Lost", then: "Its follow-up date is cleared and the close date is recorded" },
  { when: "A lead is added to an email sequence", then: "Each email goes out from the agent's own mailbox on schedule (reps' requests need a manager's approval first)" },
  { when: "A lead in a sequence replies", then: "The sequence stops at once and whoever started it gets an alert" },
  { when: "A quote is sent", then: `A Proposal is logged: stage moves to ${STAGE_LABELS.PROPOSAL_SENT} and the deal value is set from the quote` },
  { when: "The customer opens the quote link", then: "The owner gets an alert (good moment to call)" },
  { when: "The customer accepts the quote online", then: `Stage moves to ${STAGE_LABELS.WON}, any sequence stops, and the owner and managers are alerted` },
  { when: "A new website or quote-form enquiry arrives (assignment on)", then: "It's given to the next person by your rules or in turn, who gets an alert and a response timer" },
];

export default function WorkflowsPage() {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-ink-2">These rules run automatically on every deal. They follow your “SOP Lead to Launch” process. Ask for changes to timings or new rules and they can be added here.</p>
      <ul className="space-y-2.5">
        {RULES.map((r) => (
          <li key={r.when} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <span className="flex items-center gap-2 text-sm font-medium sm:w-1/2"><Zap className="h-4 w-4 shrink-0 text-amber-500" />{r.when}</span>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-3 sm:block" />
            <span className="text-sm text-ink-2 sm:flex-1">{r.then}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
