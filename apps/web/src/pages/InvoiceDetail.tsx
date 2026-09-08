import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { invoicesService, CreateReplacementDto } from '../services/invoices.service';
import { paymentsService, PaymentMethod } from '../services/payments.service';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../utils/dateFormat';
import { formatMoney, formatNumber, moneyToCents, normalizeMoneyInput } from '../utils/money';
import { getReturnTo } from '../utils/listState';
import { preserveListState } from '../utils/listState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';

export default function InvoiceDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/invoices');
  const { showToast } = useToast();

  const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    CASH: t('payments.methodCash'),
    VISA: t('payments.methodVisa'),
    KNET: t('payments.methodKnet'),
    OTHER: t('payments.methodOther'),
  };
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: invoice, isLoading: invoiceLoading, error: invoiceError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesService.getInvoice(id!),
    enabled: !!id,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', id],
    queryFn: () => paymentsService.getPaymentsForInvoice(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'ISSUED' | 'VOID') => invoicesService.updateInvoiceStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setConfirmStatus(null);
      showToast({ type: 'success', message: t('feedback.invoiceStatusUpdated') });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      showToast({ type: 'error', message: err.message || t('feedback.invoiceStatusFailed') });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      paymentsService.createPayment({
        invoiceId: id!,
        amount: (moneyToCents(paymentAmount) || 0) / 100,
        method: paymentMethod,
        notes: paymentNotes || undefined,
      }),
    onSuccess: () => {
      setPaymentAmount('');
      setPaymentNotes('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      showToast({ type: 'success', message: t('feedback.paymentRecorded') });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      showToast({ type: 'error', message: err.message || t('feedback.paymentRecordFailed') });
    },
  });

  const reversePaymentMutation = useMutation({
    mutationFn: ({ paymentId, reversalNotes }: { paymentId: string; reversalNotes?: string }) => 
      paymentsService.reversePayment(paymentId, reversalNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['payments', id] });
      setConfirmReversePayment(false);
      setPaymentToReverse(null);
      setReversalNotes('');
      showToast({ type: 'success', message: t('feedback.paymentReversed') });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      showToast({ type: 'error', message: err.message || t('feedback.paymentReverseFailed') });
    },
  });

  const replacementMutation = useMutation({
    mutationFn: (replacementData: CreateReplacementDto) =>
      invoicesService.createReplacement(id!, replacementData),
    onSuccess: (newInvoice) => {
      setConfirmReplacement(false);
      showToast({ type: 'success', message: t('feedback.invoiceReplaced') });
      navigate(`/invoices/${newInvoice.id}?returnTo=${encodeURIComponent(returnTo)}`);
    },
    onError: (err: Error) => {
      setFormError(err.message);
      showToast({ type: 'error', message: err.message || t('feedback.invoiceReplacementFailed') });
    },
  });

  const [showReplacementForm, setShowReplacementForm] = useState(false);
  const [reversalNotes, setReversalNotes] = useState('');
  const [paymentToReverse, setPaymentToReverse] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<'ISSUED' | 'VOID' | null>(null);
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [confirmReversePayment, setConfirmReversePayment] = useState(false);

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cents = moneyToCents(normalizeMoneyInput(paymentAmount));
    if (cents === null || cents <= 0) {
      setFormError(t('payments.enterValidAmount'));
      return;
    }
    paymentMutation.mutate();
  };

  if (invoiceLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <div className="ui-card p-6 space-y-3"><Skeleton className="h-8 rounded-lg" /><Skeleton className="h-48 rounded-lg" /></div>
        </div>
      </div>
    );
  }

  if (invoiceError || !invoice) {
    return <div className="page-container"><div className="ui-card p-6 text-center text-[#C4362B]" role="alert">{t('invoices.loadError')}</div></div>;
  }

  const statusLabels: Record<string, string> = {
    DRAFT: t('invoices.statusDraft'),
    ISSUED: t('invoices.statusIssued'),
    VOID: t('invoices.statusVoid'),
  };
  const paymentStatusLabels: Record<string, string> = {
    UNPAID: t('invoices.unpaid'),
    PARTIALLY_PAID: t('invoices.partiallyPaid'),
    PAID: t('invoices.paidInFull'),
  };

  const canRecordPayment = invoice.status === 'ISSUED' && invoice.paymentStatus !== 'PAID';
  const remainingIsPaid = Number(invoice.remaining) <= 0;

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto max-w-3xl px-4 py-5 sm:py-8">
        <PageHeader
          title={invoice.invoiceNumber}
          breadcrumbs={[{ label: t('sidebar.invoices'), href: returnTo }, { label: invoice.invoiceNumber }]}
          backTo={returnTo}
          actions={<button onClick={() => navigate(returnTo)} className="btn-primary px-4 py-2">{t('common.back')}</button>}
        />

        {formError && (
          <div
            role="alert"
            aria-live="polite"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4"
          >
            {formError}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-md sm:p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#111844]">{invoice.invoiceNumber}</h1>
              <Link
                to={preserveListState(`/patients/${invoice.patient.id}`, { pathname: `/invoices/${invoice.id}`, search: '' })}
                className="text-gray-600 hover:text-[#111844] hover:underline"
              >
                {invoice.patient.fullNameAr}
              </Link>
              {invoice.visit && (
                <Link
                  to={preserveListState(`/visits/${invoice.visit.id}`, { pathname: `/invoices/${invoice.id}`, search: '' })}
                  className="block text-sm text-[#4B5694] hover:underline mt-1"
                >
                  {t('visits.detailsTitle')}
                </Link>
              )}
              {(invoice.replacedByInvoiceId || invoice.replacedInvoiceId) && (
                <div className="mt-2 text-sm">
                  {invoice.replacedByInvoiceId ? (
                    <button onClick={() => navigate(`/invoices/${invoice.replacedByInvoiceId}?returnTo=${encodeURIComponent(returnTo)}`)} className="text-[#4B5694] hover:underline">
                      {t('invoices.replacementInvoice')}
                    </button>
                  ) : (
                    <button onClick={() => navigate(`/invoices/${invoice.replacedInvoiceId}?returnTo=${encodeURIComponent(returnTo)}`)} className="text-[#4B5694] hover:underline">
                      {t('invoices.replacedInvoice')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {invoice.status === 'DRAFT' && (
                <button
                  onClick={() => setConfirmStatus('ISSUED')}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors disabled:opacity-50"
                >
                  {t('invoices.issueInvoice')}
                </button>
              )}
              {invoice.status !== 'VOID' && isAdmin && (
                <button
                  onClick={() => setConfirmStatus('VOID')}
                  disabled={statusMutation.isPending}
                  className="px-4 py-2 border border-[#C4362B] text-[#C4362B] rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {t('invoices.voidInvoice')}
                </button>
              )}
              {invoice.status === 'ISSUED' && isAdmin && (
                <button
                  onClick={() => setShowReplacementForm(!showReplacementForm)}
                  className="px-4 py-2 border border-[#4B5694] text-[#4B5694] rounded-md hover:bg-blue-50 transition-colors"
                >
                  {t('invoices.createReplacement')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="text-gray-500">{t('invoices.invoiceStatus')}</div>
              <div className="font-medium text-gray-900">{statusLabels[invoice.status]}</div>
            </div>
            <div>
              <div className="text-gray-500">{t('invoices.paymentStatusLabel')}</div>
              <div className="font-medium text-gray-900">{paymentStatusLabels[invoice.paymentStatus]}</div>
            </div>
            <div>
              <div className="text-gray-500">{t('invoices.createdDate')}</div>
              <div className="font-medium text-gray-900">{formatDateTime(invoice.createdAt, i18n.language)}</div>
            </div>
            {invoice.issuedAt && (
              <div>
                <div className="text-gray-500">{t('invoices.issuedDate')}</div>
                <div className="font-medium text-gray-900">{formatDateTime(invoice.issuedAt, i18n.language)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="mobile-record-list p-3 md:hidden">
            {invoice.invoiceItems.map((item) => (
              <div key={item.id} className="ui-card p-4">
                <div className="font-medium text-gray-900">{item.serviceNameSnapshot}</div>
                <div className="mt-2 grid gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">{t('services.price')}</span><span>{formatMoney(item.unitPriceSnapshot, i18n.language)} {t('common.currency')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t('invoices.quantity')}</span><span>{formatNumber(item.quantity, i18n.language)}</span></div>
                  <div className="flex justify-between font-medium"><span className="text-gray-500">{t('invoices.total')}</span><span>{formatMoney(item.lineTotal, i18n.language)} {t('common.currency')}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.service')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('services.price')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.quantity')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.invoiceItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 text-gray-900">{item.serviceNameSnapshot}</td>
                  <td className="px-6 py-4 text-gray-700">{formatMoney(item.unitPriceSnapshot, i18n.language)} {t('common.currency')}</td>
                  <td className="px-6 py-4 text-gray-700">{formatNumber(item.quantity, i18n.language)}</td>
                  <td className="px-6 py-4 text-gray-900 font-medium">{formatMoney(item.lineTotal, i18n.language)} {t('common.currency')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-gray-200 p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invoices.subtotal')}</span>
              <span className="text-gray-900">{formatMoney(invoice.subtotal, i18n.language)} {t('common.currency')}</span>
            </div>
            {invoice.additionalCharges && invoice.additionalCharges.length > 0 && (
              invoice.additionalCharges.map((charge) => (
                <div key={charge.id} className="flex justify-between">
                  <span className="text-gray-600">
                    {charge.description || (charge.chargeType === 'PERCENTAGE' ? t('invoices.percentageCharge') : t('invoices.fixedCharge'))}
                    ({charge.chargeType === 'PERCENTAGE' ? `${charge.chargeValue}%` : `${formatMoney(charge.chargeValue, i18n.language)} ${t('common.currency')}`})
                  </span>
                  <span className="text-gray-900">{formatMoney(charge.calculatedAmount, i18n.language)} {t('common.currency')}</span>
                </div>
              ))
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invoices.total')}</span>
              <span className="font-bold text-[#111844]">{formatMoney(invoice.total, i18n.language)} {t('common.currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invoices.paid')}</span>
              <span className="text-gray-900">{formatMoney(invoice.paid, i18n.language)} {t('common.currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invoices.remaining')}</span>
              <span className={`font-bold ${remainingIsPaid ? 'text-[var(--success)]' : 'text-[#C4362B]'}`}>
                {formatMoney(invoice.remaining, i18n.language)} {t('common.currency')}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Replacement Form - Admin Only */}
        {showReplacementForm && isAdmin && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-[#111844] mb-4">{t('invoices.createReplacementTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('invoices.replacementNote')}
            </p>
            <button
              onClick={() => setConfirmReplacement(true)}
              disabled={replacementMutation.isPending}
              className="px-4 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors disabled:opacity-50"
            >
              {replacementMutation.isPending ? t('invoices.creating') : t('invoices.createReplacementBtn')}
            </button>
            <button
              onClick={() => setShowReplacementForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {/* Record Payment */}
        {canRecordPayment && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-bold text-[#111844] mb-4">{t('payments.recordPayment')}</h2>
            <div id="payment-amount-guidance" className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[#173B78]">
              <span className="font-semibold">{t('invoices.remaining')}:</span>{' '}
              {formatMoney(invoice.remaining, i18n.language)} {t('common.currency')}
              <span className="mx-1">·</span>
              {t('payments.amountGuidance')}
            </div>
            <form onSubmit={handleRecordPayment} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-sm text-gray-600 mb-1">{t('payments.amount')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  aria-describedby="payment-amount-guidance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]"
                  required
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-sm text-gray-600 mb-1">{t('payments.method')}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-sm text-gray-600 mb-1">{t('payments.notesOptional')}</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]"
                />
              </div>
              <button
                type="submit"
                disabled={paymentMutation.isPending}
                className="px-4 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors disabled:opacity-50"
              >
                {paymentMutation.isPending ? t('payments.recording') : t('payments.recordPaymentBtn')}
              </button>
            </form>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-[#111844]">{t('payments.history')}</h2>
          </div>
          {paymentsLoading ? (
            <div className="p-6 text-gray-500">{t('common.loading')}</div>
          ) : !payments || payments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">{t('payments.noPayments')}</div>
          ) : (
            <>
            <div className="mobile-record-list p-3 md:hidden">
              {payments.map((payment) => (
                <div key={payment.id} className="ui-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-gray-900">{formatMoney(payment.amount, i18n.language)} {t('common.currency')}</span>
                    <span className="text-sm text-gray-600">{PAYMENT_METHOD_LABELS[payment.method]}</span>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">{t('common.date')}</span><span>{formatDateTime(payment.paymentDate, i18n.language)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{t('payments.recordedBy')}</span><span>{payment.recordedBy?.name || '—'}</span></div>
                    {isAdmin && <button onClick={() => setPaymentToReverse(payment.id)} className="text-right text-sm text-[#C4362B]">{t('payments.reversePayment')}</button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('payments.amount')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('payments.method')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.date')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('payments.recordedBy')}</th>
                  {isAdmin && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4 text-gray-900 font-medium">{formatMoney(payment.amount, i18n.language)} {t('common.currency')}</td>
                    <td className="px-6 py-4 text-gray-700">{PAYMENT_METHOD_LABELS[payment.method]}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(payment.paymentDate, i18n.language)}</td>
                    <td className="px-6 py-4 text-gray-600">{payment.recordedBy?.name || '—'}</td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {paymentToReverse === payment.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder={t('payments.reversalReasonPlaceholder')}
                              value={reversalNotes}
                              onChange={(e) => setReversalNotes(e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm w-32"
                            />
                            <button
                              onClick={() => setConfirmReversePayment(true)}
                              className="text-[#C4362B] hover:text-[#a32b22] text-sm font-medium"
                            >
                              {t('payments.confirmReversal')}
                            </button>
                            <button
                              onClick={() => {
                                setPaymentToReverse(null);
                                setReversalNotes('');
                              }}
                              className="text-gray-600 hover:text-gray-900 text-sm"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPaymentToReverse(payment.id)}
                            className="text-[#C4362B] hover:text-[#a32b22] text-sm"
                          >
                            {t('payments.reversePayment')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
        </div>

        <ConfirmDialog
          open={!!confirmStatus}
          title={confirmStatus === 'ISSUED' ? t('invoices.issueInvoice') : t('invoices.voidInvoice')}
          message={confirmStatus === 'ISSUED' ? t('invoices.issueConfirm') : t('invoices.voidConfirm')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          destructive={confirmStatus === 'VOID'}
          loading={statusMutation.isPending}
          onCancel={() => setConfirmStatus(null)}
          onConfirm={() => {
            if (confirmStatus) statusMutation.mutate(confirmStatus);
          }}
        />

        <ConfirmDialog
          open={confirmReplacement}
          title={t('invoices.createReplacementTitle')}
          message={t('invoices.replacementConfirm')}
          confirmLabel={t('invoices.createReplacementBtn')}
          cancelLabel={t('common.cancel')}
          destructive
          loading={replacementMutation.isPending}
          onCancel={() => setConfirmReplacement(false)}
          onConfirm={() => {
            const replacementItems = invoice.invoiceItems.map((item) => ({
              serviceId: item.serviceId,
              quantity: item.quantity,
              unitPrice: parseFloat(item.unitPriceSnapshot),
            }));
            replacementMutation.mutate({
              items: replacementItems,
              additionalCharges: invoice.additionalCharges?.map((charge) => ({
                chargeType: charge.chargeType,
                chargeValue: parseFloat(charge.chargeValue),
                description: charge.description || undefined,
              })) || [],
            });
          }}
        />

        <ConfirmDialog
          open={confirmReversePayment && !!paymentToReverse}
          title={t('payments.reversePayment')}
          message={t('payments.reverseConfirm')}
          confirmLabel={t('payments.confirmReversal')}
          cancelLabel={t('common.cancel')}
          destructive
          loading={reversePaymentMutation.isPending}
          onCancel={() => setConfirmReversePayment(false)}
          onConfirm={() => {
            if (paymentToReverse) {
              reversePaymentMutation.mutate({
                paymentId: paymentToReverse,
                reversalNotes: reversalNotes || undefined,
              });
            }
          }}
        />
      </div>
    </div>
  );
}
