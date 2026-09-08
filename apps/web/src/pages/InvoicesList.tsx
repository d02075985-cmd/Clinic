import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invoicesService, Invoice } from '../services/invoices.service';
import { useTranslation } from 'react-i18next';
import { formatDate as formatDateUtil } from '../utils/dateFormat';
import { formatMoney } from '../utils/money';
import { preserveListState } from '../utils/listState';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import MobileRecordCard, { MobileRecordField } from '../components/MobileRecordCard';

export default function InvoicesList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedSearch = searchInput.trim();
      if (normalizedSearch === (searchParams.get('search') || '')) {
        return;
      }
      setSearch(normalizedSearch);
      setPage(1);
      setSearchParams((current) => {
        if (normalizedSearch) current.set('search', normalizedSearch);
        else current.delete('search');
        current.set('page', '1');
        return current;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', search, statusFilter, page],
    queryFn: () => invoicesService.getInvoices(undefined, statusFilter || undefined, page, 50, search || undefined),
  });

  const invoices = data?.data || [];

  const getStatusBadge = (status: Invoice['status']) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: t('invoices.statusDraft') },
      ISSUED: { bg: 'bg-blue-100', text: 'text-blue-700', label: t('invoices.statusIssued') },
      VOID: { bg: 'bg-red-100', text: 'text-red-700', label: t('invoices.statusVoid') },
    };
    const c = config[status] || config.DRAFT;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const getPaymentBadge = (status: Invoice['paymentStatus']) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      UNPAID: { bg: 'bg-red-100', text: 'text-red-700', label: t('invoices.unpaid') },
      PARTIALLY_PAID: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: t('invoices.partiallyPaid') },
      PAID: { bg: 'bg-green-100', text: 'text-green-700', label: t('invoices.paidInFull') },
    };
    const c = config[status] || config.UNPAID;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <PageHeader title={t('sidebar.invoices')} breadcrumbs={[{ label: t('sidebar.invoices') }]} />
          <div className="ui-card p-6 space-y-3">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" count={5} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <div className="ui-card p-6 text-center text-[#C4362B] text-sm" role="alert">{t('invoices.loadError')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-8">
        <PageHeader title={t('sidebar.invoices')} breadcrumbs={[{ label: t('sidebar.invoices') }]} />

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="sr-only" htmlFor="invoice-search">{t('invoices.searchLabel')}</label>
            <input
              id="invoice-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('invoices.searchPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#111844] sm:min-w-64 sm:flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSearchParams((current) => { if (e.target.value) current.set('status', e.target.value); else current.delete('status'); current.set('page', '1'); return current; }); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#111844] sm:w-auto"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="DRAFT">{t('invoices.statusDraft')}</option>
              <option value="ISSUED">{t('invoices.statusIssued')}</option>
              <option value="VOID">{t('invoices.statusVoid')}</option>
            </select>
            <button
              onClick={() => { setStatusFilter(''); setSearchInput(''); setSearch(''); setPage(1); setSearchParams((current) => { current.delete('status'); current.delete('search'); current.set('page', '1'); return current; }); }}
              className="px-3 py-2 text-gray-600 hover:text-gray-900"
            >
              {t(search ? 'invoices.clearSearch' : 'common.clearFilters')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {invoices.length === 0 ? (
            <EmptyState title={search ? t('invoices.noMatchingInvoices') : t('invoices.noInvoices')} description={search ? t('invoices.clearSearchHint') : t('common.emptyDescription')} />
          ) : (
            <>
            <div className="mobile-record-list p-3 md:hidden">
              {invoices.map((invoice) => (
                <MobileRecordCard
                  key={invoice.id}
                  title={invoice.invoiceNumber}
                  subtitle={invoice.patient?.fullNameAr}
                  onClick={() => navigate(preserveListState(`/invoices/${invoice.id}`, location))}
                  actions={getPaymentBadge(invoice.paymentStatus)}
                >
                  <MobileRecordField label={t('invoices.total')} value={`${formatMoney(invoice.total, i18n.language)} ${t('common.currency')}`} />
                  <MobileRecordField label={t('invoices.remaining')} value={`${formatMoney(invoice.remaining, i18n.language)} ${t('common.currency')}`} />
                  <MobileRecordField label={t('invoices.invoiceStatus')} value={getStatusBadge(invoice.status)} />
                  <MobileRecordField label={t('common.date')} value={formatDateUtil(invoice.createdAt, i18n.language)} />
                </MobileRecordCard>
              ))}
            </div>
            <div className="hidden md:block">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.number')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('visits.patient')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.total')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.remaining')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.invoiceStatus')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('invoices.paymentStatusLabel')}</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => navigate(preserveListState(`/invoices/${invoice.id}`, location))}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 text-gray-900">{invoice.patient?.fullNameAr}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {formatMoney(invoice.total, i18n.language)} {t('common.currency')}
                    </td>
                    <td className="px-6 py-4 text-gray-900">
                      {formatMoney(invoice.remaining, i18n.language)} {t('common.currency')}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                    <td className="px-6 py-4">{getPaymentBadge(invoice.paymentStatus)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDateUtil(invoice.createdAt, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
          {data?.meta && data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <button onClick={() => setPage((currentPage) => { const next = Math.max(1, currentPage - 1); setSearchParams((current) => { current.set('page', String(next)); return current; }); return next; })} disabled={page === 1} className="px-3 py-1.5 rounded border disabled:opacity-40">{t('common.previous')}</button>
              <span className="text-sm">{page} / {data.meta.totalPages}</span>
              <button onClick={() => setPage((currentPage) => { const next = Math.min(data.meta.totalPages, currentPage + 1); setSearchParams((current) => { current.set('page', String(next)); return current; }); return next; })} disabled={page === data.meta.totalPages} className="px-3 py-1.5 rounded border disabled:opacity-40">{t('common.next')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
