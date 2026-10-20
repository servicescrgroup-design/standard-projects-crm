import { describe, expect, it } from "vitest";
import { mapNotionRow, phoneKey, planImport, splitWebsite } from "../notionImport";

// Shaped like real rows from the Notion "Customers CRM" export (values are illustrative).
const row = {
  url: "https://app.notion.com/abc123",
  Company: "  Example Muay Thai Camp ",
  "Contact person": null,
  Email: "Camp@Example.com",
  "Phone or LINE ID": "096 000 0000",
  "Social / LINE": "https://www.facebook.com/example",
  Website: "https://example-camp.com",
  Address: "5/1 Moo 3, Mae Taeng, Chiang Mai 50150",
  Area: "Chiang Mai",
  Industry: "Other",
  Segment: "Gym",
  Niche: "General website",
  Priority: "B",
  Source: "Cold outreach",
  "Source link": "https://example.com/listing",
  "Google rating": 4.6,
  "Google reviews": 212,
  "Why a fit": "Foreign students book by WhatsApp",
  "Plan and needs": null,
  "Offers to pitch": '["Website","Growth website","Teamwork HR"]',
  "Case studies to show": '["CNX Customs site"]',
  Notes: "Type: gym",
  "Customer Budget (THB)": 30000,
  "Quoted Price (THB)": 45000,
  "Monthly Care Plan (THB)": 1500,
  Package: "Business",
  "Lost reason": null,
  Stage: "Proposal Sent",
  "date:Next follow-up:start": "2026-10-21",
  "date:Last contact:start": null,
  createdTime: "2026-10-09T14:07:00.000Z",
};

describe("Notion import", () => {
  it("maps every field to the CRM lead", () => {
    const l = mapNotionRow(row)!;
    expect(l).toMatchObject({
      externalRef: "https://app.notion.com/abc123",
      company: "Example Muay Thai Camp",
      email: "camp@example.com",
      phone: "096 000 0000",
      website: "https://example-camp.com",
      location: "Chiang Mai",
      segment: "Gym",
      serviceInterest: "General website",
      priority: "B",
      source: "COLD_OUTREACH",
      googleRating: 4.6,
      googleReviews: 212,
      offersToPitch: ["Website", "Growth website", "Teamwork HR"],
      caseStudies: ["CNX Customs site"],
      notes: "Type: gym",
      budget: 3_000_000,
      value: 4_500_000,
      monthlyValue: 150_000,
      package: "Business",
      stage: "PROPOSAL_SENT",
    });
    expect(l.nextFollowUpAt?.toISOString()).toBe("2026-10-21T02:00:00.000Z"); // 09:00 Bangkok
  });

  it("keeps website research notes instead of treating them as URLs", () => {
    expect(splitWebsite("none on Google listing")).toEqual({ website: null, note: "none on Google listing" });
    expect(splitWebsite("free/redirect page only: https://x.wixsite.com/shop")).toEqual({
      website: "https://x.wixsite.com/shop",
      note: "free/redirect page only: https://x.wixsite.com/shop",
    });
    const l = mapNotionRow({ ...row, Website: "not listed in source (unverified)", Notes: null })!;
    expect(l.website).toBeNull();
    expect(l.notes).toBe("Website: not listed in source (unverified)");
  });

  it("maps every Notion stage and defaults sensibly", () => {
    const stage = (s: string | null) => mapNotionRow({ ...row, Stage: s })!.stage;
    expect(stage("Lead")).toBe("NEW");
    expect(stage("Discovery")).toBe("MEETING_BOOKED");
    expect(stage("Negotiation")).toBe("NEGOTIATION");
    expect(stage("Won")).toBe("WON");
    expect(stage("Maintenance Client")).toBe("MAINTENANCE");
    expect(stage("Lost")).toBe("LOST");
    expect(stage(null)).toBe("NEW");
  });

  it("drops bad values rather than importing junk", () => {
    const l = mapNotionRow({ ...row, Email: "not-an-email", Priority: "Z", "Quoted Price (THB)": -5 })!;
    expect(l.email).toBeNull();
    expect(l.priority).toBeNull();
    expect(l.value).toBe(0);
  });

  it("skips rows without a company or page URL", () => {
    expect(mapNotionRow({ ...row, Company: "  " })).toBeNull();
    expect(mapNotionRow({ ...row, url: null })).toBeNull();
  });
});

describe("Notion import planning", () => {
  const base = mapNotionRow(row)!;
  const existing = (over: Record<string, unknown> = {}) => ({
    id: "lead-1",
    company: "Somebody Else",
    phone: null,
    externalRef: null,
    segment: null,
    priority: null,
    whyFit: null,
    offersToPitch: [],
    contactName: "Khun Mali",
    ...over,
  });

  it("normalises Thai phone numbers", () => {
    expect(phoneKey("096 000 0000")).toBe("0960000000");
    expect(phoneKey("053-818-569")).toBe("053818569");
    expect(phoneKey("12")).toBeNull();
  });

  it("creates leads that don't exist yet", () => {
    const plan = planImport([base], [existing()]);
    expect(plan.create).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it("enriches a hand-entered lead with the same phone, without overwriting what's there", () => {
    const plan = planImport([base], [existing({ phone: "0960000000", company: "Typed differently" })]);
    expect(plan.create).toHaveLength(0);
    expect(plan.update[0].id).toBe("lead-1");
    expect(plan.update[0].data).toMatchObject({
      externalRef: base.externalRef,
      segment: "Gym",
      priority: "B",
      whyFit: base.whyFit,
      offersToPitch: base.offersToPitch,
    });
    expect(plan.update[0].data).not.toHaveProperty("contactName"); // already filled in by the team
    expect(plan.update[0].data).not.toHaveProperty("stage");
  });

  it("matches by company name when there's no phone", () => {
    const plan = planImport([{ ...base, phone: null }], [existing({ company: "example muay thai camp" })]);
    expect(plan.update).toHaveLength(1);
  });

  it("skips rows already imported", () => {
    expect(planImport([base], [existing({ externalRef: base.externalRef })]).skipped).toBe(1);
  });

  it("adds branches that share a phone number as separate leads", () => {
    const branch2 = { ...base, company: "Example Camp Branch 2", externalRef: "https://app.notion.com/other" };
    const plan = planImport([base, branch2], [existing({ phone: "0960000000" })]);
    expect(plan.update).toHaveLength(1);
    expect(plan.create.map((c) => c.company)).toEqual(["Example Camp Branch 2"]);
  });
});
