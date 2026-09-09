/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const SOURCE = 'patients_import_clean.xlsx';
const PATIENT_COLUMNS = {
  civilId: 1,
  fullNameAr: 2,
  fullNameEn: 3,
  phone: 4,
  legacyReference: 5,
};
const SERVICE_COLUMNS = {
  name: 1,
  code: 2,
  description: 3,
  currentPrice: 4,
  isActive: 5,
};

function value(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim();
  return String(cell).trim();
}

function normalized(valueToNormalize) {
  return String(valueToNormalize ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') options.mode = 'dry-run';
    else if (arg === '--apply') options.mode = 'apply';
    else if (arg.startsWith('--')) options[arg.slice(2)] = args[index + 1];
  }
  if (!options.mode) throw new Error('Choose exactly one mode: --dry-run or --apply');
  return options;
}

function assertApplySafety() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing legacy import with NODE_ENV=production');
  if (process.env.LEGACY_IMPORT_TARGET !== 'staging') throw new Error('Set LEGACY_IMPORT_TARGET=staging to apply');
  if (process.env.STAGING_DATABASE_CONFIRMED !== 'true') throw new Error('Set STAGING_DATABASE_CONFIRMED=true after verifying the database target');
  if (process.env.STAGING_BACKUP_CONFIRMED !== 'true') throw new Error('Set STAGING_BACKUP_CONFIRMED=true after creating and verifying a staging backup');
  if (!process.env.IMPORT_OPERATOR_ID) throw new Error('Set IMPORT_OPERATOR_ID to an existing staging admin UUID');
}

async function readWorkbook(filePath, kind) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Workbook does not exist: ${resolved}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error(`Workbook has no worksheets: ${resolved}`);
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    const hasValues = row.values.slice(1).some((item) => value(item) !== '');
    if (!hasValues) return;
    const columns = kind === 'patients' ? PATIENT_COLUMNS : SERVICE_COLUMNS;
    const record = {};
    for (const [field, column] of Object.entries(columns)) record[field] = value(row.getCell(column).value);
    rows.push({ rowNumber, ...record });
  });
  return { file: resolved, worksheet: worksheet.name, rows };
}

function validPhone(phone) {
  if (!phone) return { value: null, reason: 'missing' };
  const trimmed = phone.trim();
  if (!/^\+?[0-9][0-9 ()-]{5,18}[0-9]$/.test(trimmed)) {
    return { value: null, reason: 'ambiguous-or-invalid-format' };
  }
  const digits = trimmed.replace(/[ ()-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(digits)) return { value: null, reason: 'invalid-length' };
  return { value: trimmed, reason: null };
}

function parsePrice(price) {
  const numeric = Number(price.replace(/,/g, ''));
  if (!price || !Number.isFinite(numeric) || numeric < 0 || Math.round(numeric * 100) !== numeric * 100) return null;
  return Number(numeric.toFixed(2));
}

function parseActive(valueToParse) {
  if (['true', 'yes', '1', 'active', 'enabled'].includes(normalized(valueToParse))) return true;
  if (['false', 'no', '0', 'inactive', 'disabled'].includes(normalized(valueToParse))) return false;
  return null;
}

function patientReview(record) {
  const review = [];
  if (!record.fullNameAr) review.push('missing-Arabic-name');
  const phone = validPhone(record.phone);
  if (phone.reason && phone.reason !== 'missing') review.push(`phone:${phone.reason}`);
  return { review, phone: phone.value };
}

function legacyKey(record) {
  return `row:${record.rowNumber}`;
}

async function existingPatientState(prisma, rows) {
  const keys = rows.map((row) => legacyKey(row));
  const existing = await prisma.patient.findMany({
    where: { legacySource: SOURCE, legacyPatientKey: { in: keys } },
    select: { id: true, legacyPatientKey: true, civilId: true, fullNameAr: true },
  });
  return new Map(existing.map((patient) => [patient.legacyPatientKey, patient]));
}

function duplicateReferences(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.legacyReference) continue;
    const key = normalized(row.legacyReference);
    if (!groups.has(key)) groups.set(key, { value: row.legacyReference, rows: [] });
    groups.get(key).rows.push(row.rowNumber);
  }
  return [...groups.values()].filter((group) => group.rows.length > 1);
}

async function patientReport(prisma, workbook, mode) {
  const existing = await existingPatientState(prisma, workbook.rows);
  const report = {
    kind: 'patients',
    source: workbook.file,
    sourceRows: workbook.rows.length,
    imported: 0,
    skipped: 0,
    manualReview: 0,
    missingCivilIds: workbook.rows.length,
    missingArabicNames: 0,
    invalidPhones: 0,
    duplicateLegacyReferences: duplicateReferences(workbook.rows),
    existingConflicts: [],
    manualReviewRows: [],
    skippedRows: [],
    appliedRows: [],
  };

  for (const row of workbook.rows) {
    const review = patientReview(row);
    const existingPatient = existing.get(legacyKey(row));
    if (existingPatient) {
      report.existingConflicts.push({ row: row.rowNumber, patientId: existingPatient.id, type: 'already-imported' });
      report.skipped += 1;
      report.skippedRows.push({ row: row.rowNumber, reason: 'already-imported', patientId: existingPatient.id });
      continue;
    }
    if (!row.fullNameAr) report.missingArabicNames += 1;
    if (review.review.some((item) => item.startsWith('phone:'))) report.invalidPhones += 1;
    if (review.review.length) {
      report.manualReview += 1;
      report.manualReviewRows.push({ row: row.rowNumber, reasons: review.review, legacyReference: row.legacyReference || null });
      continue;
    }
    report.imported += 1;
    report.appliedRows.push({ row: row.rowNumber, legacyReference: row.legacyReference || null });
    if (mode === 'apply') {
      await prisma.$transaction(async (tx) => {
        const patient = await tx.patient.create({
          data: {
            civilId: null,
            fullNameAr: row.fullNameAr,
            fullNameEn: row.fullNameEn || null,
            phone: review.phone,
            legacySource: SOURCE,
            legacyPatientKey: legacyKey(row),
            legacyReference: row.legacyReference || null,
            createdById: process.env.IMPORT_OPERATOR_ID,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: process.env.IMPORT_OPERATOR_ID,
            action: 'LEGACY_IMPORT',
            entityType: 'Patient',
            entityId: patient.id,
            afterState: JSON.stringify({ source: SOURCE, sourceRow: row.rowNumber, legacyReference: row.legacyReference || null }),
          },
        });
      });
    }
  }
  return report;
}

async function serviceReport(prisma, workbook, mode) {
  const report = {
    kind: 'services',
    source: workbook.file,
    sourceRows: workbook.rows.length,
    imported: 0,
    skipped: 0,
    manualReview: 0,
    conflicts: [],
    appliedRows: [],
  };
  for (const row of workbook.rows) {
    const price = parsePrice(row.currentPrice);
    const active = parseActive(row.isActive);
    if (!row.name || price === null || active === null) {
      report.manualReview += 1;
      report.conflicts.push({ row: row.rowNumber, reason: 'invalid-required-service-field' });
      continue;
    }
    const existing = row.code
      ? await prisma.service.findUnique({ where: { code: row.code } })
      : await prisma.service.findFirst({ where: { name: row.name } });
    if (existing) {
      const same = existing.name === row.name && Number(existing.currentPrice) === price && existing.isActive === active && (!row.code || existing.code === row.code);
      if (same) {
        report.skipped += 1;
        report.appliedRows.push({ row: row.rowNumber, serviceId: existing.id, action: 'already-imported' });
      } else {
        report.manualReview += 1;
        report.conflicts.push({ row: row.rowNumber, reason: 'existing-service-conflict', serviceId: existing.id });
      }
      continue;
    }
    report.imported += 1;
    if (mode === 'apply') {
      await prisma.$transaction(async (tx) => {
        const service = await tx.service.create({
          data: {
            name: row.name,
            code: row.code || null,
            description: row.description || null,
            currentPrice: price,
            isActive: active,
            createdById: process.env.IMPORT_OPERATOR_ID,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: process.env.IMPORT_OPERATOR_ID,
            action: 'REFERENCE_IMPORT',
            entityType: 'Service',
            entityId: service.id,
            afterState: JSON.stringify({ source: path.basename(workbook.file), sourceRow: row.rowNumber }),
          },
        });
      });
    }
  }
  return report;
}

async function main() {
  const options = parseArgs();
  if (options.mode === 'apply') assertApplySafety();
  const patientsFile = options.patients || path.join(process.cwd(), 'patients_import_clean.xlsx');
  const servicesFile = options.services || path.join(process.cwd(), 'services_import_clean.xlsx');
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const patients = await patientReport(prisma, await readWorkbook(patientsFile, 'patients'), options.mode);
    const services = await serviceReport(prisma, await readWorkbook(servicesFile, 'services'), options.mode);
    const report = { generatedAt: new Date().toISOString(), mode: options.mode, target: process.env.LEGACY_IMPORT_TARGET || 'unspecified', patients, services };
    const output = options.out || `legacy-import-${options.mode}.json`;
    fs.writeFileSync(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
