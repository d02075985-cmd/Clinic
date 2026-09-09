const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { validateWorkbook } = require('./validate-reference-workbooks');

async function workbookForRows(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Patients');
  worksheet.addRow(['civilId', 'fullNameAr', 'fullNameEn', 'phone', 'old_file_no']);
  for (const row of rows) worksheet.addRow(row);
  return workbook;
}

test('allows blank Civil IDs for legacy patient imports', async () => {
  const result = validateWorkbook(
    await workbookForRows([['', 'مريض legacy', '', '99926803', '1001']]),
    'patients',
  );

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].civilId, '');
  assert.equal(result.records[0].legacyReference, '1001');
  assert.equal(result.issues.length, 0);
});

test('rejects supplied malformed and duplicate Civil IDs', async () => {
  const result = validateWorkbook(
    await workbookForRows([
      ['ABC123', 'مريض أول', '', '99926803', '1001'],
      ['1234567890123', 'مريض ثان', '', '99926804', '1002'],
      ['123456789', 'مريض ثالث', '', '99926805', '1003'],
      ['123456789', 'مريض رابع', '', '99926806', '1004'],
    ]),
    'patients',
  );

  assert.equal(result.issues.filter((issue) => issue.field === 'civilId').length, 3);
  assert.match(result.issues.find((issue) => issue.row === 2).message, /digits/);
  assert.match(result.issues.find((issue) => issue.row === 5).message, /Duplicate Civil ID/);
});
