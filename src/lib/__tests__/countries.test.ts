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
