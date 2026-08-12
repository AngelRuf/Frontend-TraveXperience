import { useEffect, useRef } from 'react';

export default function useModalScrollLock(isOpen) {
  const prevOverflow = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!isOpen) return undefined;

    window.__openModalCount = (window.__openModalCount || 0) + 1;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo({ top: 0, behavior: 'auto' });

    return () => {
      window.__openModalCount = Math.max(0, (window.__openModalCount || 1) - 1);
      if (!window.__openModalCount) {
        document.body.style.overflow = prevOverflow.current || '';
      }
    };
  }, [isOpen]);
}
