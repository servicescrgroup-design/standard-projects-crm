import { describe, expect, it } from "vitest";
import { cleanDemoUrl, demoStatusInfo, isDemoStatus, sanitizeTasks, starterBrief, starterTasks, taskProgress } from "../demos";

describe("demo projects", () => {
  it("starts with a checklist that fits the industry", () => {
    expect(starterTasks("Restaurant").map((t) => t.text)).toContain("Add the menu and a table booking button");
    expect(starterTasks(null).map((t) => t.text)).toContain("Add their main services and a contact form");
    expect(starterTasks("Spa").every((t) => !t.done)).toBe(true);
  });

  it("writes a brief from what we know", () => {
    const b = starterBrief({ company: "Kim Tài", website: null, segment: "Restaurant", industry: null, needs: null, whyFit: "Instagram only, 285 reviews", location: "Houston, TX, United States" });
    expect(b).toContain("Demo website for Kim Tài (Houston, TX, United States).");
    expect(b).toContain("They have no website yet.");
    expect(b).toContain("Why they need it: Instagram only, 285 reviews");
  });

  it("only accepts web links for the demo", () => {
    expect(cleanDemoUrl("kimtai-demo.vercel.app")).toBe("https://kimtai-demo.vercel.app/");
    expect(cleanDemoUrl("http://x.test/a")).toBe("http://x.test/a");
    expect(cleanDemoUrl("javascript:alert(1)")).toBeNull();
    expect(cleanDemoUrl("")).toBeNull();
  });

  it("cleans checklists and counts progress", () => {
    const t = sanitizeTasks([{ text: " Build it ", done: true }, { text: "", done: false }, "junk", { text: "Send", done: "yes" }]);
    expect(t).toEqual([{ text: "Build it", done: true }, { text: "Send", done: false }]);
    expect(taskProgress(t)).toEqual({ done: 1, total: 2 });
  });

  it("knows its statuses", () => {
    expect(isDemoStatus("READY")).toBe(true);
    expect(isDemoStatus("NOPE")).toBe(false);
    expect(demoStatusInfo("SENT").label).toBe("Sent to client");
  });
});
