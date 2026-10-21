import { describe, expect, it } from "vitest";
import { countryAliases, countryOf, flagOf } from "../countries";

describe("countries", () => {
  it("reads the country from the end of a location", () => {
    expect(countryOf("Austin, TX, United States")).toEqual({ code: "US", name: "United States", flag: "🇺🇸" });
    expect(countryOf("Glasgow, Scotland")?.code).toBe("GB");
    expect(countryOf("Garmisch, Bavaria, Germany")?.flag).toBe("🇩🇪");
  });
  it("recognises Thai places without a country", () => {
    expect(countryOf("Nimman, Chiang Mai")?.code).toBe("TH");
    expect(countryOf("50180, Thailand")?.code).toBe("TH");
    expect(countryOf("เชียงใหม่")?.code).toBe("TH");
  });
  it("returns null when unknown", () => {
    expect(countryOf("Somewhere")).toBeNull();
    expect(countryOf(null)).toBeNull();
  });
  it("lists aliases and makes flags", () => {
    expect(countryAliases("United Kingdom")).toEqual(expect.arrayContaining(["united kingdom", "uk", "england", "scotland"]));
    expect(flagOf("JP")).toBe("🇯🇵");
  });
});

describe("countryOfLead", () => {
  it("falls back to country words in the industry text", async () => {
    const { countryOfLead } = await import("../countries");
    expect(countryOfLead({ industry: "plumbers | USA Seattle" })?.code).toBe("US");
    expect(countryOfLead({ industry: "electricians | UK Cardiff" })?.code).toBe("GB");
    expect(countryOfLead({ industry: "physiotherapists | Australia Melbourne" })?.code).toBe("AU");
    expect(countryOfLead({ industry: "help us grow" })).toBeNull();
  });
  it("then uses the phone number", async () => {
    const { countryOfLead } = await import("../countries");
    expect(countryOfLead({ phone: "0865645089" })?.code).toBe("TH");
    expect(countryOfLead({ phone: "+61399399364" })?.code).toBe("AU");
    expect(countryOfLead({ phone: "07847 111570" })).toBeNull();
    expect(countryOfLead({ location: "Austin, TX, United States", phone: "0865645089" })?.code).toBe("US");
    expect(countryOfLead({ company: "Chiangmai OTOP Center" })?.code).toBe("TH");
  });
});
