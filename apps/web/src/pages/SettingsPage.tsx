import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UsersRound, Bell, ShieldCheck, FileClock, Server, Lock, DatabaseBackup,
  CheckCircle2, XCircle, Loader2, Plus, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usersService, AppUser } from '../services/users.service';
import { auditService } from '../services/audit.service';
import { backupService, BackupStatus, BackupEntry } from '../services/backup.service';
import { apiBaseUrl } from '../config/api';
import { getAccessToken } from '../config/auth-token';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import PageHeader from '../components/PageHeader';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const APP_VERSION = 'v1.0.0';

const NOTIFICATION_PREFS_KEY = 'clinic_notification_prefs';
const DEFAULT_NOTIFICATION_PREFS = {
  appointmentReminders: true,
  newAppointment: true,
  appointmentCancellation: true,
  invoicePayment: true,
  lowStorage: true,
  backupStatus: true,
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  UPDATE_STATUS: 'تغيير حالة',
  ACTIVATE: 'تفعيل',
  DEACTIVATE: 'تعطيل',
  DELETE: 'حذف',
};
const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Patient: 'مريضة',
  Visit: 'زيارة',
  Appointment: 'موعد',
  Service: 'خدمة',
  Invoice: 'فاتورة',
  Payment: 'دفعة',
  User: 'مستخدم',
};

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('ar-KW', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="page-container">
      <PageHeader title={t('sidebar.settings')} subtitle={t('settings.subtitle')} breadcrumbs={[{ label: t('sidebar.settings') }]} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <SettingsCard
          icon={UsersRound}
          color="#16803C"
          title={t('settings.rolesTitle')}
          description={t('settings.rolesDesc')}
          active={activeSection === 'roles'}
          onClick={() => setActiveSection(activeSection === 'roles' ? null : 'roles')}
        />
        <SettingsCard
          icon={Bell}
          color="#C98200"
          title={t('settings.notificationsTitle')}
          description={t('settings.notificationsDesc')}
          active={activeSection === 'notifications'}
          onClick={() => setActiveSection(activeSection === 'notifications' ? null : 'notifications')}
        />
        <SettingsCard
          icon={ShieldCheck}
          color="#173B78"
          title={t('settings.securityTitle')}
          description={t('settings.securityDesc')}
          active={activeSection === 'security'}
          onClick={() => setActiveSection(activeSection === 'security' ? null : 'security')}
        />
        <SettingsCard
          icon={DatabaseBackup}
          color="#6B4FBB"
          title={t('settings.backupTitle')}
          description={t('settings.backupDesc')}
          active={activeSection === 'backup'}
          onClick={() => setActiveSection(activeSection === 'backup' ? null : 'backup')}
        />
        <SettingsCard
          icon={FileClock}
          color="#4B5694"
          title={t('settings.activityTitle')}
          description={t('settings.activityDesc')}
          active={activeSection === 'activity'}
          onClick={() => setActiveSection(activeSection === 'activity' ? null : 'activity')}
        />
        <SettingsCard
          icon={Server}
          color="#C4362B"
          title={t('settings.systemTitle')}
          description={t('settings.systemDesc')}
          active={activeSection === 'system'}
          onClick={() => setActiveSection(activeSection === 'system' ? null : 'system')}
        />
      </div>

      {activeSection === 'roles' && <RolesSection currentUserId={user?.id} />}
      {activeSection === 'notifications' && <NotificationsSection />}
      {activeSection === 'security' && <SecuritySection />}
      {activeSection === 'backup' && <BackupSection />}
      {activeSection === 'activity' && <ActivitySection />}
      {activeSection === 'system' && <SystemInfoSection />}

      {!activeSection && <SystemOverviewGrid />}
    </div>
  );
}

// ---------- النسخ الاحتياطي والاستعادة ----------
function BackupSection() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([backupService.getStatus(), backupService.listBackups()]);
      setStatus(s);
      setBackups(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تحميل بيانات النسخ الاحتياطي');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRunBackup = async () => {
    setRunning(true);
    setError('');
    try {
      await backupService.runBackup();
      await load();
      showToast({ type: 'success', message: t('feedback.backupCreated') });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء النسخة الاحتياطية');
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('feedback.backupFailed') });
    } finally {
      setRunning(false);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    setError('');
    try {
      await backupService.restoreBackup(confirmRestore.filename);
      setConfirmRestore(null);
      await load();
      showToast({ type: 'success', message: t('feedback.backupRestored') });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل استعادة النسخة الاحتياطية');
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('feedback.restoreFailed') });
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="ui-card p-5">
      <h2 className="text-[16px] font-bold text-[#102F63] mb-1 flex items-center gap-2">
        <DatabaseBackup size={17} strokeWidth={1.75} />
        النسخ الاحتياطي والاستعادة
      </h2>
      <p className="text-xs text-[#94A3B8] mb-5">
        نسخة احتياطية تلقائية يوميًا الساعة 3:00 صباحًا، بالاحتفاظ بآخر {status?.retentionDays ?? '—'} يوم.
        {status && !status.remoteStorageConfigured && ' التخزين الخارجي (خارج السيرفر) غير مفعّل حاليًا — النسخ محفوظة على السيرفر نفسه فقط.'}
      </p>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 text-[#C4362B] rounded-lg text-sm">{error}</div>}

      {loading ? (
        <Skeleton className="h-32 rounded-lg mb-5" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          <div className="p-4 rounded-xl border border-[#E2E8F0]">
            <div className="text-xs text-[#94A3B8] mb-1">آخر نسخة احتياطية</div>
            <div className="font-bold text-[#1F2430] text-sm">
              {status?.lastBackup ? new Date(status.lastBackup.createdAt).toLocaleString('ar-KW') : 'لا توجد نسخ سابقة'}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[#E2E8F0]">
            <div className="text-xs text-[#94A3B8] mb-1">التخزين الخارجي</div>
            <div className={`font-bold text-sm ${status?.remoteStorageConfigured ? 'text-[var(--success)]' : 'text-[#94A3B8]'}`}>
              {status?.remoteStorageConfigured ? 'مفعّل' : 'غير مفعّل'}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[#E2E8F0]">
            <div className="text-xs text-[#94A3B8] mb-1">عدد النسخ المحفوظة</div>
            <div className="font-bold text-[#1F2430]">{status?.totalBackups ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl border border-[#E2E8F0]">
            <div className="text-xs text-[#94A3B8] mb-1">المساحة المستخدمة</div>
            <div className="font-bold text-[#1F2430]">{status ? formatSize(status.totalSizeBytes) : '—'}</div>
          </div>
        </div>
      )}

      <button onClick={handleRunBackup} disabled={running} className="btn-primary px-4 py-2.5 text-sm mb-5 flex items-center gap-2">
        {running ? <Loader2 size={16} className="animate-spin" /> : null}
        {running ? 'جارِ إنشاء النسخة...' : 'إنشاء نسخة احتياطية الآن'}
      </button>

      <h3 className="text-sm font-bold text-[#102F63] mb-3">النسخ المتاحة للاستعادة</h3>
      {backups.length === 0 && !loading && <EmptyState title={t('settings.noBackupsYet')} />}
      {backups.length > 0 && (
        <div className="space-y-2">
          {backups.map((b) => (
            <div key={b.filename} className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8F0] text-sm">
              <div>
                <div className="text-[#1F2430]">{new Date(b.createdAt).toLocaleString('ar-KW')}</div>
                <div className="text-xs text-[#94A3B8]">{formatSize(b.sizeBytes)} · {b.triggeredBy === 'manual' ? 'يدوي' : b.triggeredBy === 'scheduled' ? 'تلقائي' : 'نسخة أمان قبل استعادة'}{b.uploadedToRemote ? ' · مرفوعة خارجيًا' : ''}</div>
              </div>
              <button onClick={() => setConfirmRestore(b)} className="text-[#C4362B] hover:underline">استعادة</button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRestore}
        title={t('settings.confirmRestoreTitle')}
        message={confirmRestore ? t('settings.confirmRestoreBody', {
          date: new Date(confirmRestore.createdAt).toLocaleString('ar-KW'),
        }) : ''}
        confirmLabel={restoring ? t('settings.restoring') : t('settings.confirmRestoreBtn')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={restoring}
        onCancel={() => setConfirmRestore(null)}
        onConfirm={handleRestore}
      />
    </div>
  );
}

function SettingsCard({
  icon: Icon, color, title, description, active, onClick,
}: {
  icon: typeof UsersRound; color: string; title: string; description: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`ui-card p-5 text-right transition-shadow hover:shadow-[var(--shadow-soft-lg)] ${active ? 'ring-2 ring-[#102F63]' : ''}`}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: `${color}1A` }}>
        <Icon size={20} strokeWidth={1.75} style={{ color }} />
      </div>
      <h3 className="font-bold text-[#102F63] mb-1">{title}</h3>
      <p className="text-[13px] text-[#64748B] leading-relaxed">{description}</p>
    </button>
  );
}

// ---------- الصلاحيات والأدوار ----------
function RolesSection({ currentUserId }: { currentUserId?: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data: users, isLoading, refetch } = useQuery({ queryKey: ['users'], queryFn: () => usersService.getUsers() });

  return (
    <div className="ui-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-bold text-[#102F63]">المستخدمون والأدوار</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm">
          <Plus size={16} strokeWidth={2} />
          إضافة مستخدم
        </button>
      </div>

      {isLoading && <Skeleton className="h-32 rounded-lg" />}

      {users && (
        <table className="ui-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>البريد الإلكتروني</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onChanged={refetch} />
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-[#94A3B8] mt-4">
        النظام حاليًا يدعم دورين: "مدير النظام" (صلاحية كاملة) و"موظف استقبال" (بدون الوصول لإدارة الخدمات والإعدادات). صلاحيات مخصصة لكل قسم على حدة غير مدعومة بعد.
      </p>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}

function UserRow({ user, isSelf, onChanged }: { user: AppUser; isSelf: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const toggleStatus = async () => {
    setBusy(true);
    try {
      await usersService.updateUserStatus(user.id, !user.isActive);
      onChanged();
    } catch (err) {
      console.error('Failed to update user status:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td className="font-medium text-[#1F2430]">{user.name}{isSelf && <span className="text-xs text-[#94A3B8]"> (أنتِ)</span>}</td>
      <td className="text-[#64748B]">{user.email}</td>
      <td>
        <span className="ui-badge" style={{ background: 'rgba(23,59,120,0.1)', color: 'var(--brand-blue)' }}>
          {user.role === 'ADMIN' ? 'مدير النظام' : 'موظف استقبال'}
        </span>
      </td>
      <td>
        <span className="ui-badge" style={user.isActive ? { background: 'rgba(22,128,60,0.1)', color: 'var(--success)' } : { background: 'rgba(100,116,139,0.1)', color: 'var(--text-secondary)' }}>
          {user.isActive ? 'نشط' : 'معطّل'}
        </span>
      </td>
      <td>
        <button onClick={toggleStatus} disabled={isSelf || busy} className="text-sm text-[#173B78] disabled:opacity-40 disabled:cursor-not-allowed hover:underline">
          {busy ? '...' : user.isActive ? 'تعطيل' : 'تفعيل'}
        </button>
      </td>
    </tr>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'RECEPTIONIST'>('RECEPTIONIST');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await usersService.createUser({ name, email, password, role });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء المستخدم');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="ui-card p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#102F63]">إضافة مستخدم جديد</h3>
          <button onClick={onClose} aria-label="إغلاق" className="text-[#94A3B8] hover:text-[#102F63]"><X size={18} /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 text-[#C4362B] rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" required className="ui-input" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required className="ui-input" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور (٦ أحرف على الأقل)" required minLength={6} className="ui-input" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'RECEPTIONIST')} className="ui-input">
            <option value="RECEPTIONIST">موظف استقبال</option>
            <option value="ADMIN">مدير النظام</option>
          </select>
          <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 text-sm">
            {submitting ? 'جارِ الإنشاء...' : 'إنشاء المستخدم'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- الإشعارات والتنبيهات ----------
function NotificationsSection() {
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    const saved = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (saved) {
      try { setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(saved) }); } catch { /* ignore */ }
    }
  }, []);

  const toggle = (key: keyof typeof DEFAULT_NOTIFICATION_PREFS) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
  };

  const items: Array<{ key: keyof typeof DEFAULT_NOTIFICATION_PREFS; label: string }> = [
    { key: 'appointmentReminders', label: 'تذكير بالمواعيد' },
    { key: 'newAppointment', label: 'إشعار عند حجز موعد جديد' },
    { key: 'appointmentCancellation', label: 'إشعار عند إلغاء موعد' },
    { key: 'invoicePayment', label: 'إشعار عند تسجيل دفعة على فاتورة' },
    { key: 'lowStorage', label: 'تنبيه عند انخفاض مساحة التخزين' },
    { key: 'backupStatus', label: 'إشعار بحالة النسخ الاحتياطي' },
  ];

  return (
    <div className="ui-card p-5">
      <h2 className="text-[16px] font-bold text-[#102F63] mb-1">تفضيلات الإشعارات</h2>
      <p className="text-xs text-[#94A3B8] mb-4">هذه التفضيلات محفوظة على هذا الجهاز فقط. عند ربط نظام الإشعارات الفعلي بالخادم مستقبلًا، سيتم استخدام نفس هذه الإعدادات.</p>
      <div className="space-y-3">
        {items.map((item) => (
          <label key={item.key} className="flex items-center justify-between py-2 border-b border-[#E2E8F0] last:border-0 cursor-pointer">
            <span className="text-sm text-[#1F2430]">{item.label}</span>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={() => toggle(item.key)}
              className="w-4.5 h-4.5 rounded border-[#E2E8F0] text-[#173B78] focus:ring-[#173B78]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------- الأمان ----------
function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }
    setSubmitting(true);
    try {
      const token = getAccessToken();
      const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'فشل تغيير كلمة المرور');
      setSuccess('تم تغيير كلمة المرور بنجاح');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ui-card p-5 max-w-md">
      <h2 className="text-[16px] font-bold text-[#102F63] mb-4 flex items-center gap-2">
        <Lock size={17} strokeWidth={1.75} />
        تغيير كلمة المرور
      </h2>
      {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 text-[#C4362B] rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-3 px-3 py-2 bg-green-50 border border-green-100 text-[var(--success)] rounded-lg text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="كلمة المرور الحالية" required className="ui-input" />
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة" required minLength={6} className="ui-input" />
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" required minLength={6} className="ui-input" />
        <button type="submit" disabled={submitting} className="btn-primary px-4 py-2.5 text-sm">
          {submitting ? 'جارِ الحفظ...' : 'حفظ كلمة المرور الجديدة'}
        </button>
      </form>
    </div>
  );
}

// ---------- سجل التغييرات ----------
function ActivitySection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs', page], queryFn: () => auditService.getLogs(page, 20) });

  return (
    <div className="ui-card p-5">
      <h2 className="text-[16px] font-bold text-[#102F63] mb-4">سجل التغييرات</h2>
      {isLoading && <Skeleton className="h-40 rounded-lg" />}
      {data && data.data.length === 0 && <div className="ui-empty-state">لا توجد عمليات مسجلة بعد</div>}
      {data && data.data.length > 0 && (
        <>
          <table className="ui-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>العملية</th>
                <th>القسم</th>
                <th>التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="text-[#1F2430]">{entry.user?.name || '—'}</td>
                  <td className="text-[#64748B]">{AUDIT_ACTION_LABELS[entry.action] || entry.action}</td>
                  <td className="text-[#64748B]">{AUDIT_ENTITY_LABELS[entry.entityType] || entry.entityType}</td>
                  <td className="text-[#94A3B8] text-sm">{formatDateTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-sm disabled:opacity-40">السابق</button>
              <span className="text-sm text-[#102F63] font-medium">{page} / {data.meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))} disabled={page === data.meta.totalPages} className="px-3 py-1.5 rounded-md border border-[#E2E8F0] text-sm disabled:opacity-40">التالي</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- معلومات النظام ----------
function SystemInfoSection() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/health`);
      return { ok: res.ok, data: await res.json().catch(() => null) };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="ui-card p-5">
      <h2 className="text-[16px] font-bold text-[#102F63] mb-4">معلومات النظام</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoTile label="حالة الخادم" loading={isLoading} ok={health?.ok} okText="يعمل بشكل طبيعي" badText="غير متصل" />
        <InfoTile label="قاعدة البيانات" loading={isLoading} ok={health?.data?.database === 'connected'} okText="متصلة" badText="غير متصلة" />
        <div className="p-4 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#94A3B8] mb-1">إصدار النظام</div>
          <div className="font-bold text-[#1F2430]">{APP_VERSION}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#94A3B8] mb-1">آخر فحص</div>
          <div className="font-bold text-[#1F2430] text-sm">{health?.data?.timestamp ? formatDateTime(health.data.timestamp) : '—'}</div>
        </div>
      </div>
      <p className="text-xs text-[#94A3B8] mt-4">تفاصيل مساحة التخزين والنسخ الاحتياطي متاحة من قسم النسخ الاحتياطي والاستعادة.</p>
    </div>
  );
}

function InfoTile({ label, loading, ok, okText, badText }: { label: string; loading: boolean; ok?: boolean; okText: string; badText: string }) {
  return (
    <div className="p-4 rounded-xl border border-[#E2E8F0]">
      <div className="text-xs text-[#94A3B8] mb-1">{label}</div>
      <div className="flex items-center gap-1.5 font-bold text-sm">
        {loading ? (
          <Loader2 size={15} className="animate-spin text-[#94A3B8]" />
        ) : ok ? (
          <><CheckCircle2 size={15} className="text-[var(--success)]" /><span className="text-[var(--success)]">{okText}</span></>
        ) : (
          <><XCircle size={15} className="text-[#C4362B]" /><span className="text-[#C4362B]">{badText}</span></>
        )}
      </div>
    </div>
  );
}

// ---------- نظرة عامة (الحالة الافتراضية) ----------
function SystemOverviewGrid() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/health`);
      return { ok: res.ok, data: await res.json().catch(() => null) };
    },
  });

  return (
    <div className="ui-card p-5">
      <h2 className="text-[15px] font-bold text-[#102F63] mb-4">نظرة عامة على النظام</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoTile label="حالة النظام" loading={!health} ok={health?.ok} okText="يعمل بشكل طبيعي" badText="غير متصل" />
        <InfoTile label="قاعدة البيانات" loading={!health} ok={health?.data?.database === 'connected'} okText="متصلة" badText="غير متصلة" />
        <div className="p-4 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#94A3B8] mb-1">إصدار النظام</div>
          <div className="font-bold text-[#1F2430]">{APP_VERSION}</div>
        </div>
        <div className="p-4 rounded-xl border border-[#E2E8F0]">
          <div className="text-xs text-[#94A3B8] mb-1">النسخ الاحتياطي</div>
          <div className="font-bold text-[#94A3B8] text-sm">راجع قسم النسخ الاحتياطي</div>
        </div>
      </div>
    </div>
  );
}
