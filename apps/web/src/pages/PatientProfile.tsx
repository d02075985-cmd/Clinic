import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../services/patients.service';
import { visitsService } from '../services/visits.service';
import { invoicesService } from '../services/invoices.service';
import { appointmentsService } from '../services/appointments.service';
import { paymentsService, Payment } from '../services/payments.service';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import Breadcrumb from '../components/Breadcrumb';
import { getReturnTo, preserveListState } from '../utils/listState';

type TabType = 'overview' | 'visits' | 'invoices' | 'payments' | 'appointments';

export default function PatientProfile() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientsListReturnTo = getReturnTo(searchParams.toString(), '/patients');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsService.getPatient(id!),
    enabled: !!id,
  });

  const { data: visitsData } = useQuery({
    queryKey: ['patientVisits', id],
    queryFn: () => visitsService.getPatientVisits(id!),
    enabled: !!id && activeTab === 'visits',
  });
  const { data: invoicesData } = useQuery({
    queryKey: ['patientInvoices', id],
    queryFn: () => invoicesService.getInvoices(id!, undefined, 1, 50),
    enabled: !!id && (activeTab === 'invoices' || activeTab === 'payments'),
  });
  const { data: appointmentsData } = useQuery({
    queryKey: ['patientAppointments', id],
    queryFn: () => appointmentsService.getAppointments(undefined, undefined, id!, 1, 50),
    enabled: !!id && activeTab === 'appointments',
  });
  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['patientPayments', id, invoicesData?.data.map((invoice) => invoice.id)],
    queryFn: async () => {
      const invoices = invoicesData?.data || [];
      return (await Promise.all(invoices.map((invoice) => paymentsService.getPaymentsForInvoice(invoice.id)))).flat();
    },
    enabled: !!id && activeTab === 'payments' && !!invoicesData,
  });

  const visits = visitsData?.data || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="col-span-2 h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {t('patients.detailLoadError')}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: t('patients.tabOverview') },
    { id: 'visits' as TabType, label: t('sidebar.visits') },
    { id: 'invoices' as TabType, label: t('sidebar.invoices') },
    { id: 'payments' as TabType, label: t('patients.tabPayments') },
    { id: 'appointments' as TabType, label: t('sidebar.appointments') },
  ];

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: t('sidebar.patients'), href: patientsListReturnTo }, { label: patient.fullNameAr }]} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Panel (Right side in RTL) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              {/* Unpaid Balance Warning */}
              <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded text-sm">
                {t('patients.outstandingBalance')}: 0 {t('common.currency')}
              </div>

              {/* Patient Name */}
              <h2 className="text-2xl font-bold text-[#111844] mb-4">{patient.fullNameAr}</h2>

              {/* Civil ID - Most Dominant */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 block mb-1">{t('patients.civilId')}</label>
                <p className="text-xl font-bold text-[#111844]">{patient.civilId}</p>
              </div>

              {/* Phone */}
              {patient.phone && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500 block mb-1">{t('patients.phone')}</label>
                  <p className="text-gray-900">{patient.phone}</p>
                </div>
              )}

              {/* Date of Birth */}
              {patient.dateOfBirth && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500 block mb-1">{t('patients.dobLabel')}</label>
                  <p className="text-gray-900">
                    {formatDate(patient.dateOfBirth, i18n.language)}
                  </p>
                </div>
              )}

              {/* Address */}
              {patient.address && (
                <div className="mb-4">
                  <label className="text-sm text-gray-500 block mb-1">{t('patients.addressLabel')}</label>
                  <p className="text-gray-900">{patient.address}</p>
                </div>
              )}

              {/* English Name */}
              {patient.fullNameEn && (
                <div className="mb-6">
                  <label className="text-sm text-gray-500 block mb-1">{t('patients.nameEnLabel')}</label>
                  <p className="text-gray-900">{patient.fullNameEn}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* + New Visit - Primary Action */}
                <button
                  onClick={() => navigate(preserveListState(`/visits/new?patientId=${patient.id}`, { pathname: `/patients/${patient.id}`, search: '' }))}
                  className="w-full py-3 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors font-medium"
                >
                  + {t('visits.newVisit')}
                </button>

                {/* Edit Patient */}
                <button
                  onClick={() => navigate(preserveListState(`/patients/${patient.id}/edit`, { pathname: `/patients/${patient.id}`, search: searchParams.toString() }))}
                  className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('patients.editData')}
                </button>
              </div>

              {/* Archive Status */}
              {patient.isArchived && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded text-sm">
                  {t('patients.archivedNotice')}
                </div>
              )}
            </div>
          </div>

          {/* Tabbed Content Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-0 space-x-reverse">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'text-[#111844] border-b-2 border-[#111844]'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">{t('patients.tabOverview')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-500">{t('patients.lastVisit')}</p>
                        <p className="text-lg font-semibold text-gray-900">-</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-500">{t('patients.outstandingBalance')}</p>
                        <p className="text-lg font-semibold text-gray-900">0 {t('common.currency')}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-500">{t('patients.nextVisit')}</p>
                        <p className="text-lg font-semibold text-gray-900">-</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm text-gray-500">{t('patients.totalVisits')}</p>
                        <p className="text-lg font-semibold text-gray-900">0</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'visits' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{t('patients.visitsHistory')}</h3>
                      <button
                        onClick={() => navigate(preserveListState(`/visits/new?patientId=${id}`, { pathname: `/patients/${id}`, search: '' }))}
                        className="px-4 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors text-sm"
                      >
                        + {t('visits.newVisit')}
                      </button>
                    </div>
                    {visits.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {t('patients.noVisitsRecorded')}
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">{t('common.date')}</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">{t('visits.type')}</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">{t('sidebar.appointments')}</th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">{t('visits.notesLabel')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {visits.map((visit) => (
                            <tr key={visit.id} onClick={() => navigate(preserveListState(`/visits/${visit.id}`, { pathname: `/patients/${patient.id}`, search: '' }))} className="cursor-pointer hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-900">
                                {formatDateTime(visit.visitDate, i18n.language)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  visit.type === 'CHECKUP' ? 'bg-blue-100 text-blue-700' :
                                  visit.type === 'FOLLOW_UP' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {visit.type === 'CHECKUP' ? t('visits.typeCheckup') :
                                   visit.type === 'FOLLOW_UP' ? t('visits.typeFollowUp') : t('visits.typeOther')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {visit.appointment ? formatDate(visit.appointment.scheduledAt, i18n.language) : '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-sm">
                                {visit.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'invoices' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('patients.invoicesHistory')}</h3>
                    {(invoicesData?.data || []).length === 0 ? <div className="text-center py-8 text-gray-500">{t('patients.noInvoicesRecorded')}</div> : (
                      <div className="space-y-2">{invoicesData?.data.map((invoice) => (
                    <button key={invoice.id} onClick={() => navigate(preserveListState(`/invoices/${invoice.id}`, { pathname: `/patients/${patient.id}`, search: '' }))} className="w-full flex justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 text-right">
                      <span className="font-medium">{invoice.invoiceNumber}</span><span>{formatDate(invoice.createdAt, i18n.language)} · {invoice.total} {t('common.currency')}</span>
                    </button>
                      ))}</div>
                    )}
                  </div>
                )}

                {activeTab === 'payments' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('patients.paymentsHistory')}</h3>
                    {payments.length === 0 ? <div className="text-center py-8 text-gray-500">{t('patients.noPaymentsRecorded')}</div> : (
                      <div className="space-y-2">{payments.map((payment) => (
                        <button key={payment.id} onClick={() => navigate(preserveListState(`/invoices/${payment.invoiceId}`, { pathname: `/patients/${patient.id}`, search: '' }))} className="w-full flex justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 text-right">
                          <span>{formatDate(payment.paymentDate, i18n.language)}</span><span>{payment.amount} {t('common.currency')}</span>
                        </button>
                      ))}</div>
                    )}
                  </div>
                )}

                {activeTab === 'appointments' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('patients.appointmentsHistory')}</h3>
                    {(appointmentsData?.data || []).length === 0 ? <div className="text-center py-8 text-gray-500">{t('patients.noAppointmentsRecorded')}</div> : (
                      <div className="space-y-2">{appointmentsData?.data.map((appointment) => (
                        <button key={appointment.id} onClick={() => navigate(preserveListState(`/appointments/${appointment.id}`, { pathname: `/patients/${patient.id}`, search: '' }))} className="w-full flex justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 text-right">
                          <span>{formatDateTime(appointment.scheduledAt, i18n.language)}</span><span>{appointment.status}</span>
                        </button>
                      ))}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
