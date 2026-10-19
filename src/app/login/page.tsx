import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";
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
        <SignInForm />
        <p className="mt-4 text-xs text-slate-500">Forgot your password? Ask the owner for a new sign-in link.</p>
      </div>
    </main>
  );
}
