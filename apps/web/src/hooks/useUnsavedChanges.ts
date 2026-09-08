import { useCallback, useEffect, useState } from 'react';

export function useUnsavedChanges(isDirty: boolean) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: globalThis.BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const requestNavigation = useCallback((onLeave: () => void) => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onLeave();
  }, [isDirty]);

  const stay = useCallback(() => setConfirmOpen(false), []);
  const leave = useCallback((onLeave: () => void) => {
    setConfirmOpen(false);
    onLeave();
  }, []);

  return { confirmOpen, requestNavigation, stay, leave };
}
