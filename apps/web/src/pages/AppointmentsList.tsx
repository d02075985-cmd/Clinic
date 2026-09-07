import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appointmentsService, Appointment } from '../services/appointments.service';
import { useTranslation } from 'react-i18next';
import { formatTime as formatTimeUtil } from '../utils/dateFormat';
import Breadcrumb from '../components/Breadcrumb';
import { preserveListState } from '../utils/listState';

type ViewType = 'calendar' | 'list';

export default function AppointmentsList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewType, setViewType] = useState<ViewType>((searchParams.get('view') as ViewType) || 'calendar');
  const [selectedDate, setSelectedDate] = useState(() => {
    const value = searchParams.get('date');
    const date = value ? new Date(`${value}T00:00:00`) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', formatDate(selectedDate), statusFilter],
    queryFn: () => appointmentsService.getAppointments(formatDate(selectedDate), statusFilter),
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleNewAppointment = () => {
    navigate(preserveListState('/appointments/new', location));
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
    setSearchParams((current) => { current.set('date', formatDate(newDate)); return current; });
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    navigate(preserveListState(`/appointments/${appointment.id}`, location));
  };

  const formatTime = (dateString: string) => formatTimeUtil(dateString, i18n.language);

  const formatDateDisplay = (date: Date) => {
    const locale = i18n.language === 'ar' ? 'ar-KW' : 'en-GB';
    return date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb items={[{ label: t('sidebar.appointments') }]} />
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
            {t('appointments.loadError')}
          </div>
        </div>
      </div>
    );
  }

  const appointments = data?.data || [];

  // Generate time slots for calendar view
  const timeSlots = [];
  for (let hour = 8; hour <= 20; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: t('sidebar.appointments') }]} />
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#111844]">{t('sidebar.appointments')}</h1>
          <button
            onClick={handleNewAppointment}
            className="px-4 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors"
          >
            + {t('appointments.newAppointment')}
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Date Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleDateChange(-1)}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                {t('common.previous')}
              </button>
              <span className="font-medium text-gray-900 min-w-[200px] text-center">
                {formatDateDisplay(selectedDate)}
              </span>
              <button
                onClick={() => handleDateChange(1)}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
              >
                {t('common.next')}
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => { setViewType('calendar'); setSearchParams((current) => { current.set('view', 'calendar'); return current; }); }}
                className={`px-3 py-1 rounded ${
                  viewType === 'calendar'
                    ? 'bg-[#111844] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('appointments.calendarView')}
              </button>
              <button
                onClick={() => { setViewType('list'); setSearchParams((current) => { current.set('view', 'list'); return current; }); }}
                className={`px-3 py-1 rounded ${
                  viewType === 'list'
                    ? 'bg-[#111844] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('appointments.listView')}
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSearchParams((current) => { if (e.target.value) current.set('status', e.target.value); else current.delete('status'); return current; }); }}
              className="px-3 py-1 border border-gray-300 rounded"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="BOOKED">{t('appointments.statusBooked')}</option>
              <option value="CONFIRMED">{t('appointments.statusConfirmed')}</option>
              <option value="DONE">{t('appointments.statusDone')}</option>
              <option value="CANCELLED">{t('appointments.statusCancelled')}</option>
              <option value="NO_SHOW">{t('appointments.statusNoShow')}</option>
            </select>
          </div>
        </div>

        {/* Calendar View */}
        {viewType === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="divide-y divide-gray-200">
              {timeSlots.map((time) => {
                const slotAppointments = appointments.filter((apt) => {
                  const aptTime = formatTime(apt.scheduledAt);
                  return aptTime === time;
                });

                return (
                  <div
                    key={time}
                    className="flex items-center p-4 hover:bg-gray-50 min-h-[60px]"
                  >
                    <div className="w-20 text-sm font-medium text-gray-600">{time}</div>
                    <div className="flex-1">
                      {slotAppointments.length > 0 ? (
                        slotAppointments.map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => handleAppointmentClick(apt)}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 mb-2"
                          >
                            <div>
                              <div className="font-medium text-gray-900">{apt.patient.fullNameAr}</div>
                              <div className="text-sm text-gray-500">{apt.patient.civilId}</div>
                            </div>
                            {getStatusBadge(apt.status)}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-400 text-sm">{t('appointments.slotAvailable')}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewType === 'list' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {appointments.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                {t('appointments.noAppointmentsToday')}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('visits.time')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('visits.patient')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('patients.civilId')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {appointments
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map((apt) => (
                      <tr
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-6 py-4 text-gray-900">{formatTime(apt.scheduledAt)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{apt.patient.fullNameAr}</td>
                        <td className="px-6 py-4 text-gray-600">{apt.patient.civilId}</td>
                        <td className="px-6 py-4">{getStatusBadge(apt.status)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
