import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { db } from "@/lib/server/db";
import { callSecret, twilioCredsFor } from "@/lib/server/twilio";
import { canSeeLead } from "@/lib/access";
import { countryOf } from "@/lib/countries";
import { toE164 } from "@/lib/phone";
import { signCall, voiceAccessToken } from "@/lib/voice";

export const dynamic = "force-dynamic";

/**
 * Starts a browser call to a lead: returns a short-lived Twilio access token for the agent's own
 * account and a signed claim naming the number, which the TwiML webhook checks before dialling.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };
  const lead = leadId ? await db.lead.findUnique({ where: { id: leadId }, include: { owner: true } }) : null;
  if (!lead || !canSeeLead(user, lead)) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  let creds;
  try {
    creds = await twilioCredsFor(user.id);
  } catch {
    return NextResponse.json({ error: "Your Twilio connection can't be read any more. Reconnect it in Settings → Phone." }, { status: 409 });
  }
  if (!creds) return NextResponse.json({ error: "Connect Twilio in Settings → Phone to call from the browser" }, { status: 409 });

  const to = toE164(lead.phone, countryOf(lead.location)?.code ?? "TH");
  if (!to) return NextResponse.json({ error: "This lead has no phone number that can be dialled" }, { status: 400 });

  const token = voiceAccessToken({ accountSid: creds.accountSid, apiKeySid: creds.apiKeySid, apiKeySecret: creds.apiKeySecret, appSid: creds.appSid, identity: `crm_${user.id}`, ttlSeconds: 3600 });
  const claim = signCall({ userId: user.id, leadId: lead.id, to, exp: Date.now() + 10 * 60_000 }, callSecret());
  return NextResponse.json({ token, claim, to, callerId: creds.callerId });
}
