"use client";

import { Suspense, useState } from "react";
import { Sidebar, type SidebarProject, type SidebarUser } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { AskAIPanel } from "./AskAIPanel";
import { Toaster } from "@/components/ui/Toaster";

export function AppShell({
  user,
  dueCount,
  projects,
  renderedAt,
  children,
}: {
  user: SidebarUser;
  dueCount: number;
  projects: SidebarProject[];
  renderedAt: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} dueCount={dueCount} projects={projects} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <Toolbar isOwner={user.role === "OWNER"} renderedAt={renderedAt} onMenu={() => setMobileOpen(true)} onAskAI={() => setAiOpen(true)} />
        </Suspense>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-6">{children}</main>
      </div>
      <AskAIPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <Toaster />
    </div>
  );
}
