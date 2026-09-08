import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Pencil, CalendarPlus, Plus, Filter } from 'lucide-react';
import { patientsService } from '../services/patients.service';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/dateFormat';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { preserveListState } from '../utils/listState';
import MobileRecordCard, { MobileRecordField } from '../components/MobileRecordCard';

// Masks all but the first and last digit of a civil ID for display in the
// list view only — the full number is still shown on the patient's own
// detail/edit page and on invoices, this is purely an on-screen privacy
// convenience for a shared front-desk monitor.
function maskCivilId(civilId: string): string {
  if (!civilId || civilId.length <= 2) return civilId;
  return civilId[0] + 'X'.repeat(civilId.length - 2) + civilId[civilId.length - 1];
}

export default function PatientsList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const initialArchived = searchParams.get('archived');
  const [isArchived, setIsArchived] = useState<boolean | undefined>(initialArchived === null ? undefined : initialArchived === 'true');
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', search, isArchived, page],
    queryFn: () => patientsService.getPatients(search, isArchived, page, limit),
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    setSearchParams((current) => { current.set('search', value); current.set('page', '1'); return current; });
  };

  const handleArchiveFilter = (value: 'all' | 'active' | 'archived') => {
    setIsArchived(value === 'all' ? undefined : value === 'archived');
    setPage(1);
    setShowFilter(false);
    setSearchParams((current) => {
      if (value === 'all') current.delete('archived'); else current.set('archived', String(value === 'archived'));
      current.set('page', '1'); return current;
    });
  };

  const patients = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="page-container">
      <PageHeader
        title={t('sidebar.patients')}
        subtitle={t('patients.subtitle')}
        breadcrumbs={[{ label: t('sidebar.patients') }]}
        actions={
          <button onClick={() => navigate(preserveListState('/patients/new', location))} className="btn-primary flex items-center gap-2 px-4 py-2.5">
            <Plus size={18} strokeWidth={2} />
            {t('patients.addNew')}
          </button>
        }
      />

      <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 sm:max-w-md">
          <Search size={17} strokeWidth={1.75} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('patients.searchPatients')}
            className="ui-input pr-10"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilter((s) => !s)}
            className="h-11 px-4 flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-white text-sm text-[#102F63] hover:bg-[#F6F8FC]"
          >
            <Filter size={16} strokeWidth={1.75} />
            {t('common.filter')}
          </button>
          {showFilter && (
            <div style={{ insetInlineStart: 0 }} className="absolute z-10 mt-2 w-40 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-[var(--shadow-soft-lg)]">
              {(['all', 'active', 'archived'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleArchiveFilter(opt)}
                  className={`w-full text-right px-4 py-2.5 text-sm hover:bg-[#F6F8FC] ${
                    (opt === 'all' && isArchived === undefined) ||
                    (opt === 'active' && isArchived === false) ||
                    (opt === 'archived' && isArchived === true)
                      ? 'text-[#102F63] font-semibold bg-[#F6F8FC]'
                      : 'text-[#64748B]'
                  }`}
                >
                  {opt === 'all' ? t('common.all') : opt === 'active' ? t('common.active') : t('common.archived')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="ui-card p-6 space-y-3">
          <Skeleton className="h-11 rounded-lg" count={6} />
        </div>
      )}

      {error && (
        <div className="ui-card p-6 text-center text-[#C4362B] text-sm">{t('patients.loadError')}</div>
      )}

      {!isLoading && !error && patients.length === 0 && (
        <div className="ui-card">
          <EmptyState title={search ? t('common.noSearchResults') : t('common.noDataAvailable')} description={t('common.emptyDescription')} />
        </div>
      )}

      {!isLoading && !error && patients.length > 0 && (
         <div className="ui-card overflow-hidden p-0">
          <div className="mobile-record-list p-3 md:hidden">
            {patients.map((patient) => (
              <MobileRecordCard
                key={patient.id}
                title={patient.fullNameAr}
                subtitle={patient.fullNameEn}
                actions={
                  <div className="flex items-center gap-1">
                    <button onClick={(event) => { event.stopPropagation(); navigate(preserveListState(`/patients/${patient.id}/edit`, location)); }} aria-label={t('patients.editPatient')} className="icon-btn"><Pencil size={16} strokeWidth={1.75} /></button>
                    <button onClick={(event) => { event.stopPropagation(); navigate(`/appointments/new?patientId=${encodeURIComponent(patient.id)}&returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`); }} aria-label={t('patients.bookAppointment')} className="icon-btn"><CalendarPlus size={16} strokeWidth={1.75} /></button>
                  </div>
                }
                onClick={() => navigate(preserveListState(`/patients/${patient.id}`, location))}
              >
                <MobileRecordField label={t('patients.civilId')} value={<span className="font-mono">{maskCivilId(patient.civilId)}</span>} />
                <MobileRecordField label={t('patients.phone')} value={patient.phone || '—'} />
                <MobileRecordField label={t('patients.lastVisit')} value={formatDate(patient.lastVisitDate, i18n.language)} />
                <MobileRecordField label={t('patients.nextVisit')} value={formatDate(patient.nextAppointmentDate, i18n.language)} />
              </MobileRecordCard>
            ))}
          </div>
          <div className="hidden md:block">
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t('patients.name')}</th>
                <th>{t('patients.civilId')}</th>
                <th>{t('patients.phone')}</th>
                <th>{t('patients.lastVisit')}</th>
                <th>{t('patients.nextVisit')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>
                    <div className="font-medium text-[#1F2430]">{patient.fullNameAr}</div>
                    {patient.fullNameEn && <div className="text-xs text-[#94A3B8]">{patient.fullNameEn}</div>}
                  </td>
                  <td className="font-mono text-[#64748B]">{maskCivilId(patient.civilId)}</td>
                  <td className="text-[#1F2430]">{patient.phone || '—'}</td>
                  <td className="text-[#64748B]">{formatDate(patient.lastVisitDate, i18n.language)}</td>
                  <td className="text-[#64748B]">{formatDate(patient.nextAppointmentDate, i18n.language)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(preserveListState(`/patients/${patient.id}`, location))}
                        aria-label={t('patients.viewPatient')}
                        className="icon-btn"
                      >
                        <Eye size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => navigate(preserveListState(`/patients/${patient.id}/edit`, location))}
                        aria-label={t('patients.editPatient')}
                        className="icon-btn"
                      >
                        <Pencil size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => navigate(`/appointments/new?patientId=${encodeURIComponent(patient.id)}&returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
                        aria-label={t('patients.bookAppointment')}
                        className="icon-btn"
                      >
                        <CalendarPlus size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {meta && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#E2E8F0]">
              <span className="text-[13px] text-[#64748B]">
                {t('common.showingRange', {
                  from: (meta.page - 1) * meta.limit + 1,
                  to: Math.min(meta.page * meta.limit, meta.total),
                  total: meta.total,
                  item: t('patients.itemPlural'),
                })}
              </span>
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setPage((p) => { const next = Math.max(1, p - 1); setSearchParams((current) => { current.set('page', String(next)); return current; }); return next; }); }}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-sm disabled:opacity-40"
                  >
                    {t('common.previous')}
                  </button>
                  <span className="text-sm text-[#102F63] font-medium">{meta.page} / {meta.totalPages}</span>
                  <button
                    onClick={() => { setPage((p) => { const next = Math.min(meta.totalPages, p + 1); setSearchParams((current) => { current.set('page', String(next)); return current; }); return next; }); }}
                    disabled={page === meta.totalPages}
                    className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-sm disabled:opacity-40"
                  >
                    {t('common.next')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
