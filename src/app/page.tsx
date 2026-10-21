import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Sales reps start on their Workspace; owners and team leads on the Dashboard. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user?.role === "REP" ? "/workspace" : "/dashboard");
}
