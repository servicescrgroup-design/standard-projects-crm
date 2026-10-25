"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/session";
import { canManagePeople } from "@/lib/access";
import { fillMissingIndustries } from "@/lib/server/industries";

export async function fillIndustriesAction(): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const user = await requireUser();
  if (!canManagePeople(user)) return { error: "Only the owner can do this" };
  const n = await fillMissingIndustries();
  revalidatePath("/settings");
  revalidatePath("/contacts");
  return { ok: true, message: `Industry filled in for ${n.toLocaleString()} lead${n === 1 ? "" : "s"}` };
}
