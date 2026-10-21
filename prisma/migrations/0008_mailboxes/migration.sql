-- Email integration: connected mailboxes, CRM-written drafts, scheduler tickets, email fields on activities. Additive only.
-- AlterTable
ALTER TABLE "public"."Activity" ADD COLUMN IF NOT EXISTS "mailboxId" TEXT,
ADD COLUMN IF NOT EXISTS "subject" TEXT,
ADD COLUMN IF NOT EXISTS "threadId" TEXT,
ADD COLUMN IF NOT EXISTS "webLink" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."Mailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "cursor" TEXT,
    "labelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."EmailDraft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyToActivityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentActivityId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."CronTicket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "CronTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Mailbox_userId_provider_key" ON "public"."Mailbox"("userId", "provider");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailDraft_leadId_idx" ON "public"."EmailDraft"("leadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailDraft_status_idx" ON "public"."EmailDraft"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Activity_threadId_idx" ON "public"."Activity"("threadId");

-- AddForeignKey
ALTER TABLE "public"."Mailbox" ADD CONSTRAINT "Mailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailDraft" ADD CONSTRAINT "EmailDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailDraft" ADD CONSTRAINT "EmailDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only the app (Prisma, table owner) may read these; tokens never reach the public API.
ALTER TABLE "public"."Mailbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CronTicket" ENABLE ROW LEVEL SECURITY;
