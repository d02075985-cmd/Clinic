import { LucideIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DashboardCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  accent?: 'blue' | 'red';
}

export default function DashboardCard({ title, description, icon: Icon, onClick, accent = 'blue' }: DashboardCardProps) {
  const { t, i18n } = useTranslation();
  const iconBg = accent === 'red' ? 'bg-red-50 text-[#E62E1B]' : 'bg-blue-50 text-[#173B78]';
  const Arrow = i18n.language === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <button
      onClick={onClick}
      className="ui-card w-full p-5 text-start transition-shadow duration-150 group hover:shadow-[var(--shadow-soft-lg)]"
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-4 ${iconBg}`}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <h3 className="text-[17px] font-semibold text-[#102F63] mb-1">{title}</h3>
      <p className="text-[13px] text-[#64748B] mb-3">{description}</p>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#173B78] group-hover:gap-2 transition-all">
        {t('common.viewAll')}
        <Arrow size={14} strokeWidth={2} />
      </span>
    </button>
  );
}

