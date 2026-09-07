import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { appointmentsService, CreateAppointmentDto } from '../services/appointments.service';
import { patientsService } from '../services/patients.service';
import { useTranslation } from 'react-i18next';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import Breadcrumb from '../components/Breadcrumb';
import { getReturnTo } from '../utils/listState';

export default function AppointmentForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/appointments');
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
      navigate(`/appointments/${data.id}?returnTo=${encodeURIComponent(returnTo)}`);
    },
    onError: (error: Error) => {
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
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: t('sidebar.appointments'), href: returnTo }, { label: t('appointments.newAppointment') }]} />
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#111844]">{t('appointments.newAppointment')}</h1>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 bg-[#111844] text-white rounded-md hover:bg-[#1a237e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
