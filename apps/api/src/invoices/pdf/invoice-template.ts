import { CLINIC_LOGO_BASE64 } from './clinic-logo';
import { Decimal } from '@prisma/client/runtime/library';

// Loose shape matching InvoicesService.findOne()'s include (invoiceItems + service.code,
// patient, visit + diagnosis, payments). Kept local (rather than importing Prisma's
// generated types) so this template has no dependency beyond the plain data it's handed.
export interface InvoicePdfData {
  invoiceNumber: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  subtotal: number | string;
  total: number | string;
  paid: number | string;
  remaining: number | string;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  issuedAt?: string | Date | null;
  createdAt: string | Date;
  replacedByInvoiceId?: string | null;
  patient: {
    fullNameAr: string;
    civilId: string;
    phone?: string | null;
  };
  visit?: {
    type: 'CHECKUP' | 'FOLLOW_UP' | 'OTHER';
    diagnosis?: string | null;
  } | null;
  invoiceItems: Array<{
    serviceNameSnapshot: string;
    unitPriceSnapshot: number | string;
    quantity: number;
    lineTotal: number | string;
    service?: { code: string | null } | null;
  }>;
  additionalCharges?: Array<{
    chargeType: 'PERCENTAGE' | 'FIXED';
    chargeValue: number | string;
    calculatedAmount: number | string;
    description?: string | null;
  }>;
  payments: Array<{
    amount: number | string;
    method: 'CASH' | 'VISA' | 'KNET' | 'OTHER';
    paymentDate: string | Date;
    status?: 'RECORDED' | 'REVERSED';
  }>;
}

// Fixed clinic identity — single-doctor clinic, this never changes per invoice.
const DOCTOR_NAME_AR = 'د. نداء "محمد" خضور';
const DOCTOR_TITLE_AR = 'استشاري أمراض النساء والولادة والعقم';

const CLINIC_NAME_AR = 'مركز العيادات التخصصية';
const CLINIC_NAME_EN = 'Specialized Clinics Center';

const CLINIC_ADDRESS_AR = 'حولي - قطعة 4 - شارع المعتصم - مركز العيادات التخصصية - الدور السادس';
const CLINIC_ADDRESS_EN = "Hawally - Block 4 - Al-Mu'tasim Street - Specialized Clinics Center - 6th Floor";
const CLINIC_PHONE_AR = 'تلفون: 22650700 داخلي 607';
const CLINIC_PHONE_EN = 'Tel.: 22650700 Ext. 607';
const CLINIC_MOBILE_AR = 'موبايل وواتساب: 60008977';
const CLINIC_MOBILE_EN = 'Mobile & WhatsApp: 60008977';

const VISIT_TYPE_LABELS_EN: Record<'CHECKUP' | 'FOLLOW_UP' | 'OTHER', string> = {
  CHECKUP: 'Checkup',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Other',
};

const PAYMENT_STATUS_LABELS_EN: Record<InvoicePdfData['paymentStatus'], string> = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY PAID',
  PAID: 'PAID',
};

const PAYMENT_METHOD_LABELS_EN: Record<InvoicePdfData['payments'][number]['method'], string> = {
  CASH: 'CASH',
  VISA: 'VISA',
  KNET: 'KNET',
  OTHER: 'OTHER',
};

function formatMoney(value: number | string): string {
  return new Decimal(String(value)).toDecimalPlaces(2).toFixed(2);
}

function formatDate(value: string | Date): string {
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInvoiceHtml(invoice: InvoicePdfData): string {
  const itemsRows = invoice.invoiceItems
    .map(
      (item) => `
        <tr>
          <td class="col-service">${escapeHtml(item.serviceNameSnapshot)}</td>
          <td class="col-code">${item.service?.code ? escapeHtml(item.service.code) : '&mdash;'}</td>
          <td class="col-qty">${item.quantity}</td>
          <td class="col-price">${formatMoney(item.unitPriceSnapshot)}</td>
          <td class="col-total">${formatMoney(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  // Generate additional charges rows if they exist
  const chargesRows = (invoice.additionalCharges || [])
    .map(
      (charge) => {
        const chargeLabel = charge.description ? escapeHtml(charge.description) : (charge.chargeType === 'PERCENTAGE' ? 'Additional Charge' : 'Fixed Charge');
        const priceDisplay = charge.chargeType === 'PERCENTAGE' ? formatMoney(charge.chargeValue) + '%' : formatMoney(charge.chargeValue);
        return `
        <tr class="charge-row">
          <td class="col-service">${chargeLabel}</td>
          <td class="col-code">&mdash;</td>
          <td class="col-qty">1</td>
          <td class="col-price">${priceDisplay}</td>
          <td class="col-total">${formatMoney(charge.calculatedAmount)}</td>
        </tr>`;
      }
    )
    .join('');

  // Generate additional charges totals rows
  const chargesTotalsRows = (invoice.additionalCharges || [])
    .map(
      (charge) => {
        const chargeLabel = charge.description || (charge.chargeType === 'PERCENTAGE' ? 'Additional Charge' : 'Fixed Charge');
        const valueDisplay = charge.chargeType === 'PERCENTAGE' ? formatMoney(charge.chargeValue) + '%' : formatMoney(charge.chargeValue);
        return `<div class="row"><span>${chargeLabel} (${valueDisplay})</span><span class="value">${formatMoney(charge.calculatedAmount)} KD</span></div>`;
      }
    )
    .join('');

  const lastPayment = invoice.payments.length > 0 ? invoice.payments[invoice.payments.length - 1] : null;

  const voidWatermark =
    invoice.status === 'VOID'
      ? `<div class="watermark">VOID</div>`
      : '';

  const replacementNote = invoice.replacedByInvoiceId
    ? `<div class="replacement-note">This invoice has been replaced. See replacement invoice for current details.</div>`
    : '';

  const visitTypeLabel = invoice.visit ? VISIT_TYPE_LABELS_EN[invoice.visit.type] : '&mdash;';
  const diagnosis = invoice.visit?.diagnosis ? escapeHtml(invoice.visit.diagnosis) : '&mdash;';

  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8" />
<style>
  @font-face {
    font-family: 'Noto Naskh Arabic';
    src: local('Noto Naskh Arabic');
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Arial', 'Noto Sans Arabic', 'Noto Naskh Arabic', sans-serif;
    color: #1F2430;
    margin: 0;
    padding: 0;
    background: #FFFFFF;
    position: relative;
  }
  .page {
    padding: 32px 40px 40px;
    border: 1px solid #111844;
    margin: 16px;
  }
  .watermark {
    position: fixed;
    top: 40%;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 96px;
    font-weight: bold;
    color: #C4362B;
    opacity: 0.15;
    transform: rotate(-25deg);
    z-index: 10;
  }
  .top-bar {
    height: 6px;
    background: #111844;
    margin: -32px -40px 24px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding-bottom: 16px;
    border-bottom: 3px double #111844;
    margin-bottom: 16px;
  }
  .header .logo {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }
  .header .clinic-name-ar {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: #111844;
    direction: rtl;
  }
  .header .clinic-name-en {
    font-size: 22px;
    font-weight: bold;
    color: #111844;
  }
  .doctor-block {
    text-align: center;
    margin-bottom: 18px;
  }
  .doctor-block .doctor-name {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #1F2430;
    direction: rtl;
  }
  .doctor-block .doctor-title {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    font-size: 13px;
    color: #4B5694;
    direction: rtl;
    margin-top: 2px;
  }
  .invoice-title {
    text-align: center;
    font-size: 26px;
    font-weight: bold;
    color: #111844;
    letter-spacing: 2px;
    margin: 18px 0 20px;
  }
  .invoice-title .arrow {
    color: #4B5694;
    font-weight: normal;
    padding: 0 10px;
  }
  .meta-box {
    display: flex;
    border: 1px solid #111844;
    border-radius: 8px;
    margin-bottom: 18px;
    overflow: hidden;
  }
  .meta-box .cell {
    flex: 1;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .meta-box .cell:first-child {
    border-right: 1px solid #E5E7EF;
  }
  .meta-box .cell .icon {
    color: #111844;
    font-size: 16px;
  }
  .meta-box .cell .label {
    font-size: 11px;
    color: #8991A6;
    display: block;
  }
  .meta-box .cell .value {
    font-size: 14px;
    font-weight: bold;
    color: #111844;
  }
  .patient-box {
    border: 1px solid #111844;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 18px;
  }
  .patient-box .patient-title {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #111844;
    letter-spacing: 1px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #E5E7EF;
  }
  .patient-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
  }
  .patient-grid .field .label {
    font-size: 11px;
    color: #8991A6;
    margin-bottom: 2px;
  }
  .patient-grid .field .value {
    font-size: 14px;
    font-weight: bold;
    color: #1F2430;
  }
  .patient-grid .field .value.ar {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    direction: rtl;
    text-align: right;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  table.items th {
    background: #111844;
    color: #FFFFFF;
    padding: 9px 10px;
    font-size: 12px;
    text-align: left;
  }
  table.items td {
    padding: 9px 10px;
    font-size: 13px;
    border-bottom: 1px solid #E5E7EF;
  }
  table.items tr:nth-child(even) td { background: #F6F7FA; }
  table.items tr.charge-row td { background: #FFF3E0; font-style: italic; }
  .col-qty, .col-price, .col-total, .col-code { text-align: center; }
  table.items th.col-qty, table.items th.col-price, table.items th.col-total, table.items th.col-code {
    text-align: center;
  }
  .replacement-note {
    text-align: center;
    font-size: 12px;
    color: #C4362B;
    font-weight: bold;
    margin-bottom: 12px;
    padding: 8px;
    border: 1px solid #C4362B;
    border-radius: 4px;
    background: #FEF2F2;
  }
  .bottom-row {
    display: flex;
    gap: 20px;
    margin-bottom: 18px;
  }
  .totals-box {
    flex: 1;
    border: 1px solid #111844;
    border-radius: 8px;
    padding: 14px 18px;
  }
  .totals-box .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;
    color: #1F2430;
  }
  .totals-box .row.remaining .value { color: #C4362B; font-weight: bold; }
  .totals-box .row .value { font-weight: bold; }
  .status-row {
    display: flex;
    gap: 12px;
  }
  .status-box {
    flex: 1;
    border: 1px solid #111844;
    border-radius: 8px;
    padding: 14px 12px;
    text-align: center;
  }
  .status-box .label {
    font-size: 11px;
    color: #8991A6;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .status-box .value {
    font-size: 15px;
    font-weight: bold;
    color: #111844;
  }
  .thanks {
    text-align: center;
    font-style: italic;
    font-size: 13px;
    color: #4B5694;
    margin-bottom: 18px;
  }
  .footer-box {
    border: 1px solid #111844;
    border-radius: 8px;
    padding: 14px 20px;
    text-align: center;
    font-size: 11px;
    color: #4B5694;
  }
  .footer-box .clinic-name-ar {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    direction: rtl;
    font-size: 14px;
    font-weight: bold;
    color: #111844;
    margin-bottom: 2px;
  }
  .footer-box .clinic-name-en {
    font-size: 13px;
    font-weight: bold;
    color: #111844;
    margin-bottom: 8px;
  }
  .footer-box .line-ar {
    font-family: 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
    direction: rtl;
    margin-bottom: 1px;
  }
  .footer-box .line-en {
    margin-bottom: 6px;
  }
</style>
</head>
<body>
  ${voidWatermark}
  <div class="page">
    <div class="top-bar"></div>

    <div class="header">
      <img class="logo" src="data:image/png;base64,${CLINIC_LOGO_BASE64}" alt="Specialized Clinics Center" />
      <div>
        <div class="clinic-name-ar">${CLINIC_NAME_AR}</div>
        <div class="clinic-name-en">${CLINIC_NAME_EN}</div>
      </div>
    </div>

    <div class="doctor-block">
      <div class="doctor-name">${DOCTOR_NAME_AR}</div>
      <div class="doctor-title">${DOCTOR_TITLE_AR}</div>
    </div>

    <div class="invoice-title"><span class="arrow">&#8594;</span>INVOICE<span class="arrow">&#8592;</span></div>

    <div class="meta-box">
      <div class="cell">
        <span class="icon">&#128196;</span>
        <div>
          <span class="label">Invoice No.</span>
          <span class="value">${escapeHtml(invoice.invoiceNumber)}</span>
        </div>
      </div>
      <div class="cell">
        <span class="icon">&#128197;</span>
        <div>
          <span class="label">Date</span>
          <span class="value">${formatDate(invoice.issuedAt || invoice.createdAt)}</span>
        </div>
      </div>
    </div>

    <div class="patient-box">
      <div class="patient-title">PATIENT INFORMATION</div>
      <div class="patient-grid">
        <div class="field">
          <div class="label">Patient Name</div>
          <div class="value ar">${escapeHtml(invoice.patient.fullNameAr)}</div>
        </div>
        <div class="field">
          <div class="label">Visit Type</div>
          <div class="value">${visitTypeLabel}</div>
        </div>
        <div class="field">
          <div class="label">Civil ID</div>
          <div class="value">${escapeHtml(invoice.patient.civilId)}</div>
        </div>
        <div class="field">
          <div class="label">Diagnosis</div>
          <div class="value ar">${diagnosis}</div>
        </div>
        <div class="field">
          <div class="label">Mobile Number</div>
          <div class="value">${invoice.patient.phone ? escapeHtml(invoice.patient.phone) : '&mdash;'}</div>
        </div>
        <div class="field">
          <div class="label">Doctor</div>
          <div class="value ar">${DOCTOR_NAME_AR}</div>
        </div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="col-service">SERVICE</th>
          <th class="col-code">CODE</th>
          <th class="col-qty">QTY</th>
          <th class="col-price">UNIT PRICE (KD)</th>
          <th class="col-total">TOTAL (KD)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        ${chargesRows}
      </tbody>
    </table>

    ${replacementNote}

    <div class="bottom-row">
      <div class="totals-box">
        <div class="row"><span>Subtotal</span><span class="value">${formatMoney(invoice.subtotal)} KD</span></div>
        ${chargesTotalsRows}
        <div class="row" style="border-top: 1px solid #E5E7EF; padding-top: 8px; margin-top: 4px;"><span>Total</span><span class="value">${formatMoney(invoice.total)} KD</span></div>
        <div class="row"><span>Paid</span><span class="value">${formatMoney(invoice.paid)} KD</span></div>
        <div class="row remaining"><span>Remaining</span><span class="value">${formatMoney(invoice.remaining)} KD</span></div>
      </div>
      <div class="status-row" style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
        <div class="status-box">
          <div class="label">PAYMENT STATUS</div>
          <div class="value">${PAYMENT_STATUS_LABELS_EN[invoice.paymentStatus]}</div>
        </div>
        <div class="status-box">
          <div class="label">PAYMENT METHOD</div>
          <div class="value">${lastPayment ? PAYMENT_METHOD_LABELS_EN[lastPayment.method] : '&mdash;'}</div>
        </div>
      </div>
    </div>

    <div class="thanks">&#9829; Thank you for choosing our clinic &#9829;</div>

    <div class="footer-box">
      <div class="clinic-name-ar">${CLINIC_NAME_AR}</div>
      <div class="clinic-name-en">${CLINIC_NAME_EN}</div>
      <div class="line-ar">${CLINIC_ADDRESS_AR}</div>
      <div class="line-en">${CLINIC_ADDRESS_EN}</div>
      <div class="line-ar">${CLINIC_PHONE_AR}</div>
      <div class="line-en">${CLINIC_PHONE_EN}</div>
      <div class="line-ar">${CLINIC_MOBILE_AR}</div>
      <div class="line-en">${CLINIC_MOBILE_EN}</div>
    </div>
  </div>
</body>
</html>`;
}
