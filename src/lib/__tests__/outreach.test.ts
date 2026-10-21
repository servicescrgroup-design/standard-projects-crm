import { describe, expect, it } from "vitest";
import { OPT_OUT_LINE, firstName, leadMergeContext, missingFields, rankTemplates, renderTemplate, starterTemplate, templateFit, templateLanguage } from "../templates";
import { nextRunAt, stopReason } from "../sequences";
import { quoteNumber, quoteTotals, sanitizeItems, isExpired } from "../quotes";
import { pickAssignee, sanitizeAssignment, waitingFor } from "../assignment";
import { companyKey, findDuplicates, phoneDigits } from "../duplicates";

const lead = {
  company: "Green Leaf Spa",
  contactName: "Khun Ploy Srisuk",
  location: "Austin, TX, United States",
  website: "https://www.greenleafspa.com/home",
  industry: "Day spa",
  segment: "Spa",
  whyFit: "Facebook page only, 180 Google reviews",
  serviceInterest: "New website",
};

describe("templates", () => {
  it("fills merge fields from the lead and agent", () => {
    const ctx = leadMergeContext(lead, { name: "Richard Jones", email: "r@x.com" });
    expect(ctx).toMatchObject({ first_name: "Ploy", city: "Austin", country: "United States", website: "greenleafspa.com", agent_name: "Richard" });
    expect(renderTemplate("Hi {{first_name|there}}, I saw {{company}} in {{ city }}.", ctx)).toBe("Hi Ploy, I saw Green Leaf Spa in Austin.");
  });
  it("uses fallbacks, drops unknown fields and lines left empty", () => {
    expect(renderTemplate("Hi {{first_name|there}},\n{{why_fit}}\n\nThanks", { company: "X" })).toBe("Hi there,\n\nThanks");
    expect(missingFields("Hi {{first_name|there}} {{why_fit}} {{company}}", { company: "X" })).toEqual(["why_fit"]);
  });
  it("skips titles in first names", () => {
    expect(firstName("Dr. Anna Weber")).toBe("Anna");
    expect(firstName(null)).toBe("");
  });
});

describe("sequences", () => {
  const e = { status: "ACTIVE", stepIndex: 1, createdAt: new Date("2026-10-01T03:00:00Z"), lastSentAt: null };
  const l = { stage: "CONTACTED", email: "a@b.com", lastReplyAt: null, country: "United States" };
  it("stops on reply, closed deals, missing email and completion", () => {
    expect(stopReason(e, { ...l, lastReplyAt: new Date("2026-10-02T00:00:00Z") }, 3)?.status).toBe("REPLIED");
    expect(stopReason(e, { ...l, lastReplyAt: new Date("2026-09-01T00:00:00Z") }, 3)).toBeNull();
    expect(stopReason(e, { ...l, stage: "WON" }, 3)?.status).toBe("STOPPED");
    expect(stopReason(e, { ...l, email: null }, 3)?.status).toBe("FAILED");
    expect(stopReason({ ...e, stepIndex: 3 }, l, 3)?.status).toBe("COMPLETED");
  });
  it("schedules the next step in working hours and never in the past", () => {
    const from = new Date(2026, 9, 21, 22, 30);
    const next = nextRunAt(from, 3, new Date(2026, 9, 21, 22, 31));
    expect([next.getDate(), next.getHours()]).toEqual([25, 9]);
    const now = new Date(2026, 9, 21, 10);
    expect(nextRunAt(new Date(2026, 9, 1), 0, now)).toEqual(now);
  });
});

describe("quotes", () => {
  const items = sanitizeItems([
    { name: "Business website", qty: 1, unitPrice: 4_500_000 },
    { name: "Care plan", qty: 1, unitPrice: 150_000, monthly: true },
    { name: "Extra page", qty: 2, unitPrice: 300_000 },
    { name: "  ", qty: 1, unitPrice: 1 },
  ]);
  it("totals one-off and monthly, discount only on one-off", () => {
    expect(items).toHaveLength(3);
    expect(quoteTotals(items, 600_000)).toEqual({ oneOffGross: 5_100_000, discount: 600_000, oneOff: 4_500_000, monthly: 150_000, firstYear: 4_500_000 + 1_800_000 });
    expect(quoteTotals(items, 99_999_999).oneOff).toBe(0);
  });
  it("numbers and expiry", () => {
    expect(quoteNumber(2026, 7)).toBe("Q-2026-0007");
    expect(isExpired(new Date(2026, 9, 20), new Date(2026, 9, 21))).toBe(true);
    expect(isExpired(new Date(2026, 9, 21), new Date(2026, 9, 21, 20))).toBe(false);
  });
});

describe("assignment", () => {
  const s = sanitizeAssignment({ mode: "ROUND_ROBIN", pool: ["a", "b", "ghost"], rules: [{ field: "country", value: "Germany", userId: "c" }] }, ["a", "b", "c"]);
  it("drops unknown people", () => expect(s.pool).toEqual(["a", "b"]));
  it("applies rules first, then rotates", () => {
    expect(pickAssignee({ country: "germany", industry: null }, s, 0)).toMatchObject({ userId: "c", pointer: 0 });
    const first = pickAssignee({ country: "Thailand", industry: null }, s, 0)!;
    const second = pickAssignee({ country: "Thailand", industry: null }, s, first.pointer)!;
    const third = pickAssignee({ country: "Thailand", industry: null }, s, second.pointer)!;
    expect([first.userId, second.userId, third.userId]).toEqual(["a", "b", "a"]);
  });
  it("does nothing when off", () => expect(pickAssignee({ country: null, industry: null }, { ...s, mode: "OFF" }, 0)).toBeNull());
  it("formats waiting time", () => {
    const now = new Date(2026, 9, 21, 12, 0);
    expect(waitingFor(new Date(2026, 9, 21, 11, 53), now)).toBe("7 min");
    expect(waitingFor(new Date(2026, 9, 21, 10, 40), now)).toBe("1 h 20 min");
  });
});

describe("duplicates", () => {
  const existing = [
    { id: "1", company: "The Green-Leaf Spa Co., Ltd.", phone: "+66 96 627 5499", email: null, website: null },
    { id: "2", company: "Other", phone: null, email: "Info@Acme.com", website: "https://www.acme.com" },
  ];
  it("normalises names and phones", () => {
    expect(companyKey("The Green-Leaf Spa Co., Ltd.")).toBe("green leaf spa");
    expect(phoneDigits("096-627-5499")).toBe(phoneDigits("+66 96 627 5499"));
  });
  it("finds matches by phone, name, email or website", () => {
    expect(findDuplicates({ company: "Green Leaf Spa", phone: "0966275499" }, existing)).toEqual([{ id: "1", company: "The Green-Leaf Spa Co., Ltd.", why: ["same phone", "same name"] }]);
    expect(findDuplicates({ email: "info@acme.com" }, existing)[0].why).toEqual(["same email"]);
    expect(findDuplicates({ website: "acme.com/contact" }, existing)[0].id).toBe("2");
    expect(findDuplicates({ company: "Spa" }, existing)).toEqual([]);
  });
});

describe("country and industry templates", () => {
  const general = { id: "g", countries: [], industries: [] };
  const de = { id: "de", countries: ["Germany"], industries: [] };
  const deRest = { id: "deRest", countries: ["Germany"], industries: ["Restaurant"] };
  const cafe = { id: "cafe", countries: [], industries: ["Café"] };
  const us = { id: "us", countries: ["United States"], industries: [] };

  it("ranks the most specific fit first and pushes other countries last", () => {
    const r = rankTemplates([general, us, cafe, de, deRest], { country: "Germany", industry: "restaurant" });
    expect(r.map((t) => t.id)).toEqual(["deRest", "de", "g", "us", "cafe"]);
    expect(r.map((t) => t.fit)).toEqual([3, 2, 0, -1, -1]);
  });

  it("treats a lead with no country as not matching country templates", () => {
    expect(templateFit(de, { country: null, industry: null })).toBe(-1);
    expect(templateFit(general, { country: null, industry: null })).toBe(0);
  });

  it("starts German, Thai and English templates from the country", () => {
    expect(starterTemplate({ country: "Austria", industry: "Café", category: "Intro" })).toMatchObject({ language: "de", name: "Intro – Austria – Café" });
    expect(starterTemplate({ country: "Thailand", industry: null, category: "Follow-up" }).language).toBe("th");
    const us1 = starterTemplate({ country: "United States", industry: "Dental clinic", category: "Proposal" });
    expect(us1.language).toBe("en");
    expect(us1.body).toContain("dental clinic businesses");
  });

  it("has a German opt-out line", () => {
    expect(OPT_OUT_LINE[templateLanguage("de")]).toMatch(/Nein danke/);
    expect(templateLanguage("xx")).toBe("en");
  });
});
