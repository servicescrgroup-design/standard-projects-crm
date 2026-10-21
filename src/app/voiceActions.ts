"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/session";
import { TwilioError, connectTwilio, disconnectTwilio, voiceWebhookUrl } from "@/lib/server/twilio";

export type VoiceResult = { ok?: boolean; error?: string; message?: string };

/** Connects the signed-in agent's own Twilio account for calling from the browser. */
export async function connectTwilioAction(_prev: VoiceResult, fd: FormData): Promise<VoiceResult> {
  const user = await requireUser();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3001";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  try {
    const r = await connectTwilio(
      user.id,
      user.name,
      {
        accountSid: String(fd.get("accountSid") ?? "").trim(),
        apiKeySid: String(fd.get("apiKeySid") ?? "").trim(),
        apiKeySecret: String(fd.get("apiKeySecret") ?? "").trim(),
        callerId: String(fd.get("callerId") ?? "").trim(),
        record: fd.get("record") === "on",
      },
      voiceWebhookUrl(`${proto}://${host}`),
    );
    revalidatePath("/settings");
    return { ok: true, message: `Twilio connected. Calls will show ${r.callerId}.` };
  } catch (e) {
    return { error: e instanceof TwilioError ? e.message : "Couldn't reach Twilio. Please try again." };
  }
}

export async function disconnectTwilioAction(): Promise<VoiceResult> {
  const user = await requireUser();
  await disconnectTwilio(user.id);
  revalidatePath("/settings");
  return { ok: true, message: "Twilio disconnected" };
}
