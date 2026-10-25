-- Do-not-email, bounces and consent on leads.
ALTER TABLE "public"."Lead" ADD COLUMN "emailOptOutAt" TIMESTAMP(3);
ALTER TABLE "public"."Lead" ADD COLUMN "emailOptOutReason" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN "emailBouncedAt" TIMESTAMP(3);
ALTER TABLE "public"."Lead" ADD COLUMN "emailBounceReason" TEXT;
ALTER TABLE "public"."Lead" ADD COLUMN "emailConsentAt" TIMESTAMP(3);
ALTER TABLE "public"."Lead" ADD COLUMN "emailConsentNote" TEXT;
