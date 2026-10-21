import { describe, expect, it } from "vitest";
import { csvToObjects, parseCsv } from "../csv";
import { mapCsvRows } from "../csvImport";

describe("csv parsing", () => {
  it("handles quotes, commas, newlines and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi""\nok"\n\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"\nok']]);
  });
});

describe("csv lead import", () => {
  const rows = csvToObjects(
    "Company Name,Contact,E-mail,Phone,Website,City,Country,Priority,Stage,Value,Lead Source\n" +
      "Acme Spa,Jane,JANE@acme.com,+1 555,https://www.acme.com,Austin,United States,a,contacted,\"฿30,000\",referral\n" +
      ",nobody,,,,,,,,,\n",
  );

  it("matches columns loosely and maps values", () => {
    const [l, ...rest] = mapCsvRows(rows);
    expect(rest).toHaveLength(0); // the row without a company is skipped
    expect(l).toMatchObject({
      company: "Acme Spa",
      contactName: "Jane",
      email: "jane@acme.com",
      location: "Austin, United States",
      priority: "A",
      stage: "CONTACTED",
      source: "REFERRAL",
      value: 3_000_000,
      externalRef: "csv:acme.com",
    });
  });

  it("falls back to safe defaults for unknown values", () => {
    const [l] = mapCsvRows([{ Company: "B", Stage: "Weird", Source: "TV" }]);
    expect(l).toMatchObject({ stage: "NEW", source: "MANUAL", priority: null, externalRef: "csv:b" });
  });
});
