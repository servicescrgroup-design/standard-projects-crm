"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Grid3x3, Mic, MicOff, Minus, Phone, PhoneOff, Users, Video, X } from "lucide-react";
import { quickLog } from "@/app/actions";
import { OUTCOMES, OUTCOME_LABELS, type Outcome } from "@/lib/domain";
import { formatDuration } from "@/lib/phone";
import { toast } from "@/components/ui/Toaster";
import { Select } from "@/components/ui/Select";

type Lead = { id: string; company: string; contactName: string | null; phone: string | null; e164: string | null };
type Mode = "call" | "meeting";
type Phase = "choose" | "connecting" | "ringing" | "live" | "ended";
type Method = "phone" | "browser";

// Minimal shapes of the Twilio Voice SDK objects we use (loaded on demand).
type TwCall = { on: (e: string, f: (...a: unknown[]) => void) => void; disconnect: () => void; mute: (m: boolean) => void; sendDigits: (d: string) => void };
type TwDevice = { connect: (o: { params: Record<string, string> }) => Promise<TwCall>; on: (e: string, f: (...a: unknown[]) => void) => void; destroy: () => void };

const FOLLOW_UPS: [string, string][] = [["", "Let the CRM decide"], ["1", "Tomorrow"], ["3", "In 3 days"], ["7", "In a week"], ["14", "In 2 weeks"]];
const draftKey = (leadId: string, mode: Mode) => `spcrm.${mode}notes.${leadId}`;

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    startedAt.current ??= Date.now();
    const t = setInterval(() => setSeconds(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);
  const reset = () => {
    startedAt.current = null;
    setSeconds(0);
  };
  return { seconds, reset };
}

/**
 * Call and Meeting buttons for a lead, with a floating panel for notes. Calls go through the agent's
 * phone (free) or, if they connected Twilio, straight from the browser. Meetings open a free video room.
 * Everything is saved to the lead's history as a Call or Meeting activity.
 */
export function LeadComms({ lead, hasTwilio, autoOpen }: { lead: Lead; hasTwilio: boolean; autoOpen: Mode | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(autoOpen);
  const [minimised, setMinimised] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [method, setMethod] = useState<Method | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [followUp, setFollowUp] = useState("");
  const [attendees, setAttendees] = useState("");
  const [muted, setMuted] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const device = useRef<TwDevice | null>(null);
  const call = useRef<TwCall | null>(null);
  const { seconds, reset } = useTimer(phase === "live");

  // Keep notes if the page reloads mid-call.
  useEffect(() => {
    if (!mode) return;
    try {
      setNotes(localStorage.getItem(draftKey(lead.id, mode)) ?? "");
    } catch {
      /* ignore */
    }
  }, [mode, lead.id]);
  useEffect(() => {
    if (!mode) return;
    try {
      if (notes) localStorage.setItem(draftKey(lead.id, mode), notes);
      else localStorage.removeItem(draftKey(lead.id, mode));
    } catch {
      /* ignore */
    }
  }, [notes, mode, lead.id]);

  const teardown = useCallback(() => {
    try {
      call.current?.disconnect();
    } catch {
      /* already ended */
    }
    device.current?.destroy();
    call.current = null;
    device.current = null;
  }, []);
  useEffect(() => teardown, [teardown]);

  const open = (m: Mode) => {
    setMode(m);
    setMinimised(false);
    setPhase("choose");
    setMethod(null);
    setOutcome("");
    setFollowUp("");
    setMuted(false);
    setKeypad(false);
    reset();
    if (m === "meeting") setRoom(null);
  };
  const close = () => {
    if (phase === "live" || phase === "connecting" || phase === "ringing") {
      if (!confirm("End the call and close? Your notes are kept as a draft.")) return;
    }
    teardown();
    setMode(null);
  };

  const callByPhone = () => {
    setMethod("phone");
    setPhase("live");
    if (lead.e164) window.location.href = `tel:${lead.e164}`;
  };

  // Twilio errors arrive as objects with a numeric code; turn the common ones into plain language.
  const describe = (e: unknown): string => {
    const err = (e ?? {}) as { code?: number; message?: string; description?: string };
    if (err.code === 20101 || err.code === 20104 || err.code === 31204 || err.code === 31205) return "Twilio didn't accept the sign-in for your account. Reconnect Twilio in Settings → Phone.";
    if (err.code === 31208 || err.code === 31401 || err.code === 31402) return "The browser couldn't use your microphone. Allow microphone access and try again.";
    if (err.code === 31005 || err.code === 31009 || err.code === 53000) return "Couldn't reach Twilio. Check your internet connection and try again.";
    return err.description || err.message || "The call couldn't be started.";
  };

  const failBrowserCall = (e: unknown) => {
    toast(describe(e), "error");
    teardown();
    setPhase("choose");
    setMethod(null);
  };

  const callInBrowser = async () => {
    setMethod("browser");
    setPhase("connecting");
    try {
      const res = await fetch("/api/voice/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId: lead.id }) });
      const data = (await res.json().catch(() => ({}))) as { token?: string; claim?: string; error?: string };
      if (!res.ok || !data.token || !data.claim) throw new Error(data.error ?? "Couldn't start the call");
      const { Device } = await import("@twilio/voice-sdk");
      const d = new Device(data.token, { logLevel: "error", closeProtection: true }) as unknown as TwDevice;
      device.current = d;
      let settled = false;
      // Errors before the call connects (bad token, no microphone) end the attempt.
      d.on("error", (e) => {
        if (!settled) failBrowserCall(e);
        else toast(describe(e), "error");
      });
      const c = await d.connect({ params: { crm: data.claim } });
      if (!device.current) return; // failed while connecting
      call.current = c;
      c.on("ringing", () => setPhase("ringing"));
      c.on("accept", () => {
        settled = true;
        setPhase("live");
      });
      const ended = () => {
        settled = true;
        setPhase((p) => (p === "connecting" || p === "ringing" ? "choose" : "ended"));
        call.current = null;
      };
      c.on("disconnect", ended);
      c.on("cancel", ended);
      c.on("reject", ended);
      c.on("error", (e) => {
        toast(describe(e), "error");
        ended();
      });
    } catch (e) {
      failBrowserCall(e);
    }
  };

  const hangUp = () => {
    if (method === "browser") call.current?.disconnect();
    setPhase("ended");
  };

  const startMeeting = (video: boolean) => {
    if (video) {
      const slug = lead.company.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "").slice(0, 24) || "Meeting";
      const name = room ?? `StandardProjects-${slug}-${crypto.randomUUID().slice(0, 8)}`;
      setRoom(name);
      const w = window.open(`https://meet.jit.si/${name}`, "spcrm-meeting", "width=1200,height=800");
      if (!w) toast("Your browser blocked the meeting window. Press “Open meeting” below.", "error");
    }
    setPhase("live");
  };
  const meetingUrl = room ? `https://meet.jit.si/${room}` : null;

  const save = async () => {
    if (!mode) return;
    setSaving(true);
    const length = seconds > 0 ? ` · ${formatDuration(seconds)}` : "";
    const how = mode === "call" ? (method === "browser" ? "Browser call" : "Phone call") : meetingUrl ? "Video meeting" : "Meeting";
    const extra = mode === "meeting" && attendees.trim() ? `Attendees: ${attendees.trim()}\n` : "";
    const fd = new FormData();
    fd.set("leadId", lead.id);
    fd.set("type", mode === "call" ? "CALL" : "MEETING");
    if (mode === "call" && outcome) fd.set("outcome", outcome);
    fd.set("summary", `${extra}${notes.trim()}${notes.trim() ? "\n\n" : ""}— ${how}${length}`);
    fd.set("followUp", followUp);
    try {
      await quickLog(fd);
      toast(mode === "call" ? "Call saved to the lead" : "Meeting notes saved to the lead", "ok");
      try {
        localStorage.removeItem(draftKey(lead.id, mode));
      } catch {
        /* ignore */
      }
      setNotes("");
      teardown();
      setMode(null);
      // Drop ?call=1 / ?meeting=1 so a reload doesn't reopen the panel.
      router.replace(`/leads/${lead.id}`, { scroll: false });
      router.refresh();
    } catch (e) {
      toast((e as Error).message || "Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  };

  const who = lead.contactName ?? lead.company;
  const status =
    phase === "connecting" ? "Connecting…" : phase === "ringing" ? "Ringing…" : phase === "live" ? (mode === "call" ? "On the call" : "In the meeting") : phase === "ended" ? "Ended" : "";

  return (
    <>
      <button type="button" onClick={() => open("call")} className="btn-ghost"><Phone className="h-4 w-4" /> Call</button>
      <button type="button" onClick={() => open("meeting")} className="btn-ghost"><Video className="h-4 w-4" /> Meeting</button>

      {mode && (
        <section
          role="dialog"
          aria-label={mode === "call" ? `Call ${who}` : `Meeting with ${who}`}
          className="fixed bottom-4 right-4 z-50 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-[28px] bg-[#0f0f0f] text-white shadow-2xl"
        >
          <header className="flex items-center gap-3 px-5 py-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${phase === "live" ? "bg-[#cdf464] text-black" : "bg-white/10"}`}>
              {mode === "call" ? <Phone className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{who}</p>
              <p className="truncate text-xs text-white/60">
                {status || (mode === "call" ? lead.e164 ?? lead.phone ?? "No phone number" : lead.company)}
                {seconds > 0 && ` · ${formatDuration(seconds)}`}
              </p>
            </div>
            <button type="button" aria-label={minimised ? "Expand" : "Minimise"} onClick={() => setMinimised((m) => !m)} className="rounded-full p-2 hover:bg-white/10"><Minus className="h-4 w-4" /></button>
            <button type="button" aria-label="Close" onClick={close} className="rounded-full p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </header>

          {!minimised && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 pb-5">
              {/* Start */}
              {phase === "choose" && mode === "call" && (
                <div className="grid gap-2">
                  {hasTwilio && (
                    <button type="button" disabled={!lead.e164} onClick={callInBrowser} className="flex items-center justify-center gap-2 rounded-full bg-[#cdf464] py-3 font-medium text-black disabled:opacity-40">
                      <Phone className="h-4 w-4" /> Call in browser (Twilio)
                    </button>
                  )}
                  <button type="button" disabled={!lead.e164} onClick={callByPhone} className={`flex items-center justify-center gap-2 rounded-full py-3 font-medium disabled:opacity-40 ${hasTwilio ? "border border-white/15 hover:bg-white/10" : "bg-[#cdf464] text-black"}`}>
                    <Phone className="h-4 w-4" /> Call from my phone
                  </button>
                  {!lead.e164 && <p className="text-xs text-white/60">This lead has no phone number that can be dialled. You can still take notes below.</p>}
                  {!hasTwilio && <p className="text-xs text-white/50">Want to call from the browser? Connect your Twilio account in Settings → Phone.</p>}
                  <button type="button" onClick={() => setPhase("live")} className="text-xs text-white/50 underline">Already on the call? Just take notes</button>
                </div>
              )}
              {phase === "choose" && mode === "meeting" && (
                <div className="grid gap-2">
                  <button type="button" onClick={() => startMeeting(true)} className="flex items-center justify-center gap-2 rounded-full bg-[#cdf464] py-3 font-medium text-black">
                    <Video className="h-4 w-4" /> Start video meeting
                  </button>
                  <button type="button" onClick={() => startMeeting(false)} className="flex items-center justify-center gap-2 rounded-full border border-white/15 py-3 font-medium hover:bg-white/10">
                    <Users className="h-4 w-4" /> In-person or other app: take notes
                  </button>
                </div>
              )}

              {/* Call controls */}
              {mode === "call" && method === "browser" && (phase === "connecting" || phase === "ringing" || phase === "live") && (
                <div className="space-y-3">
                  <div className="flex justify-center gap-3">
                    <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={() => { call.current?.mute(!muted); setMuted(!muted); }} className={`flex h-12 w-12 items-center justify-center rounded-full ${muted ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"}`}>
                      {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>
                    <button type="button" aria-label="Keypad" onClick={() => setKeypad((k) => !k)} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><Grid3x3 className="h-5 w-5" /></button>
                    <button type="button" aria-label="Hang up" onClick={hangUp} className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ef4444] hover:bg-[#dc2626]"><PhoneOff className="h-5 w-5" /></button>
                  </div>
                  {keypad && (
                    <div className="grid grid-cols-3 gap-2">
                      {"123456789*0#".split("").map((d) => (
                        <button key={d} type="button" onClick={() => call.current?.sendDigits(d)} className="rounded-xl bg-white/10 py-2 text-lg hover:bg-white/20">{d}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {mode === "call" && method === "phone" && phase === "live" && (
                <button type="button" onClick={hangUp} className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-sm hover:bg-white/20">
                  <PhoneOff className="h-4 w-4" /> Call finished
                </button>
              )}
              {mode === "meeting" && meetingUrl && (
                <div className="space-y-2 rounded-2xl bg-white/5 p-3 text-xs">
                  <p className="text-white/60">Send this link to {who}. The meeting opens in its own window; your notes stay here.</p>
                  <p className="truncate font-mono text-white/80">{meetingUrl}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => navigator.clipboard.writeText(meetingUrl).then(() => toast("Meeting link copied", "ok"))} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                    <button type="button" onClick={() => window.open(meetingUrl, "spcrm-meeting", "width=1200,height=800")} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"><ExternalLink className="h-3.5 w-3.5" /> Open meeting</button>
                  </div>
                </div>
              )}
              {mode === "meeting" && phase === "live" && (
                <button type="button" onClick={() => setPhase("ended")} className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-2.5 text-sm hover:bg-white/20">Meeting finished</button>
              )}

              {/* Notes */}
              {mode === "meeting" && (
                <label className="block">
                  <span className="text-xs text-white/60">Who attended</span>
                  <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="e.g. Khun Ploy (owner), Tom (manager)" className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#cdf464]" />
                </label>
              )}
              <label className="block">
                <span className="text-xs text-white/60">{mode === "call" ? "Call notes" : "Meeting notes"}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={mode === "meeting" ? 8 : 5}
                  placeholder={mode === "call" ? "What they said, objections, next step…" : "Agenda, what was discussed, decisions, next steps…"}
                  className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#cdf464]"
                />
              </label>
              {mode === "call" && (
                <div>
                  <span className="text-xs text-white/60">Outcome</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {OUTCOMES.map((o) => (
                      <button key={o} type="button" onClick={() => setOutcome(outcome === o ? "" : o)} aria-pressed={outcome === o} className={`rounded-full px-3 py-1.5 text-xs ${outcome === o ? "bg-[#cdf464] text-black" : "bg-white/10 hover:bg-white/20"}`}>
                        {OUTCOME_LABELS[o]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="block">
                <span className="text-xs text-white/60">Next follow-up</span>
                <Select variant="dark" ariaLabel="Next follow-up" value={followUp} onChange={setFollowUp} className="mt-1" options={FOLLOW_UPS.map(([v, l]) => ({ value: v, label: l }))} />
              </label>
              <button type="button" onClick={save} disabled={saving || (phase === "choose" && !notes.trim())} className="w-full rounded-full bg-white py-3 font-medium text-black hover:bg-white/90 disabled:opacity-40">
                {saving ? "Saving…" : mode === "call" ? "Save call to lead" : "Save meeting to lead"}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
