-- Allow legacy patients to be imported before their Civil IDs are verified.
ALTER TABLE "Patient"
  ALTER COLUMN "civilId" DROP NOT NULL;

ALTER TABLE "Patient"
  ADD COLUMN "legacySource" TEXT,
  ADD COLUMN "legacyPatientKey" TEXT,
  ADD COLUMN "legacyReference" TEXT;

-- The deterministic source-qualified row key makes imports idempotent without
-- treating old_file_no as globally unique.
CREATE UNIQUE INDEX "Patient_legacySource_legacyPatientKey_key"
  ON "Patient"("legacySource", "legacyPatientKey")
  WHERE "legacySource" IS NOT NULL AND "legacyPatientKey" IS NOT NULL;
