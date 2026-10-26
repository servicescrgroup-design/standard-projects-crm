import { describe, expect, it } from "vitest";
import { isFreeMail, isPlatformDomain, matchLead, normaliseEmail } from "../matching";

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

describe("platform domains never identify a lead", () => {
  const leads = [
    { id: "best", email: null, website: "https://www.google.com/search" },
    { id: "fbshop", email: null, website: "https://facebook.com/someshop" },
    { id: "real", email: null, website: "https://acme-plumbing.com" },
  ];
  it("ignores Google, Facebook and similar notification senders", () => {
    expect(matchLead(["businessprofile-noreply@google.com"], leads)).toBeNull();
    expect(matchLead(["no-reply@accounts.google.com"], leads)).toBeNull();
    expect(matchLead(["calendar-notification@google.com"], leads)).toBeNull();
    expect(matchLead(["notification@facebookmail.com", "security@facebook.com"], leads)).toBeNull();
  });
  it("still matches a lead's own domain", () => {
    expect(matchLead(["bob@acme-plumbing.com"], leads)?.id).toBe("real");
  });
  it("recognises platform domains", () => {
    expect(isPlatformDomain("maps.google.co.th")).toBe(true);
    expect(isPlatformDomain("m.facebook.com")).toBe(true);
    expect(isPlatformDomain("googleplumbing.com")).toBe(false);
    expect(isPlatformDomain("acme.com")).toBe(false);
  });
});

describe("free mail providers never identify a lead by domain", () => {
  const leads = [{ id: "phil", email: "philshandyservice@msn.com", website: "https://philshandyservice.com/" }];
  it("only matches the exact address", () => {
    expect(matchLead(["izzii@msn.com"], leads)).toBeNull();
    expect(matchLead(["philshandyservice@msn.com"], leads)?.id).toBe("phil");
  });
  it("knows country variants and regional providers", () => {
    for (const d of ["msn.com", "hotmail.co.th", "yahoo.de", "gmx.at", "outlook.de", "web.de", "bigpond.com", "libero.it", "orange.fr"]) expect(isFreeMail(d), d).toBe(true);
    expect(isFreeMail("acme-plumbing.com")).toBe(false);
  });
});
