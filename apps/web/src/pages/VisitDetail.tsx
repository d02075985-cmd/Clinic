import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, User, Phone, IdCard, Calendar, Stethoscope, FileText, ReceiptText } from 'lucide-react';
import { visitsService, VisitStatus } from '../services/visits.service';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../utils/dateFormat';
import { formatMoney } from '../utils/money';
import { getReturnTo } from '../utils/listState';
import { preserveListState } from '../utils/listState';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';

export default function VisitDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/visits');

  const STATUS_LABELS: Record<VisitStatus, string> = {
    SCHEDULED: t('visits.statusScheduled'),
    IN_PROGRESS: t('visits.statusInProgress'),
    COMPLETED: t('visits.statusCompleted'),
    CANCELLED: t('visits.statusCancelled'),
  };
  const TYPE_LABELS: Record<string, string> = {
    CHECKUP: t('visits.typeCheckup'),
    FOLLOW_UP: t('visits.typeFollowUp'),
    OTHER: t('visits.typeOther'),
  };
  const PAYMENT_STATUS_LABELS: Record<string, string> = {
    UNPAID: t('invoices.unpaid'),
    PARTIALLY_PAID: t('invoices.partiallyPaid'),
    PAID: t('invoices.paidInFull'),
  };

  const { data: visit, isLoading, error } = useQuery({
    queryKey: ['visit', id],
    queryFn: () => visitsService.getVisit(id!),
    enabled: !!id,
  });

  // A visit can have at most one invoice (enforced by the backend), but the
  // API returns it as an array (`invoices`), not a single `invoice` field.
  const invoice = visit?.invoices?.[0];

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="ui-card p-6 space-y-3"><Skeleton className="h-8 rounded-lg" count={5} /></div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="page-container">
        <div className="ui-card p-16 text-center text-[#C4362B]">{t('visits.detailLoadError')}</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <button onClick={() => navigate(returnTo)} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#102F63] mb-4">
        <ArrowRight size={16} strokeWidth={1.75} />
        {t('visits.backToVisits')}
      </button>

      <PageHeader
        title={t('visits.detailsTitle')}
        subtitle={formatDateTime(visit.visitDate, i18n.language)}
        breadcrumbs={[{ label: t('sidebar.visits'), href: returnTo }, { label: t('visits.detailsTitle') }]}
        actions={<span className="ui-badge" style={{ background: 'rgba(23,59,120,0.1)', color: 'var(--brand-blue)' }}>{STATUS_LABELS[visit.status]}</span>}
      />

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4 flex items-center gap-2">
            <User size={17} strokeWidth={1.75} />
            {t('visits.patientInfo')}
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <User size={15} strokeWidth={1.75} className="text-[#94A3B8]" />
              <span className="text-[#64748B]">{t('visits.nameLabel')}</span>
              <Link
                to={preserveListState(`/patients/${visit.patient.id}`, { pathname: `/visits/${visit.id}`, search: '' })}
                className="font-medium text-[#1F2430] hover:text-[#102F63] hover:underline"
              >
                {visit.patient.fullNameAr}
              </Link>
            </div>
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
              <IdCard size={15} strokeWidth={1.75} className="text-[#94A3B8]" />
              <span className="text-[#64748B]">{t('patients.civilId')}:</span>
              <span className="font-medium text-[#1F2430] font-mono">{visit.patient.civilId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={15} strokeWidth={1.75} className="text-[#94A3B8]" />
              <span className="text-[#64748B]">{t('visits.mobileLabel')}</span>
              <span className="font-medium text-[#1F2430]">{visit.patient.phone || '—'}</span>
            </div>
          </div>
        </div>

        <div className="ui-card p-5">
          <h2 className="text-[15px] font-bold text-[#102F63] mb-4 flex items-center gap-2">
            <Calendar size={17} strokeWidth={1.75} />
            {t('visits.visitInfo')}
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">{t('visits.dateTimeLabel')}</span>
              <span className="font-medium text-[#1F2430]">{formatDateTime(visit.visitDate, i18n.language)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">{t('visits.type')}:</span>
              <span className="font-medium text-[#1F2430]">{TYPE_LABELS[visit.type]}</span>
            </div>
            {visit.diagnosis && (
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:gap-2">
                <span className="text-[#64748B] shrink-0">{t('visits.diagnosisLabel')}</span>
                <span className="font-medium text-[#1F2430]">{visit.diagnosis}</span>
              </div>
            )}
            {visit.notes && (
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:gap-2">
                <span className="text-[#64748B] shrink-0">{t('visits.notesLabel')}</span>
                <span className="text-[#1F2430]">{visit.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="ui-card p-5 mb-5">
        <h2 className="text-[15px] font-bold text-[#102F63] mb-4 flex items-center gap-2">
          <Stethoscope size={17} strokeWidth={1.75} />
          {t('visits.services')}
        </h2>
        {invoice && invoice.invoiceItems.length > 0 ? (
          <ul className="space-y-2">
            {invoice.invoiceItems.map((item, i) => (
              <li key={i} className="text-sm text-[#1F2430] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#102F63]" />
                {item.serviceNameSnapshot}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#94A3B8]">{t('visits.noServicesYet')}</p>
        )}
      </div>

      <div className="ui-card p-5">
        <h2 className="text-[15px] font-bold text-[#102F63] mb-4 flex items-center gap-2">
          <FileText size={17} strokeWidth={1.75} />
          {t('sidebar.invoices')}
        </h2>
        {invoice ? (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
              <div>
                <div className="text-[#94A3B8] text-xs mb-1">{t('invoices.number')}</div>
                <Link
                  to={preserveListState(`/invoices/${invoice.id}`, { pathname: `/visits/${visit.id}`, search: '' })}
                  className="font-medium text-[#1F2430] hover:text-[#102F63] hover:underline"
                >
                  {invoice.invoiceNumber}
                </Link>
              </div>
              <div>
                <div className="text-[#94A3B8] text-xs mb-1">{t('invoices.total')}</div>
                <div className="font-medium text-[#1F2430]">{formatMoney(invoice.total, i18n.language)} {t('common.currency')}</div>
              </div>
              <div>
                <div className="text-[#94A3B8] text-xs mb-1">{t('invoices.paid')}</div>
                <div className="font-medium text-[#1F2430]">{formatMoney(invoice.paid, i18n.language)} {t('common.currency')}</div>
              </div>
              <div>
                <div className="text-[#94A3B8] text-xs mb-1">{t('invoices.remaining')}</div>
                <div className="font-medium text-[#C4362B]">{formatMoney(invoice.remaining, i18n.language)} {t('common.currency')}</div>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="ui-badge" style={{ background: 'rgba(23,59,120,0.08)', color: 'var(--brand-blue)' }}>
                {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
              </span>
              <button onClick={() => navigate(preserveListState(`/invoices/${invoice.id}`, { pathname: `/visits/${visit.id}`, search: '' }))} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                <ReceiptText size={16} strokeWidth={1.75} />
                {t('visits.viewInvoiceBtn')}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#94A3B8]">{t('visits.noInvoiceYet')}</p>
            <button onClick={() => navigate(`/invoices/new?visitId=${visit.id}`)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              <ReceiptText size={16} strokeWidth={1.75} />
              {t('visits.createInvoiceBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
