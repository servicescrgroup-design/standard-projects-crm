-- Territories: the owner assigns countries and/or companies to team leads and reps, who then see
-- only those leads (plus their own). Lead.country is a stored copy of countryOfLead() so access can be
-- checked in the database. Existing rows are filled by `npm run db:backfill-country`.
ALTER TABLE "User" ADD COLUMN "allowedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "allowedCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Lead" ADD COLUMN "country" TEXT;
CREATE INDEX "Lead_country_idx" ON "Lead"("country");
