/** The first sign-in walkthrough: which page, what to point at, and what to say. */

export type TourStep = {
  path: string; // page the step lives on
  target?: string; // [data-tour="…"] or a CSS selector; none = a centred card
  title: string;
  body: string;
};

export function tourSteps(name: string, role: string): TourStep[] {
  const first = name.split(/\s+/)[0] || "there";
  const manager = role === "OWNER" || role === "TEAM_LEAD";
  return [
    {
      path: "/workspace",
      title: `Welcome to Standard Projects CRM, ${first}! 👋`,
      body: "This 2-minute tour shows you where everything is. Follow the pointer, or use the arrow keys. You can replay it any time from Help Center.",
    },
    { path: "/workspace", target: "nav-workspace", title: "Your Workspace", body: "Your home base. Start every day here: today's meetings, who to call, your new leads and your goals, all on one screen." },
    { path: "/workspace", target: "schedule", title: "Today's schedule", body: "Meetings you've logged for today, on a timeline. The black line is now. Click a meeting to open the customer." },
    { path: "/workspace", target: "tasks", title: "Your day's tasks", body: "Everyone you should contact today, most important first: replies waiting for you, proposals to chase, first calls. Change the stage right on the card, or press Call / Email." },
    { path: "/workspace", target: "new-task", title: "New Task", body: "Set yourself a reminder on any lead, e.g. \"send revised quote on Friday\". It appears in your tasks on that day." },
    { path: "/workspace", target: "new-leads", title: "New leads", body: "Leads just given to you. The dots show how promising they are (5 = hot). Brand-new website enquiries also show a red timer: reply within 15 minutes, because the first business to answer usually wins." },
    { path: "/workspace", target: "summary", title: "Next up & your goals", body: "Your next call with one-tap Call / Email, what you've done today, and progress towards your weekly goals." },
    { path: "/workspace", target: "bell", title: "Alerts", body: "New enquiries assigned to you, customer replies, and when a customer opens or accepts your quote. Allow desktop alerts when asked so you never miss one." },
    { path: "/contacts", target: "contact-tabs", title: "Contacts", body: "Everyone you can talk to. Tick industries here, filter by country, then tick contacts to export them or add them to an email sequence." },
    { path: "/deals", target: "deal-board", title: "Deals board", body: "Every deal by stage, from Lead to Won. Drag a card to move it. Stages also move on their own when you log calls, meetings and proposals." },
    {
      path: "/outreach",
      target: "sequences",
      title: "Email sequences",
      body: manager
        ? "Automatic follow-up emails sent from your own mailbox, days apart. They stop the moment someone replies. You approve sequences your reps request on the Emails page."
        : "Automatic follow-up emails sent from your own mailbox, days apart, that stop the moment someone replies. Choose one on a lead, or tick several contacts; a manager approves it before the first email goes.",
    },
    {
      path: "/workspace",
      title: "On every lead",
      body: "Open any lead to find: Call (with a notes panel), Meeting (free video room plus notes), Send email with templates, Sequence, and Quotes. Build a quote from the price list and send the customer a link they can accept online, which marks the deal Won.",
    },
    { path: "/workspace", target: "ask-ai", title: "Ask AI", body: "Ask questions about your pipeline in plain language, e.g. \"which proposals have gone quiet this week?\"" },
    { path: "/settings", target: "#email", title: "One last thing: connect your email", body: "Connect Gmail or Outlook here. Emails with your leads are then logged automatically, and you can send emails and sequences from the CRM. It takes 30 seconds." },
    { path: "/settings", target: "nav-help", title: "You're all set! 🎉", body: "Replay this tour any time from Help Center. Good luck with your first deals!" },
  ];
}

export function tourSelector(target: string): string {
  return /^[#.[]/.test(target) ? target : `[data-tour="${target}"]`;
}
