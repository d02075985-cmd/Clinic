import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ContextualBackProps {
  to: string;
  onClick?: () => void;
}

export default function ContextualBack({ to, onClick }: ContextualBackProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick || (() => navigate(to))}
      aria-label={t('common.back')}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#102F63]"
    >
      <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
      <span>{t('common.back')}</span>
    </button>
  );
}
