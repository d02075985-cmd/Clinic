import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService, UpdateStatusDto, CancelAppointmentDto } from '../services/appointments.service';
import { useTranslation } from 'react-i18next';
import { getReturnTo, preserveListState } from '../utils/listState';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';
import { formatDateTime as formatLocalizedDateTime } from '../utils/dateFormat';

export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/appointments');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonType, setCancelReasonType] = useState('');

  const { data: appointment, isLoading, error } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsService.getAppointment(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStatusDto }) =>
      appointmentsService.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      showToast({ type: 'success', message: t('feedback.appointmentStatusUpdated') });
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: error.message || t('feedback.appointmentStatusFailed') });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelAppointmentDto }) =>
      appointmentsService.cancelAppointment(id, data),
    onSuccess: () => {
      setShowCancelDialog(false);
      setCancelReason('');
      setCancelReasonType('');
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      showToast({ type: 'success', message: t('feedback.appointmentCancelled') });
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: error.message || t('feedback.appointmentCancelFailed') });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      BOOKED: { bg: 'bg-blue-100', text: 'text-blue-700', label: t('appointments.statusBooked') },
      CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: t('appointments.statusConfirmed') },
      DONE: { bg: 'bg-green-100', text: 'text-green-700', label: t('appointments.statusDone') },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: t('appointments.statusCancelled') },
      NO_SHOW: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: t('appointments.statusNoShow') },
    };

    const config = statusConfig[status] || statusConfig.BOOKED;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleStatusChange = (newStatus: string) => {
    updateStatusMutation.mutate({ id: id!, data: { status: newStatus as UpdateStatusDto['status'] } });
  };

  const handleCancel = () => {
    const reason = cancelReasonType === 'other' ? cancelReason : cancelReasonType;
    cancelMutation.mutate({ id: id!, data: { reason } });
  };

  const canConfirm = appointment?.status === 'BOOKED';
  const canMarkDone = appointment?.status === 'CONFIRMED';
  const canCancel = appointment?.status === 'BOOKED' || appointment?.status === 'CONFIRMED';
  const canMarkNoShow = appointment?.status === 'BOOKED' || appointment?.status === 'CONFIRMED';

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return formatLocalizedDateTime(date, i18n.language);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
        <div className="container mx-auto px-4 py-8">
          <div className="ui-card p-6 space-y-3"><Skeleton className="h-8 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
        <div className="container mx-auto px-4 py-8">
          <div className="ui-card p-6 text-center text-[#C4362B] text-sm" role="alert">{t('appointments.loadError')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title={t('appointments.detailsTitle')}
          breadcrumbs={[{ label: t('sidebar.appointments'), href: returnTo }, { label: t('appointments.detailsTitle') }]}
          backTo={returnTo}
          actions={
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate(`/appointments/${appointment.id}/edit?returnTo=${encodeURIComponent(returnTo)}`)} className="btn-primary px-4 py-2">
                {t('common.edit')}
              </button>
              <button onClick={() => navigate(returnTo)} className="rounded-md bg-gray-200 px-4 py-2 text-gray-700">{t('common.back')}</button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Appointment Details */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-4 shadow-md sm:p-6">
              <div className="space-y-6">
                {/* Patient Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('appointments.patientInfo')}</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{t('patients.name')}</label>
                      <p className="font-medium text-gray-900">{appointment.patient.fullNameAr}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{t('patients.civilId')}</label>
                      <p className="font-medium text-gray-900">{appointment.patient.civilId}</p>
                    </div>
                    {appointment.patient.phone && (
                      <div>
                        <label className="text-sm text-gray-500 block mb-1">{t('patients.phone')}</label>
                        <p className="text-gray-900">{appointment.patient.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Appointment Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('appointments.appointmentInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{t('appointments.dateTime')}</label>
                      <p className="font-medium text-gray-900">{formatDateTime(appointment.scheduledAt)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{t('common.status')}</label>
                      {getStatusBadge(appointment.status)}
                    </div>
                    {appointment.notes && (
                      <div>
                        <label className="text-sm text-gray-500 block mb-1">{t('appointments.notes')}</label>
                        <p className="text-gray-900">{appointment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Info */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('appointments.creationInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{t('appointments.createdAt')}</label>
                      <p className="text-gray-900">{new Date(appointment.createdAt).toLocaleString('ar-KW')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-4 shadow-md sm:sticky sm:top-8 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('common.actions')}</h3>
              <div className="space-y-3">
                {canConfirm && (
                  <button
                    onClick={() => handleStatusChange('CONFIRMED')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {t('appointments.confirm')}
                  </button>
                )}

                {canMarkDone && (
                  <button
                    onClick={() => handleStatusChange('DONE')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {t('appointments.markDone')}
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    {t('appointments.cancel')}
                  </button>
                )}

                {canMarkNoShow && (
                  <button
                    onClick={() => handleStatusChange('NO_SHOW')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    {t('appointments.markNoShow')}
                  </button>
                )}

                <Link
                  to={preserveListState(`/patients/${appointment.patient.id}`, { pathname: `/appointments/${appointment.id}`, search: '' })}
                  className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {t('appointments.viewPatient')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('appointments.cancelReason')}</h3>
              
              <div className="space-y-3 mb-4">
                <button
                  type="button"
                  onClick={() => setCancelReasonType('patientRequest')}
                  className={`w-full py-2 px-4 rounded-md border ${
                    cancelReasonType === 'patientRequest'
                      ? 'border-[#111844] bg-[#111844] text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('appointments.cancelPatientRequest')}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelReasonType('scheduleConflict')}
                  className={`w-full py-2 px-4 rounded-md border ${
                    cancelReasonType === 'scheduleConflict'
                      ? 'border-[#111844] bg-[#111844] text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('appointments.cancelScheduleConflict')}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelReasonType('other')}
                  className={`w-full py-2 px-4 rounded-md border ${
                    cancelReasonType === 'other'
                      ? 'border-[#111844] bg-[#111844] text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('appointments.cancelOther')}
                </button>
              </div>

              {cancelReasonType === 'other' && (
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={t('appointments.cancelReasonPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] mb-4"
                />
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancelReason('');
                    setCancelReasonType('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReasonType || (cancelReasonType === 'other' && !cancelReason) || cancelMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('appointments.confirmCancellation')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
