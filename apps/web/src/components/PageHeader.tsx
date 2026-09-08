import { ReactNode } from 'react';
import Breadcrumb, { BreadcrumbItem } from './Breadcrumb';
import ContextualBack from './ContextualBack';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  className?: string;
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions, backTo, onBack, className = '' }: PageHeaderProps) {
  return (
    <div className={className}>
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          {backTo && <ContextualBack to={backTo} onClick={onBack} />}
          <h1 className="text-[26px] font-bold text-[#102F63]">{title}</h1>
          {subtitle && <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
      </div>
    </div>
  );
}
