import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Wallet, AlertCircle, ReceiptText, ClipboardList, UsersRound, CalendarDays, FileSpreadsheet, FileText, ClipboardCheck } from 'lucide-react';
import { reportsService } from '../services/reports.service';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DateInput from '../components/DateInput';
import { formatMoney } from '../utils/money';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';

const COLORS = ['#102F63', '#173B78', '#4B5694', '#8991A6', '#C4362B', '#C98200'];

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function KpiCard({ icon: Icon, label, value, suffix }: { icon: typeof TrendingUp; label: string; value: string | number; suffix?: string }) {
  return (
    <div className="ui-card p-4">
      <div className="flex items-center gap-2 text-[#64748B] text-xs mb-2">
        <Icon size={15} strokeWidth={1.75} />
        {label}
      </div>
      <div className="text-xl font-bold text-[#102F63]">
        {value}{suffix && <span className="text-sm text-[#94A3B8] font-normal"> {suffix}</span>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: t('payments.methodCash'), VISA: t('payments.methodVisa'), KNET: t('payments.methodKnet'), OTHER: t('payments.methodOther'),
  };
  const PAYMENT_STATUS_LABELS: Record<string, string> = {
    UNPAID: t('invoices.unpaid'), PARTIALLY_PAID: t('invoices.partiallyPaid'), PAID: t('invoices.paidInFull'),
  };
  const VISIT_TYPE_LABELS: Record<string, string> = {
    CHECKUP: t('visits.typeCheckup'), FOLLOW_UP: t('visits.typeFollowUp'), OTHER: t('visits.typeOther'),
  };
  const APPT_STATUS_LABELS: Record<string, string> = {
    BOOKED: t('appointments.statusBooked'), CONFIRMED: t('appointments.statusConfirmed'), DONE: t('appointments.statusDone'),
    CANCELLED: t('appointments.statusCancelled'), NO_SHOW: t('appointments.statusNoShow'),
  };

  const [from, setFrom] = useState(todayMinus(29));
  const [to, setTo] = useState(today());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const summary = useQuery({ queryKey: ['reports-summary', from, to], queryFn: () => reportsService.getSummary(from, to) });
  const revenueTimeseries = useQuery({ queryKey: ['reports-revenue-ts', from, to], queryFn: () => reportsService.getRevenueTimeseries(from, to) });
  const paymentMethods = useQuery({ queryKey: ['reports-payment-methods', from, to], queryFn: () => reportsService.getPaymentMethods(from, to) });
  const invoiceStatus = useQuery({ queryKey: ['reports-invoice-status', from, to], queryFn: () => reportsService.getInvoiceStatusBreakdown(from, to) });
  const serviceUsage = useQuery({ queryKey: ['reports-service-usage', from, to], queryFn: () => reportsService.getServiceUsage(from, to) });
  const visitTypes = useQuery({ queryKey: ['reports-visit-types', from, to], queryFn: () => reportsService.getVisitTypes(from, to) });
  const appointmentStatus = useQuery({ queryKey: ['reports-appt-status', from, to], queryFn: () => reportsService.getAppointmentStatus(from, to) });
  const outstanding = useQuery({ queryKey: ['reports-outstanding'], queryFn: () => reportsService.getOutstandingInvoices(1, 8) });

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await reportsService.downloadExport('pdf', from, to);
      showToast({ type: 'success', message: t('feedback.reportExported') });
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('reports.exportError') });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await reportsService.downloadExport('excel', from, to);
      showToast({ type: 'success', message: t('feedback.reportExported') });
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('reports.exportError') });
    } finally {
      setExportingExcel(false);
    }
  };

  const s = summary.data;

  return (
    <div className="page-container">
      <PageHeader
        title={t('sidebar.reports')}
        subtitle={t('reports.subtitle')}
        breadcrumbs={[{ label: t('sidebar.reports') }]}
        actions={
          <button
            onClick={() => navigate('/reports/daily-closing')}
            className="h-11 px-4 flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm text-[#102F63] hover:bg-[#F6F8FC]"
          >
            <ClipboardCheck size={16} strokeWidth={1.75} />
            {t('dailyClosing.title')}
          </button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 mb-6">
          <DateInput value={from} onChange={setFrom} className="ui-input w-auto" />
          <span className="text-[#94A3B8] text-sm">{t('reports.to')}</span>
          <DateInput value={to} onChange={setTo} className="ui-input w-auto" />
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="h-11 px-4 flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm text-[#102F63] hover:bg-[#F6F8FC] disabled:opacity-50"
          >
            <FileText size={16} strokeWidth={1.75} />
            {exportingPdf ? t('reports.exporting') : t('reports.exportPdf')}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="h-11 px-4 flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm text-[#102F63] hover:bg-[#F6F8FC] disabled:opacity-50"
          >
            <FileSpreadsheet size={16} strokeWidth={1.75} />
            {exportingExcel ? t('reports.exporting') : t('reports.exportExcel')}
          </button>
      </div>
      {summary.error && <div className="ui-card p-4 mb-5 text-sm text-[#C4362B]" role="alert">{t('reports.loadError')}</div>}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <KpiCard icon={TrendingUp} label={t('reports.totalRevenue')} value={s ? formatMoney(s.totalRevenue, i18n.language) : '—'} suffix={t('common.currency')} />
        <KpiCard icon={Wallet} label={t('reports.totalCollected')} value={s ? formatMoney(s.totalCollected, i18n.language) : '—'} suffix={t('common.currency')} />
        <KpiCard icon={AlertCircle} label={t('reports.outstandingAmount')} value={s ? formatMoney(s.outstandingAmount, i18n.language) : '—'} suffix={t('common.currency')} />
        <KpiCard icon={UsersRound} label={t('reports.newPatientsCount')} value={s ? s.newPatients : '—'} />
        <KpiCard icon={CalendarDays} label={t('reports.totalAppointments')} value={s ? s.totalAppointments : '—'} />
        <KpiCard icon={ClipboardList} label={t('reports.totalVisits')} value={s ? s.totalVisits : '—'} />
        <KpiCard icon={ReceiptText} label={t('reports.issuedInvoices')} value={s ? s.totalInvoices : '—'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Revenue chart */}
        <div className="ui-card p-5 lg:col-span-2">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.revenueAndCollections')}</h2>
          {revenueTimeseries.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : revenueTimeseries.data && revenueTimeseries.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueTimeseries.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" name={t('reports.revenue')} stroke="#16803C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collected" name={t('reports.collections')} stroke="#4B5694" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title={t('reports.noDataInPeriod')} />
          )}
        </div>

        {/* Payment methods donut */}
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.paymentMethods')}</h2>
          {paymentMethods.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : paymentMethods.data && paymentMethods.data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentMethods.data} dataKey="amount" nameKey="method" innerRadius={45} outerRadius={75}>
                    {paymentMethods.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${formatMoney(v, i18n.language)} ${t('common.currency')}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {paymentMethods.data.map((row, i) => (
                  <div key={row.method} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {PAYMENT_METHOD_LABELS[row.method] || row.method}
                    </span>
                    <span className="font-medium text-[#1F2430]">{formatMoney(row.amount, i18n.language)} {t('common.currency')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title={t('reports.noPaymentsInPeriod')} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Service usage table */}
        <div className="ui-card p-5 lg:col-span-2 overflow-x-auto">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.topServicesByRevenue')}</h2>
          {serviceUsage.isLoading ? (
            <Skeleton className="h-40 rounded-lg" />
          ) : serviceUsage.data && serviceUsage.data.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#94A3B8] text-xs border-b border-[#E2E8F0]">
                  <th className="text-right py-2 font-medium">{t('invoices.service')}</th>
                  <th className="text-center py-2 font-medium">{t('reports.timesUsed')}</th>
                  <th className="text-left py-2 font-medium">{t('reports.revenue')} ({t('common.currency')})</th>
                </tr>
              </thead>
              <tbody>
                {serviceUsage.data.map((row) => (
                  <tr key={row.serviceName} className="border-b border-[#E2E8F0] last:border-0">
                    <td className="py-2.5 text-[#1F2430]">{row.serviceName}</td>
                    <td className="py-2.5 text-center text-[#64748B]">{row.timesUsed}</td>
                    <td className="py-2.5 text-left font-medium text-[#1F2430]">{formatMoney(row.revenue, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title={t('reports.noDataInPeriod')} />
          )}
        </div>

        {/* Invoice status donut */}
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.invoicesByStatus')}</h2>
          {invoiceStatus.isLoading ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : invoiceStatus.data && invoiceStatus.data.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={invoiceStatus.data} dataKey="count" nameKey="paymentStatus" innerRadius={40} outerRadius={70}>
                    {invoiceStatus.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {invoiceStatus.data.map((row, i) => (
                  <div key={row.paymentStatus} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {PAYMENT_STATUS_LABELS[row.paymentStatus] || row.paymentStatus}
                    </span>
                    <span className="font-medium text-[#1F2430]">{row.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title={t('reports.noInvoicesInPeriod')} />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Visit types */}
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.visitTypesTitle')}</h2>
          {visitTypes.data && visitTypes.data.length > 0 ? (
            <div className="space-y-2">
              {visitTypes.data.map((row) => (
                <div key={row.type} className="flex items-center justify-between text-sm">
                  <span className="text-[#1F2430]">{VISIT_TYPE_LABELS[row.type] || row.type}</span>
                  <span className="font-medium text-[#102F63]">{row.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('reports.noVisitsInPeriod')} />
          )}
        </div>

        {/* Appointment status */}
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.appointmentStatusTitle')}</h2>
          {appointmentStatus.data && appointmentStatus.data.length > 0 ? (
            <div className="space-y-2">
              {appointmentStatus.data.map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span className="text-[#1F2430]">{APPT_STATUS_LABELS[row.status] || row.status}</span>
                  <span className="font-medium text-[#102F63]">{row.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('reports.noAppointmentsInPeriod')} />
          )}
        </div>

        {/* Outstanding invoices */}
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4">{t('reports.topOutstandingInvoices')}</h2>
          {outstanding.data && outstanding.data.data.length > 0 ? (
            <div className="space-y-2">
              {outstanding.data.data.slice(0, 6).map((row) => (
                <div key={row.id} className="flex items-center justify-between text-sm border-b border-[#E2E8F0] last:border-0 pb-2 last:pb-0">
                  <div>
                    <div className="text-[#1F2430]">{row.patient.fullNameAr}</div>
                    <div className="text-xs text-[#94A3B8]">{row.invoiceNumber}</div>
                  </div>
                  <span className="font-medium text-[#C4362B]">{formatMoney(row.remaining, i18n.language)} {t('common.currency')}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('reports.noOutstandingCurrently')} />
          )}
        </div>
      </div>

      <p className="text-xs text-[#94A3B8] text-center">{t('reports.footerNote')}</p>
    </div>
  );
}
