import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsService, UpdateStatusDto, CancelAppointmentDto } from '../services/appointments.service';
import { useTranslation } from 'react-i18next';
import Breadcrumb from '../components/Breadcrumb';
import { getReturnTo, preserveListState } from '../utils/listState';
import { useToast } from '../contexts/ToastContext';

export default function AppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      BOOKED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'محجوز' },
      CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'مؤكد' },
      DONE: { bg: 'bg-green-100', text: 'text-green-700', label: 'تم' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'ملغي' },
      NO_SHOW: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'لم يحضر' },
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
    return date.toLocaleString('ar-KW', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            فشل في تحميل بيانات الموعد
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA] dir-rtl">
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: t('sidebar.appointments'), href: returnTo }, { label: t('appointments.detailsTitle') }]} />

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#111844]">تفاصيل الموعد</h1>
          <button
            onClick={() => navigate(returnTo)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            عودة
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appointment Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="space-y-6">
                {/* Patient Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">بيانات المريض</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">الاسم</label>
                      <p className="font-medium text-gray-900">{appointment.patient.fullNameAr}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">الرقم المدني</label>
                      <p className="font-medium text-gray-900">{appointment.patient.civilId}</p>
                    </div>
                    {appointment.patient.phone && (
                      <div>
                        <label className="text-sm text-gray-500 block mb-1">الهاتف</label>
                        <p className="text-gray-900">{appointment.patient.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Appointment Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">بيانات الموعد</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">التاريخ والوقت</label>
                      <p className="font-medium text-gray-900">{formatDateTime(appointment.scheduledAt)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">الحالة</label>
                      {getStatusBadge(appointment.status)}
                    </div>
                    {appointment.notes && (
                      <div>
                        <label className="text-sm text-gray-500 block mb-1">ملاحظات</label>
                        <p className="text-gray-900">{appointment.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Info */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">معلومات الإنشاء</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">تاريخ الإنشاء</label>
                      <p className="text-gray-900">{new Date(appointment.createdAt).toLocaleString('ar-KW')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">الإجراءات</h3>
              <div className="space-y-3">
                {canConfirm && (
                  <button
                    onClick={() => handleStatusChange('CONFIRMED')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    تأكيد الموعد
                  </button>
                )}

                {canMarkDone && (
                  <button
                    onClick={() => handleStatusChange('DONE')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    تم الإنجاز
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    إلغاء الموعد
                  </button>
                )}

                {canMarkNoShow && (
                  <button
                    onClick={() => handleStatusChange('NO_SHOW')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    لم يحضر
                  </button>
                )}

                <Link
                  to={preserveListState(`/patients/${appointment.patient.id}`, { pathname: `/appointments/${appointment.id}`, search: '' })}
                  className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  عرض الملف الطبي
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">سبب الإلغاء</h3>
              
              <div className="space-y-3 mb-4">
                <button
                  type="button"
                  onClick={() => setCancelReasonType('طلب المريضة')}
                  className={`w-full py-2 px-4 rounded-md border ${
                    cancelReasonType === 'طلب المريضة'
                      ? 'border-[#111844] bg-[#111844] text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  طلب المريضة
                </button>
                <button
                  type="button"
                  onClick={() => setCancelReasonType('تعارض بالمواعيد')}
                  className={`w-full py-2 px-4 rounded-md border ${
                    cancelReasonType === 'تعارض بالمواعيد'
                      ? 'border-[#111844] bg-[#111844] text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  تعارض بالمواعيد
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
                  أخرى
                </button>
              </div>

              {cancelReasonType === 'other' && (
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="اكتب السبب..."
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
                  إلغاء
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!cancelReasonType || (cancelReasonType === 'other' && !cancelReason) || cancelMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  تأكيد الإلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
