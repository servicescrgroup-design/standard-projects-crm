-- AlterTable
ALTER TABLE "public"."Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "budget" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "caseStudies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "googleRating" DOUBLE PRECISION,
ADD COLUMN     "googleReviews" INTEGER,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "needs" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "offersToPitch" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "package" TEXT,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "socialLinks" TEXT,
ADD COLUMN     "sourceLink" TEXT,
ADD COLUMN     "whyFit" TEXT;


-- CreateIndex
CREATE UNIQUE INDEX "Lead_externalRef_key" ON "public"."Lead"("externalRef");

-- CreateIndex
CREATE INDEX "Lead_priority_idx" ON "public"."Lead"("priority");

-- CreateIndex
CREATE INDEX "Lead_segment_idx" ON "public"."Lead"("segment");

