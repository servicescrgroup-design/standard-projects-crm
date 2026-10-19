import { db } from "@/lib/server/db";
import { hashToken } from "@/lib/auth";
import { SetPasswordForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  const valid = invite && !invite.usedAt && invite.expiresAt > new Date();

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5">
          <div className="text-lg font-bold tracking-tight">Standard Projects</div>
          <h1 className="text-sm text-slate-500">
            {valid ? `Welcome, ${invite.user.name}. Choose a password.` : "This link isn&apos;t valid"}
          </h1>
        </div>
        {valid ? (
          <>
            <p className="mb-4 text-sm text-slate-500">You&apos;ll sign in with {invite.user.email}.</p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <p className="text-sm text-slate-600">It has expired or was already used. Ask the owner for a new sign-in link.</p>
        )}
      </div>
    </main>
  );
}
