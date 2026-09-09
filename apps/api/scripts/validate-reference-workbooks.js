/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');

const MAX = {
  civilId: 12,
  fullName: 255,
  phone: 20,
  serviceCode: 50,
  serviceName: 255,
};

const aliases = {
  civilId: ['civilid', 'civil id', 'national id', 'civil_no', 'civil number', 'الرقم المدني (يملأ يدويا)'],
  fullNameAr: ['fullnamear', 'full name ar', 'arabic name', 'name ar', 'arabic full name', 'اسم المريضة (عربي)'],
  fullNameEn: ['fullnameen', 'full name en', 'english name', 'name en', 'english full name', 'اسم المريضة (إنجليزي)'],
  phone: ['phone', 'mobile', 'mobile phone', 'telephone', 'رقم التليفون'],
  dateOfBirth: ['dateofbirth', 'date of birth', 'dob', 'birth date'],
  address: ['address'],
  name: ['name', 'service name', 'service', 'اسم الخدمة'],
  code: ['code', 'service code', 'الكود'],
  currentPrice: ['currentprice', 'current price', 'price', 'amount', 'cost', 'السعر الحالي (د.ك)'],
  isActive: ['isactive', 'is active', 'active', 'enabled', 'مفعلة؟'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[؟?()]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellValue(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim();
  return String(cell).trim();
}

function resolveHeaders(row) {
  const headers = new Map();
  row.eachCell({ includeEmpty: false }, (cell, column) => {
    const normalized = normalizeHeader(cellValue(cell.value));
    if (normalized) headers.set(normalized, column);
  });
  return headers;
}

function findColumn(headers, field) {
  const candidates = aliases[field].map(normalizeHeader);
  return candidates.map((candidate) => headers.get(candidate)).find(Boolean);
}

function isMetadataRow(row) {
  const values = row.values.map(cellValue).filter(Boolean);
  if (values.length < 2) return false;
  const knownLabels = Object.values(aliases).flat().map(normalizeHeader);
  return values.filter((value) => knownLabels.includes(normalizeHeader(value))).length >= 2;
}

function readField(row, headers, field) {
  const column = findColumn(headers, field);
  return column ? cellValue(row.getCell(column).value) : '';
}

function issue(issues, row, field, message) {
  issues.push({ row, field, message });
}

function parseBoolean(value, row, field, issues) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  if (['true', 'yes', '1', 'active', 'enabled'].includes(normalized)) return true;
  if (['false', 'no', '0', 'inactive', 'disabled'].includes(normalized)) return false;
  issue(issues, row, field, `Expected a boolean value, received "${value}"`);
  return true;
}

function parsePrice(value, row, issues) {
  const normalized = value.replace(/,/g, '').trim();
  const price = Number(normalized);
  if (!normalized || !Number.isFinite(price)) {
    issue(issues, row, 'currentPrice', 'Price is required and must be numeric');
    return null;
  }
  if (price < 0 || Math.round(price * 100) !== price * 100) {
    issue(issues, row, 'currentPrice', 'Price must be non-negative with at most two decimals');
    return null;
  }
  return Number(price.toFixed(2));
}

function validateWorkbook(workbook, kind) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Workbook has no worksheets');

  const headers = resolveHeaders(worksheet.getRow(1));
  const requiredFields = kind === 'patients' ? ['civilId', 'fullNameAr'] : ['name', 'currentPrice'];
  const missingHeaders = requiredFields.filter((field) => !findColumn(headers, field));
  const issues = missingHeaders.map((field) => ({
    row: 1,
    field,
    message: `Required column is missing (accepted names: ${aliases[field].join(', ')})`,
  }));
  const records = [];
  const seen = new Map();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || isMetadataRow(row)) return;
    const hasValue = row.values.some((value) => cellValue(value) !== '');
    if (!hasValue) return;

    if (kind === 'patients') {
      const civilId = readField(row, headers, 'civilId');
      const fullNameAr = readField(row, headers, 'fullNameAr');
      const fullNameEn = readField(row, headers, 'fullNameEn');
      const phone = readField(row, headers, 'phone');
      const dateOfBirth = readField(row, headers, 'dateOfBirth');
      const address = readField(row, headers, 'address');

      if (!civilId) issue(issues, rowNumber, 'civilId', 'Civil ID is required; blank values cannot be imported');
      if (civilId.length > MAX.civilId) issue(issues, rowNumber, 'civilId', `Civil ID exceeds ${MAX.civilId} characters`);
      if (fullNameAr.length === 0) issue(issues, rowNumber, 'fullNameAr', 'Arabic full name is required');
      if (fullNameAr.length > MAX.fullName || fullNameEn.length > MAX.fullName) {
        issue(issues, rowNumber, 'fullName', `Name exceeds ${MAX.fullName} characters`);
      }
      if (phone.length > MAX.phone) issue(issues, rowNumber, 'phone', `Phone exceeds ${MAX.phone} characters`);
      if (dateOfBirth && Number.isNaN(Date.parse(dateOfBirth))) {
        issue(issues, rowNumber, 'dateOfBirth', 'Date of birth must be a valid date');
      }
      if (civilId) {
        const previous = seen.get(civilId);
        if (previous) issue(issues, rowNumber, 'civilId', `Duplicate Civil ID; first seen on row ${previous}`);
        else seen.set(civilId, rowNumber);
      }
      records.push({ civilId, fullNameAr, fullNameEn: fullNameEn || null, phone: phone || null, dateOfBirth: dateOfBirth || null, address: address || null });
    } else {
      const name = readField(row, headers, 'name');
      const code = readField(row, headers, 'code');
      const currentPrice = readField(row, headers, 'currentPrice');
      const isActive = readField(row, headers, 'isActive');

      if (!name) issue(issues, rowNumber, 'name', 'Service name is required');
      if (name.length > MAX.serviceName) issue(issues, rowNumber, 'name', `Service name exceeds ${MAX.serviceName} characters`);
      if (code.length > MAX.serviceCode) issue(issues, rowNumber, 'code', `Service code exceeds ${MAX.serviceCode} characters`);
      const price = parsePrice(currentPrice, rowNumber, issues);
      const active = parseBoolean(isActive, rowNumber, 'isActive', issues);
      if (code) {
        const previous = seen.get(code);
        if (previous) issue(issues, rowNumber, 'code', `Duplicate service code; first seen on row ${previous}`);
        else seen.set(code, rowNumber);
      }
      records.push({ name, code: code || null, currentPrice: price, isActive: active });
    }
  });

  return { worksheet: worksheet.name, records, issues };
}

async function loadWorkbook(file) {
  if (!file) throw new Error('Input workbook path is required');
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`Workbook does not exist: ${resolved}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolved);
  return { workbook, resolved };
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const kind = getArg('--kind');
  if (!['patients', 'services'].includes(kind)) {
    throw new Error('--kind must be either patients or services');
  }
  const input = getArg('--input');
  const output = getArg('--out');
  const { workbook, resolved } = await loadWorkbook(input);
  const result = validateWorkbook(workbook, kind);
  const report = {
    kind,
    input: resolved,
    generatedAt: new Date().toISOString(),
    rowCount: result.records.length,
    issueCount: result.issues.length,
    importable: result.issues.length === 0,
    worksheet: result.worksheet,
    issues: result.issues,
    records: result.records,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) fs.writeFileSync(path.resolve(output), json, 'utf8');
  process.stdout.write(`Validated ${result.records.length} ${kind} rows from ${resolved}\n`);
  process.stdout.write(`Issues: ${result.issues.length}; importable: ${report.importable ? 'yes' : 'no'}\n`);
  if (result.issues.length) {
    for (const item of result.issues.slice(0, 20)) {
      process.stdout.write(`row ${item.row}, ${item.field}: ${item.message}\n`);
    }
    if (result.issues.length > 20) process.stdout.write(`... ${result.issues.length - 20} more issues in the report\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
