import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { servicesService, CreateServiceDto, UpdateServiceDto } from '../services/services.service';
import { useTranslation } from 'react-i18next';
import { moneyToCents, normalizeMoneyInput } from '../utils/money';
import { getReturnTo } from '../utils/listState';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export default function ServiceForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = getReturnTo(searchParams.toString(), '/services');
  const { showToast } = useToast();
  const isEdit = !!id;

  const [formData, setFormData] = useState<CreateServiceDto | UpdateServiceDto>({
    name: '',
    code: '',
    description: '',
    currentPrice: 0,
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPriceWarning, setShowPriceWarning] = useState(false);

  // Fetch service data if editing
  const { data: serviceData, isLoading } = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesService.getService(id!),
    enabled: isEdit,
  });
  const initialFormData = { name: '', code: '', description: '', currentPrice: 0, isActive: true };
  const baseline = serviceData ? {
    name: serviceData.name, code: serviceData.code || '', description: serviceData.description || '',
    currentPrice: parseFloat(serviceData.currentPrice), isActive: serviceData.isActive,
  } : initialFormData;
  const { confirmOpen, requestNavigation, stay, leave } = useUnsavedChanges(JSON.stringify(formData) !== JSON.stringify(baseline));

  // Populate form when service data is loaded
  useEffect(() => {
    if (serviceData) {
      setFormData({
        name: serviceData.name,
        code: serviceData.code || '',
        description: serviceData.description || '',
        currentPrice: parseFloat(serviceData.currentPrice),
        isActive: serviceData.isActive,
      });
    }
  }, [serviceData]);

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceDto) => servicesService.createService(data),
    onSuccess: () => {
      showToast({ type: 'success', message: t('feedback.serviceCreated') });
      navigate(returnTo);
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: error.message || t('services.createError') });
      setErrors({ general: error.message || t('services.createError') });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; dto: UpdateServiceDto }) =>
      servicesService.updateService(data.id, data.dto),
    onSuccess: () => {
      showToast({ type: 'success', message: t('feedback.serviceUpdated') });
      navigate(returnTo);
    },
    onError: (error: Error) => {
      showToast({ type: 'error', message: error.message || t('services.updateError') });
      setErrors({ general: error.message || t('services.updateError') });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      newErrors.name = t('services.nameRequired');
    }

    if (formData.name && formData.name.length > 255) {
      newErrors.name = t('services.nameTooLong');
    }

    if (formData.currentPrice === undefined || formData.currentPrice === null) {
      newErrors.currentPrice = t('services.priceRequired');
    } else if (formData.currentPrice < 0) {
      newErrors.currentPrice = t('services.priceInvalid');
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = t('services.descriptionTooLong');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isEdit) {
      updateMutation.mutate({ id: id!, dto: formData as UpdateServiceDto });
    } else {
      createMutation.mutate(formData as CreateServiceDto);
    }
  };

  const handlePriceChange = (value: string) => {
    const cents = moneyToCents(normalizeMoneyInput(value));
    if (value !== '' && cents === null) {
      setErrors((previous) => ({ ...previous, currentPrice: t('invoices.invalidMoneyPrecision') }));
      return;
    }
    const price = cents === null ? 0 : cents / 100;
    setFormData((prev) => ({ ...prev, currentPrice: price }));

    // Show warning if editing and price is being changed
    if (isEdit && serviceData && price !== parseFloat(serviceData.currentPrice)) {
      setShowPriceWarning(true);
    }
  };

  const handleCancel = () => {
    requestNavigation(() => navigate(returnTo));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7FA]">
        <div className="container mx-auto px-4 py-5 sm:py-8">
          <div className="ui-card p-6 space-y-3"><Skeleton className="h-8 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FA]">
      <div className="container mx-auto px-4 py-8">
        <PageHeader
          title={isEdit ? t('services.editService') : t('services.newService')}
          breadcrumbs={[{ label: t('sidebar.services'), href: returnTo }, { label: isEdit ? t('services.editService') : t('services.newService') }]}
          backTo={returnTo}
          onBack={() => requestNavigation(() => navigate(returnTo))}
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
            {/* Service Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('services.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                onBlur={validateForm}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder={t('services.namePlaceholder')}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('services.code')}
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                maxLength={50}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]"
                placeholder={t('services.codePlaceholder')}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('services.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                maxLength={1000}
                rows={3}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder={t('services.descriptionPlaceholder')}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('services.price')} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.currentPrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  onBlur={validateForm}
                  className={`flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844] ${errors.currentPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="0.00"
                />
                <span className="text-gray-500 shrink-0">{t('common.currency')}</span>
              </div>
              {errors.currentPrice && (
                <p className="mt-1 text-sm text-red-600">{errors.currentPrice}</p>
              )}
              {showPriceWarning && (
                <p className="mt-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded">
                  {t('services.priceChangeWarning')}
                </p>
              )}
            </div>

            {/* Active Status */}
            <div>
              <label className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-[#111844] border-gray-300 rounded focus:ring-[#111844]"
                />
                <span className="text-sm font-medium text-gray-700">{t('common.active')}</span>
              </label>
              <p className="mt-1 text-sm text-gray-500">
                {t('services.inactiveHint')}
              </p>
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full rounded-md bg-[#111844] px-6 py-2 text-white transition-colors hover:bg-[#1a237e] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? t('common.saving')
                  : isEdit
                    ? t('common.saveChanges')
                    : t('services.saveService')}
              </button>
            </div>
          </form>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title={t('common.unsavedChangesTitle')}
          message={t('common.unsavedChangesMessage')}
          confirmLabel={t('common.leave')}
          cancelLabel={t('common.stay')}
          destructive
          onConfirm={() => leave(() => navigate(returnTo))}
          onCancel={stay}
        />
      </div>
    </div>
  );
}
