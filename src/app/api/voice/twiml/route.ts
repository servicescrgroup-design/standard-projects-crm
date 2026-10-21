import { db } from "@/lib/server/db";
import { callSecret } from "@/lib/server/twilio";
import { dialTwiml, rejectTwiml, verifyCall } from "@/lib/voice";

export const dynamic = "force-dynamic";

const xml = (body: string) => new Response(body, { headers: { "content-type": "text/xml; charset=utf-8" } });

/**
 * Twilio asks this URL what to do when an agent starts a browser call. It only dials a number the CRM
 * signed for that agent in the last 10 minutes, from that agent's own Twilio account and caller ID.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const claim = verifyCall(String(form?.get("crm") ?? ""), callSecret());
  if (!claim) return xml(rejectTwiml("This call could not be verified. Please start it again from the CRM."));
  const conn = await db.twilioConnection.findUnique({ where: { userId: claim.userId } });
  if (!conn || conn.accountSid !== String(form?.get("AccountSid") ?? "")) {
    return xml(rejectTwiml("This call could not be verified. Please reconnect Twilio in the CRM settings."));
  }
  return xml(dialTwiml({ to: claim.to, callerId: conn.callerId, record: conn.record }));
}
