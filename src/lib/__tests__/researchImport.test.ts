import { describe, expect, it } from "vitest";
import { isResearchFile, mapResearchRow, outreachNote, planResearchImport } from "../researchImport";

const row = {
  company: "Alpen Gasthof Huber",
  website: "https://www.gasthof-huber.de/start",
  websiteStatus: "no-english",
  country: "Germany",
  city: "Garmisch",
  region: "Bavaria",
  niche: "Hospitality",
  industry: "Guesthouse",
  phone: "+49 8821 000000",
  email: "INFO@gasthof-huber.de",
  googleRating: 4.7,
  googleReviews: "312",
  whyFit: "German-only site; many international guest reviews",
  priority: "a",
  sourceLink: "https://www.gasthof-huber.de",
};

describe("research import", () => {
  it("detects research files", () => {
    expect(isResearchFile([row])).toBe(true);
    expect(isResearchFile([{ "Company Name": "x" }])).toBe(false);
  });

  it("maps a prospect to an unassigned cold-outreach lead", () => {
    const l = mapResearchRow(row)!;
    expect(l).toMatchObject({
      externalRef: "research:gasthof-huber.de",
      location: "Garmisch, Bavaria, Germany",
      segment: "Hospitality",
      serviceInterest: "English website",
      offersToPitch: ["English website"],
      priority: "A",
      source: "COLD_OUTREACH",
      stage: "NEW",
      email: "info@gasthof-huber.de",
      googleReviews: 312,
    });
    expect(l.notes).toMatch(/call or use their contact form/);
  });

  it("uses name, city and country as the reference when there is no website", () => {
    const l = mapResearchRow({ ...row, website: null, websiteStatus: "none" })!;
    expect(l.externalRef).toBe("research:alpen gasthof huber|garmisch|germany");
    expect(l.serviceInterest).toBe("New website");
  });

  it("rejects bad emails and rows without a company", () => {
    expect(mapResearchRow({ ...row, email: "not an email" })!.email).toBeNull();
    expect(mapResearchRow({ ...row, company: "  " })).toBeNull();
  });

  it("skips prospects already in the CRM by reference or website domain", () => {
    const a = mapResearchRow(row)!;
    const b = mapResearchRow({ ...row, company: "Other", website: "http://other.com" })!;
    const c = mapResearchRow({ ...row, company: "Third", website: "third.com" })!;
    const plan = planResearchImport([a, b, c, a], [
      { company: "X", website: "https://other.com/", externalRef: null },
      { company: "Y", website: null, externalRef: "research:third.com" },
    ]);
    expect(plan.create.map((l) => l.company)).toEqual(["Alpen Gasthof Huber"]);
    expect(plan.skipped).toBe(3);
  });

  it("gives outreach guidance per country", () => {
    expect(outreachNote("United States")).toMatch(/email OK/);
    expect(outreachNote("Australia")).toMatch(/published business address/);
  });
});
