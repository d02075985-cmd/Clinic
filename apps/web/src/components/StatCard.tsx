import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value?: string | number | null;
  icon?: LucideIcon;
  isLoading?: boolean;
  trend?: string;
}

export default function StatCard({ label, value, icon: Icon, isLoading, trend }: StatCardProps) {
  return (
    <div className="min-h-[112px] rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-[#64748B]">{label}</span>
        {Icon && (
          <span className="w-7 h-7 rounded-full bg-blue-50 text-[#173B78] flex items-center justify-center">
            <Icon size={14} strokeWidth={1.75} />
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="ui-skeleton h-7 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-[#102F63] sm:text-3xl">{value ?? '—'}</span>
          {trend && <span className="text-xs font-medium text-[#16803C]">{trend}</span>}
        </div>
      )}
    </div>
  );
}
