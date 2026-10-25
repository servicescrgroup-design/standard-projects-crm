-- Which template an email started from (reply-rate stats).
ALTER TABLE "public"."EmailDraft" ADD COLUMN "templateId" TEXT;
CREATE INDEX "EmailDraft_templateId_idx" ON "public"."EmailDraft"("templateId");
