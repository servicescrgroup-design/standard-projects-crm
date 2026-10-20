-- Manual card order within a Kanban column. Additive and nullable.
ALTER TABLE "public"."Lead" ADD COLUMN IF NOT EXISTS "boardPosition" DOUBLE PRECISION;
