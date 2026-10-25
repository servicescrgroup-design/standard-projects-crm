-- Demo projects: sample sites built for a lead before the deal is won, sent with the offer.
CREATE TABLE "public"."DemoProject" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "brief" TEXT,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "demoUrl" TEXT,
    "quoteId" TEXT,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "interestedAt" TIMESTAMP(3),
    "clientNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DemoProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoProject_token_key" ON "public"."DemoProject"("token");
CREATE INDEX "DemoProject_leadId_idx" ON "public"."DemoProject"("leadId");
CREATE INDEX "DemoProject_status_idx" ON "public"."DemoProject"("status");
ALTER TABLE "public"."DemoProject" ADD CONSTRAINT "DemoProject_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."DemoProject" ADD CONSTRAINT "DemoProject_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
