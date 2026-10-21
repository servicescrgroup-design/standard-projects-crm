"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { createLead } from "@/app/actions";
import { DuplicateWarning } from "@/components/DuplicateWarning";

/** "Add contact": a quick form that creates a lead and opens it. */
export function AddContactButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
        <Plus className="h-4 w-4" /> Add contact
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form action={createLead} role="dialog" aria-label="Add contact" className="w-full max-w-lg rounded-2xl border border-line bg-white shadow-[var(--shadow-menu)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold">Add contact</h2>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-ink-2 hover:bg-hover"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <DuplicateWarning />
              <label className="sm:col-span-2"><span className="label">Company *</span><input name="company" required className="input" autoFocus /></label>
              <label><span className="label">Contact name</span><input name="contactName" className="input" /></label>
              <label><span className="label">Email</span><input name="email" type="email" className="input" /></label>
              <label><span className="label">Phone or LINE ID</span><input name="phone" className="input" /></label>
              <label><span className="label">Website</span><input name="website" className="input" placeholder="example.com" /></label>
              <label className="sm:col-span-2"><span className="label">Location</span><input name="location" className="input" placeholder="City, Country" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-hover">Cancel</button>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Add contact</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
