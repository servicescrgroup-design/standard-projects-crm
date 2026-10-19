import { describe, expect, it } from "vitest";
import { parseQuoteForm, quoteSummary, quoteToLead, validateQuote, type QuoteAnswers } from "../quote";

const valid: QuoteAnswers = {
  services: ["New website", "CRM / sales system"],
  businessType: "Construction & building",
  teamSize: "2–5 people",
  currentWebsite: "acmebuild.co.uk",
  budget: "£3,000 – £7,500",
  timeline: "Within 1–3 months",
  details: "We need online quotes for loft conversions.",
  name: "Jane Smith",
  company: "Acme Build Ltd",
  email: "jane@acmebuild.co.uk",
  phone: "07700 900123",
  contactPref: "Phone",
};

describe("quote form", () => {
  it("accepts a complete form", () => {
    expect(validateQuote(valid)).toEqual({});
  });

  it("requires contact details and the choice questions", () => {
    const errors = validateQuote({ ...valid, services: [], name: "", email: "nope", budget: "a million" });
    expect(Object.keys(errors).sort()).toEqual(["budget", "email", "name", "services"]);
  });

  it("rejects options that aren't on the form", () => {
    expect(validateQuote({ ...valid, services: ["Free iPad"] }).services).toBeDefined();
  });

  it("maps the budget to an estimated lead value and tags the source", () => {
    const lead = quoteToLead(valid);
    expect(lead.value).toBe(500_000);
    expect(lead.source).toBe("QUOTE");
    expect(lead.serviceInterest).toBe("New website, CRM / sales system");
    expect(quoteToLead({ ...valid, budget: "Not sure yet" }).value).toBe(0);
  });

  it("summarises every answer for the rep", () => {
    const s = quoteSummary(valid);
    for (const bit of ["Quote request", "£3,000 – £7,500", "acmebuild.co.uk", "07700 900123", "loft conversions"]) {
      expect(s).toContain(bit);
    }
  });

  it("parses multi-select services and lowercases email", () => {
    const fd = new FormData();
    fd.append("services", "New website");
    fd.append("services", "Website redesign");
    fd.append("email", "  Jane@Example.COM ");
    const a = parseQuoteForm(fd);
    expect(a.services).toEqual(["New website", "Website redesign"]);
    expect(a.email).toBe("jane@example.com");
  });
});
