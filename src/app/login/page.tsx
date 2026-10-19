import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";
import { isDbConfigured } from "@/lib/server/config";
import { SignInForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/today");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5">
          <div className="text-lg font-bold tracking-tight">Standard Projects</div>
          <h1 className="text-sm text-slate-500">Sign in to your sales workspace</h1>
        </div>
        {isDbConfigured() ? (
          <SignInForm />
        ) : (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">The CRM isn&apos;t connected to its database yet.</p>
            <p className="mt-1">
              Add <code>POSTGRES_PRISMA_URL</code> and <code>POSTGRES_URL_NON_POOLING</code> in Vercel → Project →
              Settings → Environment Variables, then redeploy.
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">Forgot your password? Ask the owner for a new sign-in link.</p>
      </div>
    </main>
  );
}
