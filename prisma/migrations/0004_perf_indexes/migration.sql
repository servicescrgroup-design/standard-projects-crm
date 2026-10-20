-- Speeds up "my open leads" (Today, the nav badge) and follow-up ordering.
CREATE INDEX IF NOT EXISTS "Lead_ownerId_stage_idx" ON "public"."Lead"("ownerId", "stage");
CREATE INDEX IF NOT EXISTS "Lead_nextFollowUpAt_idx" ON "public"."Lead"("nextFollowUpAt");
