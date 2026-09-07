import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UsersRound, CalendarDays, ClipboardList, ReceiptText, Stethoscope, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import StatCard from '../components/StatCard';
import { patientsService } from '../services/patients.service';
import { appointmentsService } from '../services/appointments.service';
import { visitsService } from '../services/visits.service';
import { reportsService } from '../services/reports.service';
import { formatMoney } from '../utils/money';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const roleLabel = user?.role === 'ADMIN' ? t('roles.admin') : t('roles.receptionist');

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get today's date in YYYY-MM-DD format for API calls (local timezone)
  const today = formatDateLocal(new Date());
  const weekAgo = formatDateLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  // Fetch total patients count
  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'count'],
    queryFn: () => patientsService.getPatients(undefined, undefined, 1, 1),
    select: (data) => data.meta.total,
  });

  // Fetch today's appointments count
  const { data: appointmentsData } = useQuery({
    queryKey: ['appointments', 'today', today],
    queryFn: () => appointmentsService.getAppointments(today, undefined, undefined, 1, 1),
    select: (data) => data.meta.total,
  });

  // Fetch week visits count
  const { data: visitsData } = useQuery({
    queryKey: ['visits', 'week', weekAgo, today],
    queryFn: () => visitsService.getVisits(undefined, undefined, undefined, undefined, weekAgo, today, undefined, 1, 1),
    select: (data) => data.meta.total,
  });

  // Fetch outstanding balance (admin only - reports API is admin-only)
  const { data: reportsData } = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: () => reportsService.getSummary(),
    enabled: isAdmin,
    select: (data) => data.outstandingAmount,
  });

  return (
    <div className="min-h-screen flex bg-[#F6F8FC]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="page-container flex-1">
          <div className="mb-6">
            <h1 className="text-[26px] font-bold text-[#102F63]">{t('dashboard.title')}</h1>
            <p className="text-[14px] text-[#64748B] mt-1">{t('dashboard.subtitle')}</p>
          </div>

          <div className="ui-card px-6 py-5 mb-6 flex items-center gap-4">
            <span className="w-11 h-11 rounded-full bg-[#173B78] text-white flex items-center justify-center shrink-0">
              <UsersRound size={20} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-[#102F63]">{t('dashboard.welcome', { name: user?.name || 'Admin' })}</p>
              <p className="text-[13px] text-[#64748B]">{t('dashboard.role')}: {roleLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <DashboardCard
              title={t('sidebar.patients')}
              description={t('dashboard.patientsDesc')}
              icon={UsersRound}
              onClick={() => navigate('/patients')}
            />
            <DashboardCard
              title={t('sidebar.appointments')}
              description={t('dashboard.appointmentsDesc')}
              icon={CalendarDays}
              onClick={() => navigate('/appointments')}
            />
            <DashboardCard
              title={t('sidebar.visits')}
              description={t('dashboard.visitsDesc')}
              icon={ClipboardList}
              onClick={() => navigate('/visits')}
            />
            <DashboardCard
              title={t('sidebar.invoices')}
              description={t('dashboard.invoicesDesc')}
              icon={ReceiptText}
              onClick={() => navigate('/invoices')}
              accent="red"
            />
            {isAdmin && (
              <DashboardCard
                title={t('sidebar.services')}
                description={t('dashboard.servicesDesc')}
                icon={Stethoscope}
                onClick={() => navigate('/services')}
              />
            )}
          </div>

          <div className="ui-card px-6 py-5">
            <h2 className="text-[16px] font-semibold text-[#102F63] mb-3">{t('dashboard.quickSummary')}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x rtl:divide-x-reverse divide-[#E2E8F0]">
              <StatCard
                label={t('dashboard.totalPatients')}
                value={patientsData ?? 0}
                icon={UsersRound}
              />
              <StatCard
                label={t('dashboard.todayAppointments')}
                value={appointmentsData ?? 0}
                icon={CalendarDays}
              />
              <StatCard
                label={t('dashboard.weekVisits')}
                value={visitsData ?? 0}
                icon={ClipboardList}
              />
              <StatCard
                label={t('dashboard.totalOutstanding')}
                value={isAdmin ? formatMoney(reportsData ?? 0, i18n.language) : null}
                icon={Wallet}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
