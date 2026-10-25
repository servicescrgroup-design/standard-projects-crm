import { describe, expect, it } from "vitest";
import { bounceInfo, emailBlockReason, isOptOutReply, looksLikeEmail } from "../emailSafety";
import { inSendWindow, nextSendTime, spreadFor } from "../sequences";
import { localClock, timeZoneFor } from "../timezones";

describe("time zones", () => {
  it("uses the US state, Canadian province or Australian state when there is one", () => {
    expect(timeZoneFor("United States", "Houston, TX, United States")).toBe("America/Chicago");
    expect(timeZoneFor("United States", "Seattle, Washington, United States")).toBe("America/Los_Angeles");
    expect(timeZoneFor("United States", "Brooklyn, NY, United States")).toBe("America/New_York");
    expect(timeZoneFor("Canada", "Calgary, AB, Canada")).toBe("America/Edmonton");
    expect(timeZoneFor("Australia", "Perth, Australia")).toBe("Australia/Perth");
    expect(timeZoneFor("Australia", "Toowoomba, QLD, Australia")).toBe("Australia/Brisbane");
  });

  it("falls back to the country, then Bangkok", () => {
    expect(timeZoneFor("Germany", "Munich, Bavaria, Germany")).toBe("Europe/Berlin");
    expect(timeZoneFor("United States", null)).toBe("America/New_York");
    expect(timeZoneFor(null, "Nimman")).toBe("Asia/Bangkok");
  });
});

describe("send window", () => {
  // Wed 22 Oct 2026, 03:00 UTC = 10:00 in Bangkok, 05:00 in Berlin (CEST), 22:00 Tue in Chicago.
  const at = new Date("2026-10-21T03:00:00Z");

  it("knows local working hours", () => {
    expect(localClock("Asia/Bangkok", at)).toEqual({ day: 3, minutes: 600 });
    expect(inSendWindow("Asia/Bangkok", at)).toBe(true);
    expect(inSendWindow("Europe/Berlin", at)).toBe(false);
    expect(inSendWindow("America/Chicago", at)).toBe(false);
  });

  it("waits for 9:00 their time, skipping weekends", () => {
    expect(nextSendTime("Asia/Bangkok", at)).toEqual(at);
    expect(nextSendTime("Europe/Berlin", at).toISOString()).toBe("2026-10-21T07:00:00.000Z"); // 09:00 CEST
    expect(nextSendTime("America/Chicago", at, 10).toISOString()).toBe("2026-10-21T14:10:00.000Z"); // 09:10 CDT
    const fridayEvening = new Date("2026-10-23T22:00:00Z"); // Fri 17:00 in Chicago
    expect(localClock("America/Chicago", nextSendTime("America/Chicago", fridayEvening))).toEqual({ day: 1, minutes: 540 });
  });

  it("spreads a batch over the first 45 minutes, the same way every time", () => {
    expect(spreadFor("enr_1")).toBe(spreadFor("enr_1"));
    expect(new Set(["a", "b", "c", "d", "e", "f"].map(spreadFor)).size).toBeGreaterThan(1);
    expect(spreadFor("x")).toBeLessThan(45);
  });
});

describe("opt-out replies", () => {
  it("spots 'no thanks' in each language", () => {
    for (const reply of ["No thanks.", "not interested, please remove me", "Unsubscribe", "Nein danke!", "Kein Interesse", "No, gracias", "No grazie", "Non merci, pas intéressé", "ไม่สนใจครับ", "STOP"])
      expect(isOptOutReply(reply), reply).toBe(true);
    expect(isOptOutReply("Hello", "Unsubscribe")).toBe(true);
  });

  it("ignores normal replies and our own quoted opt-out line", () => {
    expect(isOptOutReply("Sounds good, can you call me Tuesday?")).toBe(false);
    expect(isOptOutReply('Yes please send examples. On Mon, 3 Jun 2026 Richard wrote: … just reply "no thanks" and I won\'t email you again')).toBe(false);
    expect(isOptOutReply("Interesting! Am 3. Juni schrieb Richard: antworten Sie mit „Nein danke“")).toBe(false);
  });
});

describe("bounces", () => {
  const own = "services.crgroup@gmail.com";

  it("reads Gmail's bounce-back", () => {
    const r = bounceInfo({
      from: "mailer-daemon@googlemail.com",
      subject: "Delivery Status Notification (Failure)",
      snippet: "Address not found Your message wasn't delivered to info@kimtai.example because the address couldn't be found, or is unable to receive mail.",
      failedRecipients: ["info@kimtai.example"],
    }, own);
    expect(r).toEqual({ addresses: ["info@kimtai.example"], reason: "The address doesn't exist" });
  });

  it("reads Outlook's and German bounce-backs from the text", () => {
    expect(bounceInfo({ from: "postmaster@outlook.com", subject: "Undeliverable: Quick idea", snippet: "Delivery has failed to these recipients or groups: hallo@baeckerei.example. The email address couldn't be found." }, own)?.addresses)
      .toEqual(["hallo@baeckerei.example"]);
    expect(bounceInfo({ from: "MAILER-DAEMON@mx.example.de", subject: "Unzustellbar: Kurze Idee", snippet: "Die Adresse kontakt@praxis.example existiert nicht" }, own)?.reason).toBe("The address doesn't exist");
  });

  it("ignores delays, normal mail and bounces without an address", () => {
    expect(bounceInfo({ from: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Delay)", snippet: "will retry for 47 more hours to a@b.example" }, own)).toBeNull();
    expect(bounceInfo({ from: "anna@shop.example", subject: "Re: website", snippet: "Thanks!" }, own)).toBeNull();
    expect(bounceInfo({ from: "mailer-daemon@googlemail.com", subject: "Delivery Status Notification (Failure)", snippet: `Sent by ${own}` }, own)).toBeNull();
  });
});

describe("who can be emailed", () => {
  it("blocks opted-out and bounced leads", () => {
    expect(emailBlockReason({ email: "a@b.co", emailOptOutAt: new Date(), emailBouncedAt: null })).toMatch(/asked not/);
    expect(emailBlockReason({ email: "a@b.co", emailOptOutAt: null, emailBouncedAt: new Date() })).toMatch(/bounced/);
    expect(emailBlockReason({ email: "a@b.co", emailOptOutAt: null, emailBouncedAt: null })).toBeNull();
    expect(looksLikeEmail("info@shop.de")).toBe(true);
    expect(looksLikeEmail("info@shop")).toBe(false);
  });
});
