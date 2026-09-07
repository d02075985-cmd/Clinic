import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { invoicesService, Invoice } from '../services/invoices.service';
import { useTranslation } from 'react-i18next';
import { formatDate as formatDateUtil } from '../utils/dateFormat';
import { formatMoney } from '../utils/money';

export default function InvoicesList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesService.getInvoices(undefined, statusFilter || undefined, 1, 50),
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
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {t('invoices.loadError')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#111844]">{t('sidebar.invoices')}</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="DRAFT">{t('invoices.statusDraft')}</option>
              <option value="ISSUED">{t('invoices.statusIssued')}</option>
              <option value="VOID">{t('invoices.statusVoid')}</option>
            </select>
            <button
              onClick={() => setStatusFilter('')}
              className="px-3 py-2 text-gray-600 hover:text-gray-900"
            >
              {t('common.clearFilters')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-gray-500">{t('invoices.noInvoices')}</div>
          ) : (
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
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
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
          )}
        </div>
      </div>
    </div>
  );
}
