-- Templates can be written for particular countries and industries (empty = any).
ALTER TABLE "public"."EmailTemplate" ADD COLUMN "countries" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."EmailTemplate" ADD COLUMN "industries" TEXT[] DEFAULT ARRAY[]::TEXT[];
