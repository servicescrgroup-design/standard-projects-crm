import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+66 81")).toBe("'+66 81");
  });
  it("keeps Thai text and adds a BOM", () => {
    const out = toCsv(["ชื่อ"], [["ร้านนวด"]]);
    expect(out.startsWith("﻿ชื่อ\r\nร้านนวด")).toBe(true);
  });
});
