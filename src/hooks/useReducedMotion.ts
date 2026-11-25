import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useReducedMotion(): boolean {
  const motionPreference = useSettingsStore((s) => s.motionPreference);
  const [systemPrefersReduced, setSystemPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersReduced(event.matches);
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
    };
  }, []);

  if (motionPreference === 'reduced') return true;
  if (motionPreference === 'full') return false;
  return systemPrefersReduced;
}
