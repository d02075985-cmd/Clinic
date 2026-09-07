import { ReactNode } from 'react';

interface MobileRecordCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}

/**
 * Compact record layout used on narrow screens instead of forcing a data table
 * to scroll horizontally. The desktop table remains the canonical full view.
 */
export default function MobileRecordCard({ title, subtitle, children, actions, onClick }: MobileRecordCardProps) {
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-[#1F2430]">{title}</div>
          {subtitle && <div className="mt-0.5 break-words text-xs text-[#64748B]">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>{actions}</div>}
      </div>
      <div className="mt-3 grid gap-2 text-sm text-[#64748B]">{children}</div>
    </>
  );

  return onClick ? (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') onClick(); }} className="ui-card block w-full cursor-pointer p-4 text-right transition hover:border-[#B8C5DA] hover:shadow-[var(--shadow-soft-lg)]">
      {content}
    </div>
  ) : (
    <div className="ui-card p-4">{content}</div>
  );
}

export function MobileRecordField({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-[#94A3B8]">{label}</span>
      <span className="min-w-0 break-words text-left text-[#1F2430]">{value}</span>
    </div>
  );
}
