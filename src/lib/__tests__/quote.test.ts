import { describe, expect, it } from "vitest";
import {
  QUOTE_BUDGETS,
  QUOTE_BUSINESS_TYPES,
  QUOTE_CONTACT_PREFS,
  QUOTE_LOCATIONS,
  QUOTE_SERVICES,
  QUOTE_TIMELINES,
  parseQuoteForm,
  quoteSummary,
  quoteToLead,
  validateQuote,
  type QuoteAnswers,
} from "../quote";
import { formatMoney, toMinor } from "../domain";

const valid: QuoteAnswers = {
  services: ["Website", "Business system (POS, stock, consignment, bookings)"],
  businessType: "Hospitality & wellness",
  locations: "2–3 locations",
  currentWebsite: "mymassage.com",
  budget: "฿80,000 – ฿200,000",
  timeline: "Within 1–3 months",
  details: "Two massage shops, need online booking and a POS.",
  name: "Somchai",
  company: "Somchai Spa",
  email: "somchai@example.com",
  phone: "somchai.spa",
  contactPref: "LINE",
  lang: "th",
};

describe("quote form", () => {
  it("accepts a complete form", () => {
    expect(validateQuote(valid)).toEqual({});
  });

  it("requires contact details and the choice questions", () => {
    const errors = validateQuote({ ...valid, services: [], name: "", email: "nope", budget: "a million" });
    expect(errors).toMatchObject({ services: "pickOne", name: "name", email: "email", budget: "pickBudget" });
  });

  it("needs a phone number or LINE ID when that's the preferred contact", () => {
    expect(validateQuote({ ...valid, phone: "" }).phone).toBe("phoneNeeded");
    expect(validateQuote({ ...valid, phone: "", contactPref: "Email" }).phone).toBeUndefined();
  });

  it("rejects options that aren't on the form", () => {
    expect(validateQuote({ ...valid, services: ["Free iPad"] }).services).toBe("pickOne");
  });

  it("has a Thai label for every option", () => {
    for (const list of [QUOTE_SERVICES, QUOTE_BUSINESS_TYPES, QUOTE_LOCATIONS, QUOTE_BUDGETS, QUOTE_TIMELINES, QUOTE_CONTACT_PREFS]) {
      for (const o of list) expect(o.th.trim().length).toBeGreaterThan(0);
    }
  });

  it("maps the budget to an estimated baht value and tags the source", () => {
    const lead = quoteToLead(valid);
    expect(formatMoney(lead.value)).toBe("฿140,000");
    expect(lead.source).toBe("QUOTE");
    expect(quoteToLead({ ...valid, budget: "Not sure yet" }).value).toBe(0);
  });

  it("summarises every answer in English for the team", () => {
    const s = quoteSummary(valid);
    for (const bit of ["filled in Thai", "฿80,000 – ฿200,000", "mymassage.com", "LINE: somchai.spa", "online booking"]) {
      expect(s).toContain(bit);
    }
  });

  it("parses multi-select services, language and lowercases email", () => {
    const fd = new FormData();
    fd.append("services", "Website");
    fd.append("services", "AI workflow automation");
    fd.append("email", "  Jane@Example.COM ");
    fd.append("lang", "th");
    const a = parseQuoteForm(fd);
    expect(a.services).toEqual(["Website", "AI workflow automation"]);
    expect(a.email).toBe("jane@example.com");
    expect(a.lang).toBe("th");
  });
});

describe("money", () => {
  it("formats baht and parses typed amounts", () => {
    expect(formatMoney(3_000_000)).toBe("฿30,000");
    expect(toMinor("฿30,000")).toBe(3_000_000);
    expect(toMinor("1,250.50")).toBe(125_050);
    expect(toMinor("abc")).toBe(0);
    expect(toMinor("-5")).toBe(0);
  });
});
