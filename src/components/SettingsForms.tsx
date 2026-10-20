"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  addPerson,
  createSignInLink,
  createTeam,
  deleteTeam,
  removePerson,
  renameTeam,
  updatePerson,
  type FormResult,
} from "@/app/actions";

type Team = { id: string; name: string; memberCount: number };
type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  openLeads: number;
  hasPassword: boolean;
};

const ROLE_OPTIONS = [
  { value: "REP", label: "Sales rep (own leads only)" },
  { value: "TEAM_LEAD", label: "Team lead (their team)" },
  { value: "OWNER", label: "Owner (everything)" },
];

function Submit({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}

function Message({ state }: { state: FormResult }) {
  if (state.link) return <LinkBox link={state.link} name={state.linkFor ?? "them"} />;
  if (!state.error) return null;
  return <p className="mt-2 text-sm text-rose-600">{state.error}</p>;
}

/** Shows a freshly made one-time sign-in link. It's never shown again, so copy it now. */
function LinkBox({ link, name }: { link: string; name: string }) {
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-medium text-emerald-900">Send this one-time link to {name} so they can set a password:</p>
      <div className="mt-2 flex gap-2">
        <input readOnly value={link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Sign-in link" />
        <button type="button" className="btn-ghost shrink-0" onClick={() => navigator.clipboard.writeText(link)}>
          Copy
        </button>
      </div>
      <p className="mt-1 text-xs text-emerald-800">Works once and expires in 7 days. It won&apos;t be shown again.</p>
    </div>
  );
}

/** Clears a form after a successful submit. */
function useResetOnOk(state: FormResult) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function CreateTeamForm() {
  const [state, action] = useActionState(createTeam, {});
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action}>
      <div className="flex gap-2">
        <input name="name" required placeholder="New team name, e.g. Sales" className="input" />
        <Submit>Create team</Submit>
      </div>
      <Message state={state} />
    </form>
  );
}

export function TeamRow({ team }: { team: Team }) {
  const [renameState, rename] = useActionState(renameTeam, {});
  const [deleteState, del] = useActionState(deleteTeam, {});
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3">
      <form action={rename} className="flex flex-1 items-center gap-2">
        <input type="hidden" name="teamId" value={team.id} />
        <input name="name" defaultValue={team.name} required className="input max-w-xs" aria-label="Team name" />
        <Submit className="btn-ghost">Rename</Submit>
      </form>
      <span className="chip">
        {team.memberCount} {team.memberCount === 1 ? "person" : "people"}
      </span>
      <form
        action={del}
        onSubmit={(e) => {
          if (!confirm(`Delete the ${team.name} team? Its people stay in the CRM without a team.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="teamId" value={team.id} />
        <Submit className="btn text-rose-600 hover:bg-rose-50">Delete</Submit>
      </form>
      <div className="w-full">
        <Message state={renameState} />
        <Message state={deleteState} />
      </div>
    </li>
  );
}

function TeamSelect({ teams, defaultValue }: { teams: Team[]; defaultValue?: string | null }) {
  return (
    <select name="teamId" defaultValue={defaultValue ?? ""} className="input" aria-label="Team">
      <option value="">No team</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export function AddPersonForm({ teams }: { teams: Team[] }) {
  const [state, action] = useActionState(addPerson, {});
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="new-person-name" className="label">Name</label>
        <input id="new-person-name" name="name" required className="input" />
      </div>
      <div>
        <label htmlFor="new-person-email" className="label">Email</label>
        <input id="new-person-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="new-person-role" className="label">Role</label>
        <select id="new-person-role" name="role" defaultValue="REP" className="input">
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Team</label>
        <TeamSelect teams={teams} />
      </div>
      <div className="sm:col-span-2">
        <Submit>Add person</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

export function PersonRow({ person, teams, isMe }: { person: Person; teams: Team[]; isMe: boolean }) {
  const [updateState, update] = useActionState(updatePerson, {});
  const [removeState, remove] = useActionState(removePerson, {});
  const [linkState, makeLink] = useActionState(createSignInLink, {});
  const updateRef = useRef<HTMLFormElement>(null);
  // A rejected change (e.g. demoting the last owner) snaps the dropdowns back to the saved values.
  useEffect(() => {
    if (updateState.error) updateRef.current?.reset();
  }, [updateState]);
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <div className="font-medium">
            {person.name} {isMe && <span className="chip ml-1">You</span>}
          </div>
          <div className="text-sm text-ink-3">
            {person.email} · {person.openLeads} open leads
            {!person.hasPassword && <span className="chip ml-2 bg-amber-50 text-amber-700">No password yet</span>}
          </div>
        </div>
        <form ref={updateRef} action={update} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="userId" value={person.id} />
          <select name="role" defaultValue={person.role} className="input w-auto" aria-label="Role">
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label.split(" (")[0]}
              </option>
            ))}
          </select>
          <div className="w-40">
            <TeamSelect teams={teams} defaultValue={person.teamId} />
          </div>
          <Submit className="btn-ghost">Save</Submit>
        </form>
        <form action={makeLink}>
          <input type="hidden" name="userId" value={person.id} />
          <Submit className="btn-ghost">{person.hasPassword ? "Reset link" : "Sign-in link"}</Submit>
        </form>
        {!isMe && (
          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm(`Remove ${person.name}? Their ${person.openLeads} open leads go back to the unassigned pool.`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="userId" value={person.id} />
            <Submit className="btn text-rose-600 hover:bg-rose-50">Remove</Submit>
          </form>
        )}
      </div>
      <Message state={updateState} />
      <Message state={removeState} />
      <Message state={linkState} />
    </li>
  );
}
