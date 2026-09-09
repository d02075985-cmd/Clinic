# Reference Data Import Runbook

This runbook prepares the supplied service and patient workbooks for a controlled
staging import. It does **not** write to PostgreSQL. Do not import the source
files directly with SQL or Prisma Studio.

## Current data blockers

- New application-created patients require a non-empty, unique `civilId`
  (maximum 12 characters). Legacy import rows may have NULL `civilId` until an
  administrator records the real value.
- `old_file_no` is preserved as legacy reference metadata and is not a Clinic
  Civil ID. It is not globally unique and must not be used as a patient key.
- Patient rows must have an Arabic full name to import. Invalid or ambiguous
  phone values are held for manual review.
- Services require a name and a non-negative price with at most two decimals.
  Service codes are optional but must be unique when present.

## Validate without changing data

Run from the repository root:

```powershell
npm ci
npm run import:validate --workspace=apps/api -- --kind services --input "C:\path\services_import_clean.xlsx" --out "services.validation.json"
npm run import:validate --workspace=apps/api -- --kind patients --input "C:\path\patients_import_clean.xlsx" --out "patients.validation.json"
```

The command exits non-zero when any row is invalid, prints the first 20 issues,
and writes a JSON report containing normalized records and every issue. Keep
the reports with the source-file checksum as the import evidence.

## Controlled import procedure

1. Take and verify a PostgreSQL backup of the staging database.
2. Run the controlled importer in `--dry-run` mode.
3. Review the manual-review report and expected imported/skipped counts.
4. Apply only the valid rows; missing Civil IDs remain NULL and are never
   synthesized.
5. The importer uses row-level transactions, deterministic source keys,
   duplicate checks, and audit logging. Do not bypass these safeguards.
6. Import services before any invoices reference them.
7. Run patient/service counts, duplicate checks, and a sample read-back after
   import.
8. Keep the original workbooks, reports, checksums, backup ID, operator, and
   timestamp together for rollback/audit purposes.

The validation command has no write mode. The separate importer requires an
explicit staging target and administrator identity, uses row-level transactions,
preserves audit events, and never silently updates an existing patient or
service.

The controlled importer is separate from the validator and supports
`--dry-run` and `--apply`. It treats rows requiring manual review as expected
report output rather than silently importing them:

```powershell
npm run import:reference --workspace=apps/api -- --patients "C:\path\patients_import_clean.xlsx" --services "C:\path\services_import_clean.xlsx" --dry-run --out "legacy-import-dry-run.json"
```

Apply requires all of `LEGACY_IMPORT_TARGET=staging`,
`STAGING_DATABASE_CONFIRMED=true`, `STAGING_BACKUP_CONFIRMED=true`, and an
existing staging admin `IMPORT_OPERATOR_ID`. The importer uses
`patients_import_clean.xlsx` plus the source row number as the deterministic
legacy key, preserves `old_file_no` as a reference, writes audit events, and
does not import manual-review rows.

## Field mapping

### Services

| Workbook field | Clinic field |
| --- | --- |
| `name` / service name | `Service.name` |
| `code` / service code | `Service.code` |
| `price` / amount | `Service.currentPrice` |
| `active` / enabled | `Service.isActive` |

### Patients

| Workbook field | Clinic field |
| --- | --- |
| `civilId` / national ID | `Patient.civilId` |
| Arabic name | `Patient.fullNameAr` |
| English name | `Patient.fullNameEn` |
| phone / mobile | `Patient.phone` |
| date of birth | `Patient.dateOfBirth` |
| address | `Patient.address` |

Unmapped source columns are retained only in the original workbook and must not
be silently discarded during a future reviewed import.
