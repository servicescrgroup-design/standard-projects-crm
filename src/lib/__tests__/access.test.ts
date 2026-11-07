import { describe, expect, it } from "vitest";
import {
  canAssignTo,
  canManageGoals,
  canManagePeople,
  canSeeLead,
  leadScope,
  teamScope,
  wouldLeaveNoOwner,
} from "../access";

const owner = { id: "o", role: "OWNER", teamId: null };
const lead = { id: "tl", role: "TEAM_LEAD", teamId: "t1" };
const rep = { id: "r", role: "REP", teamId: "t1" };
const otherRep = { id: "x", teamId: "t2" };

describe("access", () => {
  it("owner sees everything", () => {
    expect(leadScope(owner)).toEqual({});
    expect(canSeeLead(owner, { ownerId: "anyone", owner: { teamId: "t9" } })).toBe(true);
    expect(teamScope(owner)).toEqual({});
  });

  it("rep with no territory sees only their own leads", () => {
    expect(leadScope(rep)).toEqual({ ownerId: "r" });
    expect(canSeeLead(rep, { ownerId: "r" })).toBe(true);
    expect(canSeeLead(rep, { ownerId: null, country: "TH", company: "Acme" })).toBe(false);
    expect(canSeeLead(rep, { ownerId: "y", owner: { teamId: "t1" } })).toBe(false);
    expect(teamScope(rep)).toEqual({ id: "r" });
  });

  it("team lead sees only their territory and own leads, not the whole team or the unassigned pool", () => {
    expect(leadScope(lead)).toEqual({ ownerId: "tl" });
    expect(canSeeLead(lead, { ownerId: "r", owner: { teamId: "t1" } })).toBe(false);
    expect(canSeeLead(lead, { ownerId: null })).toBe(false);
  });

  it("assigned countries and companies open up exactly those leads", () => {
    const sales = { ...rep, allowedCountries: ["TH", "DE"], allowedCompanies: ["Acme Ltd"] };
    expect(leadScope(sales)).toEqual({
      OR: [{ ownerId: "r" }, { country: { in: ["TH", "DE"] } }, { company: { equals: "Acme Ltd", mode: "insensitive" } }],
    });
    expect(canSeeLead(sales, { ownerId: "y", country: "DE" })).toBe(true);
    expect(canSeeLead(sales, { ownerId: null, country: "TH" })).toBe(true);
    expect(canSeeLead(sales, { ownerId: "y", country: "US" })).toBe(false);
    expect(canSeeLead(sales, { ownerId: "y", country: null })).toBe(false);
    expect(canSeeLead(sales, { ownerId: "y", country: "US", company: " acme ltd " })).toBe(true);
    expect(canSeeLead(sales, { ownerId: "y", country: "US", company: "Acme Ltd 2" })).toBe(false);
    expect(canSeeLead({ ...lead, allowedCountries: ["GB"] }, { ownerId: "x", country: "GB" })).toBe(true);
  });

  it("the owner ignores territories", () => {
    expect(leadScope({ ...owner, allowedCountries: ["TH"] })).toEqual({});
  });

  it("only owners and team leads can assign, team leads within their team", () => {
    expect(canAssignTo(rep, { id: "r", teamId: "t1" })).toBe(false);
    expect(canAssignTo(lead, { id: "r", teamId: "t1" })).toBe(true);
    expect(canAssignTo(lead, otherRep)).toBe(false);
    expect(canAssignTo(owner, otherRep)).toBe(true);
  });

  it("goal management follows the same lines", () => {
    expect(canManageGoals(lead, { id: "r", teamId: "t1" })).toBe(true);
    expect(canManageGoals(lead, otherRep)).toBe(false);
    expect(canManageGoals(rep, { id: "r", teamId: "t1" })).toBe(false);
  });
});

describe("people management", () => {
  const users = [
    { id: "o", role: "OWNER" },
    { id: "r", role: "REP" },
  ];

  it("only owners manage people", () => {
    expect(canManagePeople(owner)).toBe(true);
    expect(canManagePeople(lead)).toBe(false);
    expect(canManagePeople(rep)).toBe(false);
  });

  it("blocks removing or demoting the last owner", () => {
    expect(wouldLeaveNoOwner(users, "o", null)).toBe(true);
    expect(wouldLeaveNoOwner(users, "o", "REP")).toBe(true);
    expect(wouldLeaveNoOwner(users, "o", "OWNER")).toBe(false);
    expect(wouldLeaveNoOwner(users, "r", null)).toBe(false);
  });

  it("allows it when another owner exists", () => {
    expect(wouldLeaveNoOwner([...users, { id: "o2", role: "OWNER" }], "o", null)).toBe(false);
  });
});

describe("email permissions", () => {
  it("lets owners and team leads send, reps only draft", async () => {
    const { canSendEmail } = await import("../access");
    expect(canSendEmail({ id: "o", role: "OWNER", teamId: null })).toBe(true);
    expect(canSendEmail({ id: "t", role: "TEAM_LEAD", teamId: "x" })).toBe(true);
    expect(canSendEmail({ id: "r", role: "REP", teamId: "x" })).toBe(false);
  });
});
