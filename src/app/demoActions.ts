"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { createDemo, sendDemo, updateDemo, visibleDemo, type DemoPatch } from "@/lib/server/demos";

type Result = { ok?: boolean; error?: string; message?: string; id?: string };
const fail = (e: unknown): Result => ({ error: (e as Error).message || "Something went wrong" });

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

function refresh(leadId: string) {
  revalidatePath("/demos");
  revalidatePath(`/leads/${leadId}`);
}

export async function createDemoAction(leadId: string): Promise<Result> {
  try {
    const user = await requireUser();
    const d = await createDemo(user, leadId);
    refresh(leadId);
    return { ok: true, id: d.id, message: "Demo project created" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateDemoAction(id: string, patch: DemoPatch): Promise<Result> {
  try {
    const user = await requireUser();
    const d = await updateDemo(user, id, patch);
    refresh(d.leadId);
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function sendDemoAction(id: string, subject: string, body: string): Promise<Result> {
  try {
    const user = await requireUser();
    const r = await sendDemo(user, id, { subject, body, origin: await origin() });
    const d = await visibleDemo(user, id);
    refresh(d.leadId);
    return { ok: true, message: r.approval ? "Sent to a manager for approval" : "Demo sent to the client" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDemoAction(id: string): Promise<Result> {
  try {
    const user = await requireUser();
    const d = await visibleDemo(user, id);
    await db.demoProject.delete({ where: { id } });
    refresh(d.leadId);
    return { ok: true, message: "Demo project deleted" };
  } catch (e) {
    return fail(e);
  }
}
