import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type: ToastType;
  message: string;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  showToast: (toast: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toastStyles: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastOptions) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    const timer = window.setTimeout(() => dismissToast(id), 5000);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
        className="fixed inset-x-4 top-4 z-[100] flex max-w-md flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-96"
        aria-label={t('feedback.notifications')}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${toastStyles[toast.type]}`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label={t('common.close')}
              className="shrink-0 rounded p-0.5 hover:bg-black/10"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
