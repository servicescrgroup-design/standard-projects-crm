import { describe, expect, it } from "vitest";
import { guessIndustry } from "../industryGuess";
import { openForCalls, retryAt, sortQueue } from "../callList";
import { LOCAL_SEQUENCES, LOCAL_WAIT_DAYS } from "../localSequences";
import { OPT_OUT_LINE, renderTemplate, templateLanguage } from "../templates";

describe("industry guesses", () => {
  const cases: [string, string | null, string | null][] = [
    ["Flowtec Plumbing and Gas", "plumbers | Australia Adelaide", "Trades"],
    ["Kingdom Locksmith Ltd", "locksmiths | UK Coventry", "Trades"],
    ["Hills Custom Smash Repairs", "mechanics | Australia Sydney", "Trades"],
    ["Wellnext Retreat ร้านนวดเชียงใหม่", "Spa & massage", "Spa"],
    ["กรทิพย์ นวดเพื่อสุขภาพ", null, "Spa"],
    ["Solve Clinics Hair Transplant Chicago", "hair transplants | USA Chicago", "Clinic"],
    ["Mayan Gym", "Gyms & Muay Thai", "Gym"],
    ["Huen High", "Cannabis shops", "Cannabis-CBD"],
    ["Title Music ไตเติ้ลมิวสิค", "Consignment & resale retail", "Consignment"],
    ["POP Big Bike Rental", "Vehicle rental", "Rental"],
    ["Big Black Box Wet Mill", "Export & trading", "Export-Trading"],
    ["Shanti Threading Salon", "waxing salons | USA Seattle", "Spa"],
    ["Dunn's Attic", "| USA Ormond Beach", null],
  ];
  it.each(cases)("%s → %s", (company, industry, expected) => {
    expect(guessIndustry({ company, industry })).toBe(expected);
  });
});

describe("call list", () => {
  it("knows when a business is open for calls", () => {
    const wedBangkok10 = new Date("2026-10-21T03:00:00Z");
    expect(openForCalls("Asia/Bangkok", wedBangkok10)).toBe(true);
    expect(openForCalls("America/Chicago", wedBangkok10)).toBe(false);
  });

  it("puts open businesses, due follow-ups and priority A first", () => {
    const now = new Date("2026-10-21T03:00:00Z");
    const lead = (id: string, o: Partial<{ openNow: boolean; priority: string | null; due: boolean; last: number }>) => ({
      id, openNow: o.openNow ?? true, priority: o.priority ?? null,
      nextFollowUpAt: o.due ? new Date(now.getTime() - 1000) : null, lastContactAt: o.last ? new Date(o.last) : null,
    });
    const sorted = sortQueue([
      lead("closed-A", { openNow: false, priority: "A" }),
      lead("open-C", { priority: "C" }),
      lead("open-B-contacted", { priority: "B", last: 5 }),
      lead("open-B-never", { priority: "B" }),
      lead("open-due", { due: true }),
    ], now);
    expect(sorted.map((l) => l.id)).toEqual(["open-due", "open-B-never", "open-B-contacted", "open-C", "closed-A"]);
  });

  it("retries at 9:00 a few days later", () => {
    const r = retryAt(new Date(2026, 9, 21, 15, 30), 2);
    expect([r.getDate(), r.getHours(), r.getMinutes()]).toEqual([23, 9, 0]);
  });
});

describe("Spanish, Italian and French sequences", () => {
  it("have four complete emails each, in the right language", () => {
    expect(LOCAL_WAIT_DAYS).toHaveLength(4);
    for (const s of LOCAL_SEQUENCES) {
      expect(s.emails).toHaveLength(4);
      expect(templateLanguage(s.language)).toBe(s.language);
      expect(OPT_OUT_LINE[templateLanguage(s.language)]).toBeTruthy();
      for (const e of s.emails) {
        const out = renderTemplate(`${e.subject}\n${e.body}`, { company: "Acme", agent_name: "Richard" });
        expect(out).not.toMatch(/\{\{|\}\}/);
      }
    }
  });
});

describe("more industry guesses", () => {
  it.each([
    ["Smithereen Pest Management Services", "bed bug exterminators | USA Chicago", "Trades"],
    ["Super Towing Greenacre", "towing services | Australia Sydney", "Trades"],
    ["Allied Foundation Repair", "foundation repair | USA Houston", "Trades"],
    ["Express Tires and Auto Services", "oil change services | USA Seattle", "Trades"],
    ["Stream Auto Outlet", "car dealerships | USA New York", "Retail"],
    ["Cha-Yan-Kai (Santitham Branch)", "Multi-location operators", "Multi-location"],
    ["Ink Studio", "tattoo shops | UK Leeds", "Spa"],
    ["Happy Paws", "pet shops | USA Austin", "Retail"],
  ])("%s → %s", (company, industry, expected) => {
    expect(guessIndustry({ company, industry })).toBe(expected);
  });
});

describe("industry guesses from the company name", () => {
  it.each([
    ["Roastniyom Coffee", "0896367056", "Restaurant"],
    ["Malee Sukhothai Tom Yum Noodles", "065 887 4575", "Restaurant"],
    ["GOGYM Chiangmai", "0988209099", "Gym"],
    ["Monde Eyewear (Chiang Mai stores)", "Multi-location operators", "Multi-location"],
    ["Nostalgia Vintage", "0613548819", "Consignment"],
    ["Designer Consigner", "| USA Wilmington area", "Consignment"],
    ["Egan Drilling", "| Australia Perth", "Trades"],
    ["Clear Step Podiatry", "podiatrists | New Zealand Auckland", "Clinic"],
    ["Big Black Box Wet Mill", "Export & trading", "Export-Trading"],
  ])("%s → %s", (company, industry, expected) => {
    expect(guessIndustry({ company, industry })).toBe(expected);
  });
});
