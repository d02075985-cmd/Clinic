import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { appointmentsService, CreateAppointmentDto } from '../services/appointments.service';
import { patientsService } from '../services/patients.service';
import { useTranslation } from 'react-i18next';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import { getReturnTo } from '../utils/listState';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';

export default function AppointmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/appointments');
  const { showToast } = useToast();
  const [formData, setFormData] = useState<CreateAppointmentDto>({
    patientId: '',
    scheduledAt: '',
    notes: '',
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // Search patients for typeahead
  const { data: patientsData } = useQuery({
    queryKey: ['patients', patientSearch],
    queryFn: () => patientsService.getPatients(patientSearch, false, 1, 10),
    enabled: patientSearch.length >= 2,
  });

  const patients = patientsData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: CreateAppointmentDto) => appointmentsService.createAppointment(data),
    onSuccess: (data) => {
      showToast({ type: 'success', message: t('feedback.appointmentCreated') });
      navigate(`/appointments/${data.id}?returnTo=${encodeURIComponent(returnTo)}`);
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: error.message || t('appointments.createError') });
      setErrors({ general: error.message || t('appointments.createError') });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.patientId) {
      newErrors.patientId = t('visits.patientRequired');
    }

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = t('appointments.dateTimeRequired');
    } else {
      const scheduledDate = new Date(formData.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        newErrors.scheduledAt = t('visits.invalidDateTime');
      }
    }

    if (formData.notes && formData.notes.length > 1000) {
      newErrors.notes = t('visits.notesTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    createMutation.mutate(formData);
  };

  const handlePatientSelect = (patientId: string, patientName: string) => {
    setFormData((prev) => ({ ...prev, patientId }));
    setPatientSearch(patientName);
    setShowPatientDropdown(false);
  };

  const handleCancel = () => {
    navigate(returnTo);
  };

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-5 sm:py-8">
        <PageHeader
          title={t('appointments.newAppointment')}
          breadcrumbs={[{ label: t('sidebar.appointments'), href: returnTo }, { label: t('appointments.newAppointment') }]}
          actions={<button onClick={handleCancel} className="btn-primary px-4 py-2">{t('common.cancel')}</button>}
        />

        {/* Form */}
        <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-md sm:p-6">
          {errors.general && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('visits.patient')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder={t('visits.patientSearchPlaceholder')}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.patientId ? 'border-red-500' : 'border-gray-300'
                  }`}
              />
              {errors.patientId && (
                <p className="mt-1 text-sm text-red-600">{errors.patientId}</p>
              )}

              {/* Patient Dropdown */}
              {showPatientDropdown && patients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => handlePatientSelect(patient.id, patient.fullNameAr)}
                      className="w-full px-4 py-3 text-right hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{patient.fullNameAr}</div>
                      <div className="text-sm text-gray-500">
                        {patient.civilId} {patient.phone && `• ${patient.phone}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.date')} <span className="text-red-500">*</span>
                </label>
                <DateInput
                  value={formData.scheduledAt ? formData.scheduledAt.split('T')[0] : ''}
                  onChange={(dateStr) => {
                    const time = formData.scheduledAt ? formData.scheduledAt.split('T')[1] || '10:00' : '10:00';
                    setFormData((prev) => ({ ...prev, scheduledAt: `${dateStr}T${time}` }));
                  }}
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.scheduledAt ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('visits.time')} <span className="text-red-500">*</span>
                </label>
                <TimeInput
                  value={formData.scheduledAt ? formData.scheduledAt.split('T')[1] || '10:00' : '10:00'}
                  onChange={(timeStr) => {
                    const date = formData.scheduledAt ? formData.scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0];
                    setFormData((prev) => ({ ...prev, scheduledAt: `${date}T${timeStr}` }));
                  }}
                  className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.scheduledAt ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
              </div>
            </div>
            {errors.scheduledAt && (
              <p className="mt-1 text-sm text-red-600">{errors.scheduledAt}</p>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('visits.notesLabel')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                maxLength={1000}
                rows={3}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.notes ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder={t('appointments.notesPlaceholder')}
              />
              {errors.notes && (
                <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="w-full rounded-md bg-gray-200 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-300 sm:w-auto"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-md bg-[#111844] px-6 py-2 text-white transition-colors hover:bg-[#1a237e] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {createMutation.isPending ? t('appointments.booking') : t('appointments.bookAppointment')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
