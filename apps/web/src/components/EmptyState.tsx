import { Inbox } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state" role="status">
      <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]">
        {icon || <Inbox size={19} strokeWidth={1.75} aria-hidden="true" />}
      </span>
      <p className="font-medium text-[#475569]">{title}</p>
      {description && <p className="mt-1 text-sm text-[#94A3B8]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
