-- Per-user UI preferences (dashboard layout and similar). Additive, defaults to {}.
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "preferences" JSONB NOT NULL DEFAULT '{}';
