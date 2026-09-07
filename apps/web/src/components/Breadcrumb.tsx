import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('common.breadcrumb')} className="mb-4 flex max-w-full flex-wrap items-center gap-1.5 text-sm text-[#64748B]">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <ChevronLeft size={14} aria-hidden="true" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-[#102F63]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#1F2430]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
