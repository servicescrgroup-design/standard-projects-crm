"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvite, signIn } from "@/app/actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full py-2.5" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

export function SignInForm() {
  const [state, action] = useActionState(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input py-2.5" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input py-2.5"
        />
      </div>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <Submit>Sign in</Submit>
    </form>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="label">
          New password (at least 10 characters)
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input py-2.5" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirm password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input py-2.5" />
      </div>
      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <Submit>Set password and sign in</Submit>
    </form>
  );
}
