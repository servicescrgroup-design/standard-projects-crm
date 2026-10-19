import { describe, expect, it } from "vitest";
import { matchLead, normaliseEmail } from "../matching";

const leads = [
  { id: "affirm", email: "info@affirmdesign.co.uk", website: null },
  { id: "dgs", email: null, website: "https://www.dgslandscaping.co.uk" },
  { id: "gmailguy", email: "bob.builder@gmail.com", website: null },
  { id: "dup1", email: "a@shared.com", website: null },
  { id: "dup2", email: "b@shared.com", website: null },
];

describe("matching", () => {
  it("parses display-name addresses", () => {
    expect(normaliseEmail("Jane <Jane@Acme.co.uk>")).toBe("jane@acme.co.uk");
    expect(normaliseEmail("not an email")).toBeNull();
  });

  it("matches exact addresses, including free-mail ones", () => {
    expect(matchLead(["Bob <bob.builder@gmail.com>"], leads)?.id).toBe("gmailguy");
  });

  it("matches a colleague at the same company by domain", () => {
    expect(matchLead(["kamal@affirmdesign.co.uk"], leads)?.id).toBe("affirm");
  });

  it("matches by website domain", () => {
    expect(matchLead(["owner@dgslandscaping.co.uk"], leads)?.id).toBe("dgs");
  });

  it("never matches strangers on free-mail domains", () => {
    expect(matchLead(["someone.else@gmail.com"], leads)).toBeNull();
  });

  it("skips ambiguous domain matches", () => {
    expect(matchLead(["c@shared.com"], leads)).toBeNull();
  });

  it("ignores internal addresses", () => {
    expect(matchLead(["richard@affirmdesign.co.uk"], leads, ["affirmdesign.co.uk"])).toBeNull();
  });
});
